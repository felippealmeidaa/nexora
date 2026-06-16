from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

try:
    from redis import Redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover - dependencia opcional
    Redis = None

    class RedisError(Exception):
        pass


class CacheService:
    _local_store: dict[str, dict[str, Any]] = {}
    _local_lock = threading.Lock()
    _redis_client: Redis | None = None
    _redis_checked = False
    _redis_retry_after = 0.0

    def _compose_key(self, namespace: str, key: str) -> str:
        return f"{settings.CACHE_NAMESPACE}:{namespace}:{key}"

    def _clone_payload(self, payload: Any) -> Any:
        return json.loads(json.dumps(payload, ensure_ascii=False, default=str))

    def _get_redis_client(self) -> Redis | None:
        if not settings.REDIS_URL or Redis is None:
            return None

        now = time.monotonic()
        if self._redis_client is not None:
            return self._redis_client
        if self._redis_checked and now < self._redis_retry_after:
            return None

        self._redis_checked = True
        try:
            self._redis_client = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
                socket_connect_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
                health_check_interval=30,
            )
            self._redis_client.ping()
            logger.info("Cache Redis habilitado em %s", settings.REDIS_URL)
            return self._redis_client
        except Exception as exc:  # pragma: no cover - ambiente pode nao ter redis
            self._redis_client = None
            self._redis_retry_after = now + settings.REDIS_RETRY_COOLDOWN_SECONDS
            logger.warning("Redis indisponivel; fallback para cache local em memoria: %s", exc)
            return None

    def describe_backend(self) -> str:
        if self._get_redis_client() is not None:
            return "redis"
        return "memoria-local"

    def get_json(self, namespace: str, key: str) -> Any | None:
        cache_key = self._compose_key(namespace, key)
        redis_client = self._get_redis_client()

        if redis_client is not None:
            try:
                raw_value = redis_client.get(cache_key)
                if raw_value:
                    return json.loads(raw_value)
            except (RedisError, json.JSONDecodeError) as exc:
                logger.warning("Falha ao ler cache Redis %s: %s", cache_key, exc)

        now = time.monotonic()
        with self._local_lock:
            cached = self._local_store.get(cache_key)
            if not cached:
                return None
            if float(cached.get("expires_at") or 0.0) <= now:
                self._local_store.pop(cache_key, None)
                return None
            return self._clone_payload(cached.get("value"))

    def set_json(self, namespace: str, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = int(ttl_seconds or settings.CACHE_DEFAULT_TTL_SECONDS)
        cache_key = self._compose_key(namespace, key)
        payload = self._clone_payload(value)
        serialized = json.dumps(payload, ensure_ascii=False, default=str)

        redis_client = self._get_redis_client()
        if redis_client is not None:
            try:
                redis_client.setex(cache_key, ttl, serialized)
            except RedisError as exc:
                logger.warning("Falha ao gravar cache Redis %s: %s", cache_key, exc)

        with self._local_lock:
            self._local_store[cache_key] = {
                "expires_at": time.monotonic() + ttl,
                "value": payload,
            }

    def clear_namespaces(self, *namespaces: str) -> None:
        normalized_namespaces = [namespace.strip() for namespace in namespaces if str(namespace or "").strip()]
        if not normalized_namespaces:
            return

        redis_client = self._get_redis_client()
        if redis_client is not None:
            for namespace in normalized_namespaces:
                pattern = self._compose_key(namespace, "*")
                try:
                    keys = list(redis_client.scan_iter(match=pattern, count=200))
                    if keys:
                        redis_client.delete(*keys)
                except RedisError as exc:
                    logger.warning("Falha ao limpar namespace Redis %s: %s", namespace, exc)

        with self._local_lock:
            for namespace in normalized_namespaces:
                prefix = self._compose_key(namespace, "")
                keys_to_remove = [key for key in self._local_store if key.startswith(prefix)]
                for key in keys_to_remove:
                    self._local_store.pop(key, None)


cache_service = CacheService()
