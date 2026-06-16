"""Testes para as novas funcionalidades (Lockout de Login, Cabeçalhos de Segurança e Pró-Reitor)."""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.user import User, UserRole
from app.security.hashing import hash_password
from app.models.login_attempt import LoginAttempt

_uid = uuid.uuid4().hex[:6]


@pytest.fixture
def client():
    """Cria tabelas no banco de teste configurado e fornece o TestClient."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Limpar TODAS as tentativas anteriores no início para evitar vazamento de estado
        db.query(LoginAttempt).delete()
        db.commit()
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_auth_client(client):
    """Cria um usuário pró-reitor/admin local e autentica para testar RBAC."""
    db = SessionLocal()
    username = f"testnewadmin_{_uid}"
    try:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(
                username=username,
                full_name="Test Pro-Reitor Admin",
                email=f"{username}@test.com",
                hashed_password=hash_password("admin1234"),
                role=UserRole.ADMIN,
                is_active=True,
                is_approved=True,
            ))
            db.commit()
    finally:
        db.close()

    resp = client.post("/api/auth/login", json={
        "identifier": username,
        "password": "admin1234",
    })
    assert resp.status_code == 200
    return client


class TestSecurityHeaders:
    def test_security_headers_are_present(self, client):
        """Verifica se os cabeçalhos de segurança obrigatórios estão em todas as respostas."""
        resp = client.get("/health")
        assert resp.status_code == 200
        headers = resp.headers
        assert headers.get("X-Frame-Options") == "DENY"
        assert headers.get("X-Content-Type-Options") == "nosniff"
        assert headers.get("X-XSS-Protection") == "1; mode=block"
        assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "Content-Security-Policy" in headers


class TestLoginLockout:
    def test_login_lockout_after_failed_attempts(self, client):
        """Verifica que após 10 tentativas de login falhas consecutivas de um IP/Username, o lockout é acionado."""
        # Limpar TODAS as tentativas de login prévias para evitar interferência
        db = SessionLocal()
        try:
            db.query(LoginAttempt).delete()
            db.commit()
        finally:
            db.close()

        identifier = f"testnewuser_lock_{_uid}"

        # Fazer 10 tentativas incorretas
        for i in range(10):
            resp = client.post("/api/auth/login", json={
                "identifier": identifier,
                "password": f"wrongpass{i}",
            })
            assert resp.status_code == 401, f"Falha na tentativa {i+1}"

        # A 11ª tentativa deve retornar HTTP 429 (Too Many Requests) devido ao Lockout
        resp = client.post("/api/auth/login", json={
            "identifier": identifier,
            "password": "some_password",
        })
        assert resp.status_code == 429
        assert "Muitas tentativas de login incorretas" in resp.json()["detail"]


class TestProReitorAnalytics:
    def test_proreitor_stats_unauthorized(self, client):
        """Verifica que usuários não autenticados não podem acessar o endpoint do Pró-Reitor."""
        resp = client.get("/api/analytics/proreitor/stats")
        assert resp.status_code == 401

    def test_proreitor_stats_authorized(self, admin_auth_client):
        """Verifica que um administrador/pró-reitor consegue acessar as estatísticas globais com sucesso."""
        resp = admin_auth_client.get("/api/analytics/proreitor/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "top_students" in data
        assert "ranking_courses" in data
        assert "ranking_subjects" in data
