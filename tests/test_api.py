"""Smoke tests alinhados ao contrato atual da API."""

from datetime import date
import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.student import Student
from app.models.user import User, UserRole
from app.security.hashing import hash_password


_uid = uuid.uuid4().hex[:8]


@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_client(client):
    db = SessionLocal()
    username = f"testadmin_{_uid}"
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            user = User(
                username=username,
                full_name="Test Admin",
                email=f"{username}@test.com",
                hashed_password=hash_password("test1234"),
                role=UserRole.ADMIN,
                is_active=True,
                is_approved=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

    response = client.post(
        "/api/auth/login",
        json={
            "identifier": username,
            "password": "test1234",
        },
    )
    assert response.status_code == 200
    return client


class TestAuth:
    def test_login_success(self, auth_client):
        response = auth_client.get("/api/auth/me")
        assert response.status_code == 200
        payload = response.json()
        assert payload["username"] == f"testadmin_{_uid}"
        assert payload["role"] == "ADMIN"

    def test_refresh_rotates_session(self, auth_client):
        response = auth_client.post("/api/auth/refresh")
        assert response.status_code == 200
        payload = response.json()
        assert payload["authenticated"] is True
        assert payload["token_type"] == "session_cookie"
        assert payload["role"] == "ADMIN"

    def test_list_sessions(self, auth_client):
        response = auth_client.get("/api/auth/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert len(sessions) >= 1
        assert sessions[0]["session_identifier"]

    def test_revoke_named_session(self, auth_client):
        sessions_response = auth_client.get("/api/auth/sessions")
        session_identifier = sessions_response.json()[0]["session_identifier"]
        revoke_response = auth_client.delete(f"/api/auth/sessions/{session_identifier}")
        assert revoke_response.status_code == 204
        after = auth_client.get("/api/auth/me")
        assert after.status_code == 401

    def test_logout_all_clears_session(self, auth_client):
        response = auth_client.post("/api/auth/logout-all")
        assert response.status_code == 204
        after = auth_client.get("/api/auth/me")
        assert after.status_code == 401

    def test_logout_clears_session(self, auth_client):
        response = auth_client.post("/api/auth/logout")
        assert response.status_code == 204
        after = auth_client.get("/api/auth/me")
        assert after.status_code == 401

    def test_login_rate_limit_and_lockout(self, client):
        temp_username = f"ratelimit_{_uid}"
        for attempt_number in range(5):
            response = client.post(
                "/api/auth/login",
                json={
                    "identifier": temp_username,
                    "password": "wrongpassword",
                },
            )
            assert response.status_code == 401
            assert response.headers.get("X-RateLimit-Limit") == "5"
            assert int(response.headers.get("X-RateLimit-Remaining")) == 4 - attempt_number

        blocked = client.post(
            "/api/auth/login",
            json={
                "identifier": temp_username,
                "password": "wrongpassword",
            },
        )
        assert blocked.status_code == 429
        assert blocked.headers.get("X-RateLimit-Limit") == "5"
        assert blocked.headers.get("X-RateLimit-Remaining") == "0"
        assert "Retry-After" in blocked.headers


class TestStudentsAPI:
    def test_list_students_requires_auth(self, client):
        response = client.get("/api/students/")
        assert response.status_code == 401

    def test_list_students_for_admin(self, auth_client):
        response = auth_client.get("/api/students/")
        assert response.status_code == 200
        payload = response.json()
        assert "total" in payload
        assert "students" in payload

    def test_student_lookup_search_contract(self, auth_client):
        db = SessionLocal()
        try:
            student = db.query(Student).filter(Student.registration_number == f"T{_uid}").first()
            if not student:
                student = Student(
                    name="Aluno Contrato",
                    registration_number=f"T{_uid}",
                    email=f"aluno_{_uid}@test.com",
                    course_name="Curso Teste",
                    enrollment_date=date(2026, 1, 1),
                )
                db.add(student)
                db.commit()
        finally:
            db.close()

        response = auth_client.get(f"/api/students/?search=T{_uid}")
        assert response.status_code == 200
        assert response.json()["total"] >= 1


class TestHealthCheck:
    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "online"
