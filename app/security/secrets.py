"""
Utilitarios para proteger segredos operacionais.

Hoje usados para criptografar a senha do portal Lyceum antes de persistir.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_ENCRYPTED_PREFIX = "enc::"


def _build_fernet() -> Fernet:
    raw_key = settings.LYCEUM_CREDENTIALS_KEY or settings.SECRET_KEY
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def is_encrypted_secret(value: Optional[str]) -> bool:
    return bool(value and value.startswith(_ENCRYPTED_PREFIX))


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if is_encrypted_secret(cleaned):
        return cleaned
    token = _build_fernet().encrypt(cleaned.encode("utf-8")).decode("utf-8")
    return f"{_ENCRYPTED_PREFIX}{token}"


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if not is_encrypted_secret(cleaned):
        return cleaned
    token = cleaned[len(_ENCRYPTED_PREFIX):]
    try:
        return _build_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Nao foi possivel descriptografar o segredo armazenado.") from exc
