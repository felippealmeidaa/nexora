"""Configuração global do Pytest (conftest.py) para simular isolamento do banco e evitar lockouts."""

import pytest
from app.database import SessionLocal
from app.models.login_attempt import LoginAttempt


@pytest.fixture(autouse=True)
def clean_login_attempts():
    """Limpa a tabela de tentativas de login antes de cada teste para garantir isolamento contra lockout."""
    db = SessionLocal()
    try:
        db.query(LoginAttempt).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
