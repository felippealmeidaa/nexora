"""Testes de Integração para Insights Preventivos de IA e Rascunho de Alertas."""

import uuid
from datetime import date
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.student import Student
from app.models.grade import Grade
from app.models.course import Course
from app.models.user import User, UserRole
from app.security.hashing import hash_password

_uid = uuid.uuid4().hex[:6]


@pytest.fixture
def client():
    """Cria tabelas no banco de teste configurado e fornece o TestClient."""
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client):
    """Cria um usuario admin local e autentica via cookie para testar."""
    db = SessionLocal()
    try:
        username = f"testadmin_{_uid}"
        if not db.query(User).filter(User.username == username).first():
            db.add(User(
                username=username,
                full_name="Test Admin",
                email=f"{username}@test.com",
                hashed_password=hash_password("test1234"),
                role=UserRole.ADMIN,
                is_active=True,
                is_approved=True,
            ))
            db.commit()
    finally:
        db.close()

    resp = client.post("/api/auth/login", json={
        "identifier": f"testadmin_{_uid}",
        "password": "test1234",
    })
    assert resp.status_code == 200
    return client


@pytest.fixture
def auth_student_client(auth_client):
    """Cria um estudante de teste associado com notas no banco de dados para testar os endpoints preventivos."""
    db = SessionLocal()
    local_uid = uuid.uuid4().hex[:6]
    try:
        # Criar curso de teste com todos os campos obrigatórios e código único local
        course = Course(
            name=f"Cálculo I {local_uid}",
            code=f"MAT101_{local_uid}",
            semester="2024-1",
            department="Matemática",
            credits=4
        )
        db.add(course)
        db.flush()

        # Criar estudante usando tipo date do Python e matricula única local
        student = Student(
            name=f"Gabriel Alerta {local_uid}",
            registration_number=f"R_{local_uid}",
            email=f"gabriel_{local_uid}@test.com",
            enrollment_date=date(2024, 2, 1),
            status="ACTIVE",
            course_name=f"Engenharia {local_uid}",
            current_period=2,
            is_working=True
        )
        db.add(student)
        db.flush()

        # Criar notas parciais (VA1 e VA2 com nota baixa, projetando VA3 e reprovação)
        grade1 = Grade(
            student_id=student.id,
            course_id=course.id,
            value=4.5,
            description="VA1"
        )
        grade2 = Grade(
            student_id=student.id,
            course_id=course.id,
            value=5.0,
            description="VA2 Projetada ✨"
        )
        grade3 = Grade(
            student_id=student.id,
            course_id=course.id,
            value=4.8,
            description="VA3 Projetada ✨"
        )
        db.add_all([grade1, grade2, grade3])
        db.commit()

        # Retornar ID do estudante e o client autenticado
        return auth_client, student.id
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


@pytest.fixture(autouse=True)
def mock_gemini_service():
    """Mocka as chamadas externas ao Gemini para evitar flakiness e chamadas de rede reais nos testes."""
    from unittest.mock import patch, AsyncMock
    
    mock_analyze = AsyncMock(return_value={
        "summary": "Resumo de teste do aluno Gabriel com notas baixas em Cálculo.",
        "strengths": [{"title": "Engajamento", "description": "Bom engajamento inicial."}],
        "alerts": [{"title": "Risco de reprovação", "description": "Risco projetado em Cálculo I.", "severity": "high"}],
        "study_tips": [{"title": "Foco em Cálculo", "description": "Estudar mais Cálculo I.", "category": "study"}],
        "motivation": "Força nos estudos!"
    })
    
    mock_draft = AsyncMock(return_value="Olá Gabriel! Você está em risco de reprovação na disciplina Cálculo I. Vamos conversar?")
    
    with patch("app.routers.students.gemini_service.analyze_student", mock_analyze), \
         patch("app.routers.students.gemini_service.generate_student_draft_alert", mock_draft):
        yield


class TestPreventiveAI:
    def test_get_student_insights(self, auth_student_client):
        """Testa o endpoint GET /api/students/{student_id}/insights."""
        client, student_id = auth_student_client
        resp = client.get(f"/api/students/{student_id}/insights")
        
        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data
        insights = data["insights"]
        assert "summary" in insights
        assert "strengths" in insights
        assert "alerts" in insights
        assert "study_tips" in insights

    def test_generate_draft_alert_email(self, auth_student_client):
        """Testa o endpoint POST /api/students/{student_id}/draft-alert para Canal E-mail."""
        client, student_id = auth_student_client
        resp = client.post(
            f"/api/students/{student_id}/draft-alert",
            json={"channel": "email"}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert "draft" in data
        draft = data["draft"]
        assert len(draft) > 50
        assert "Prezado(a)" in draft or "Gabriel" in draft
        assert "reprovação" in draft or "risco" in draft or "Olá" in draft or "Cálculo" in draft

    def test_generate_draft_alert_whatsapp(self, auth_student_client):
        """Testa o endpoint POST /api/students/{student_id}/draft-alert para Canal WhatsApp."""
        client, student_id = auth_student_client
        resp = client.post(
            f"/api/students/{student_id}/draft-alert",
            json={"channel": "whatsapp"}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert "draft" in data
        draft = data["draft"]
        assert len(draft) > 30
        assert "Olá" in draft or "risco" in draft or "Cálculo" in draft
