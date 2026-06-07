"""Testes para a nova funcionalidade de gerenciamento de planilhas históricas com IA."""

import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.user import User, UserRole
from app.security.hashing import hash_password
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.models.historical_data import HistoricalRecord

_uid = uuid.uuid4().hex[:6]


@pytest.fixture
def client():
    """Cria tabelas no banco de teste e garante limpeza no início."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Limpar tabelas históricas antes do teste
        db.query(HistoricalRecord).delete()
        db.query(HistoricalSpreadsheet).delete()
        db.commit()
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def professor_client(client):
    """Cria um professor de teste e autentica."""
    db = SessionLocal()
    username = f"testprof_sheet_{_uid}"
    try:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(
                username=username,
                full_name="Professor de Planilhas",
                email=f"{username}@test.com",
                hashed_password=hash_password("prof1234"),
                role=UserRole.PROFESSOR,
                is_active=True,
                is_approved=True,
            ))
            db.commit()
    finally:
        db.close()

    resp = client.post("/api/auth/login", json={
        "identifier": username,
        "password": "prof1234",
    })
    assert resp.status_code == 200
    return client


class TestHistoricalSpreadsheets:
    def test_upload_creates_spreadsheet_and_records(self, professor_client):
        """Verifica que o upload de um CSV cria o registro da planilha e associa os alunos em cascata."""
        csv_data = (
            "aluno,sem_letivo,curso,disciplina,periodo,nota,frequencia\n"
            "Carlos Drumond,2024-1,Ciencia da Computacao,Estrutura de Dados,2,8.0,95.0\n"
            "Cecilia Meireles,2024-1,Ciencia da Computacao,Estrutura de Dados,2,9.0,100.0\n"
        )
        
        file_payload = {
            "file": ("notas_2024.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
        }

        # Executar upload
        resp = professor_client.post("/api/historical-data/upload", files=file_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["records_count"] == 2
        assert data["semester"] == "2024-1"

        # Verificar no banco se a planilha e registros foram salvos
        db = SessionLocal()
        try:
            sheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.filename == "notas_2024.csv").first()
            assert sheet is not None
            assert sheet.records_count == 2
            assert sheet.avg_grade == 8.5
            assert sheet.avg_attendance == 97.5

            records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == sheet.id).all()
            assert len(records) == 2
            assert {r.student_name for r in records} == {"Carlos Drumond", "Cecilia Meireles"}
        finally:
            db.close()

    def test_list_spreadsheets_returns_summary(self, professor_client):
        """Verifica que o endpoint de listagem de planilhas traz os metadados e os resumos agregados corretos."""
        # Criar duas planilhas fictícias no banco
        db = SessionLocal()
        try:
            prof = db.query(User).filter(User.username == f"testprof_sheet_{_uid}").first()
            
            sheet1 = HistoricalSpreadsheet(
                filename="planilha_db.xlsx",
                semester="2024-1",
                course_name="IA",
                records_count=10,
                avg_grade=7.0,
                avg_attendance=85.0,
                professor_id=prof.id
            )
            sheet2 = HistoricalSpreadsheet(
                filename="planilha_redes.xlsx",
                semester="2024-1",
                course_name="IA",
                records_count=20,
                avg_grade=8.0,
                avg_attendance=95.0,
                professor_id=prof.id
            )
            db.add_all([sheet1, sheet2])
            db.commit()
        finally:
            db.close()

        resp = professor_client.get("/api/historical-data/spreadsheets")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["spreadsheets"]) == 2
        
        # Verificar o resumo macro global (médias ponderadas)
        # Total de registros: 10 + 20 = 30
        # Média ponderada de nota: (7.0 * 10 + 8.0 * 20) / 30 = 7.67
        # Média ponderada de presença: (85.0 * 10 + 95.0 * 20) / 30 = 91.67
        summary = data["global_summary"]
        assert summary["total_spreadsheets"] == 2
        assert summary["total_records"] == 30
        assert summary["avg_grade"] == 7.67
        assert summary["avg_attendance"] == 91.67

    def test_delete_spreadsheet_cascades_records(self, professor_client):
        """Verifica que a deleção de uma planilha remove os registros de alunos correspondentes em cascata."""
        db = SessionLocal()
        try:
            prof = db.query(User).filter(User.username == f"testprof_sheet_{_uid}").first()
            
            sheet = HistoricalSpreadsheet(
                filename="remover.csv",
                semester="2024-1",
                course_name="Direito",
                records_count=1,
                avg_grade=6.0,
                avg_attendance=75.0,
                professor_id=prof.id
            )
            db.add(sheet)
            db.flush()

            record = HistoricalRecord(
                semester="2024-1",
                course_name="Direito",
                subject="Constitucional",
                period=1,
                student_name="Jose Maria",
                grades={"P1": 6.0},
                attendance=75.0,
                professor_id=prof.id,
                spreadsheet_id=sheet.id
            )
            db.add(record)
            db.commit()
            
            sheet_id = sheet.id
        finally:
            db.close()

        # Deletar planilha
        resp = professor_client.delete(f"/api/historical-data/spreadsheets/{sheet_id}")
        assert resp.status_code == 200
        
        # Verificar que ambos sumiram do banco
        db = SessionLocal()
        try:
            assert db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.id == sheet_id).first() is None
            assert db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == sheet_id).first() is None
        finally:
            db.close()
