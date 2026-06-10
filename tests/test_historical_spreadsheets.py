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


def _generate_test_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    elements = []
    elements.append(Paragraph("Relatorio de Notas de Alunos", styles["Title"]))
    elements.append(Paragraph("Curso: Ciencia da Computacao", styles["Normal"]))
    elements.append(Paragraph("Disciplina: Estrutura de Dados", styles["Normal"]))
    elements.append(Paragraph("Semestre Letivo: 2024-1", styles["Normal"]))
    
    data = [
        ["aluno", "sem_letivo", "curso", "disciplina", "periodo", "nota", "frequencia"],
        ["Carlos Drumond", "2024-1", "Ciencia da Computacao", "Estrutura de Dados", "2", "8.0", "95.0"],
        ["Cecilia Meireles", "2024-1", "Ciencia da Computacao", "Estrutura de Dados", "2", "9.0", "100.0"]
    ]
    
    t = Table(data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), '#cccccc'),
        ('GRID', (0,0), (-1,-1), 1, '#000000'),
    ]))
    elements.append(t)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


class TestPDFSpreadsheetUpload:
    def test_upload_pdf_creates_spreadsheet_and_records(self, professor_client):
        """Verifica que o upload de um PDF com tabela cria o registro da planilha e associa os alunos."""
        pdf_data = _generate_test_pdf()
        
        file_payload = {
            "file": ("notas_2024.pdf", io.BytesIO(pdf_data), "application/pdf")
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
            sheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.filename == "notas_2024.pdf").first()
            assert sheet is not None
            assert sheet.records_count == 2
            assert sheet.avg_grade == 8.5
            assert sheet.avg_attendance == 97.5

            records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == sheet.id).all()
            assert len(records) == 2
            assert {r.student_name for r in records} == {"Carlos Drumond", "Cecilia Meireles"}
        finally:
            db.close()

    def test_upload_pdf_fallback_regex(self, professor_client):
        """Verifica o parsing de PDF de fallback via regex local para textos sem bordas explícitas de tabelas."""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        elements = []
        elements.append(Paragraph("Boletim Geral de Notas", styles["Title"]))
        elements.append(Paragraph("Curso: Engenharia de Software", styles["Normal"]))
        elements.append(Paragraph("Disciplina: Analise de Sistemas", styles["Normal"]))
        elements.append(Paragraph("Semestre: 2024-2", styles["Normal"]))
        elements.append(Paragraph("12345 Joao da Silva 8.5 90% Aprovado", styles["Normal"]))
        elements.append(Paragraph("67890 Maria Oliveira 7.0 85% Aprovado", styles["Normal"]))
        elements.append(Paragraph("11121 Pedro Santos 5.0 60% Reprovado", styles["Normal"]))
        
        doc.build(elements)
        pdf_data = buffer.getvalue()
        
        file_payload = {
            "file": ("boletim_software.pdf", io.BytesIO(pdf_data), "application/pdf")
        }

        resp = professor_client.post("/api/historical-data/upload", files=file_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["records_count"] == 3
        assert data["semester"] == "2024-2"
        
        # Verificar no banco se a planilha e registros foram salvos
        db = SessionLocal()
        try:
            sheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.filename == "boletim_software.pdf").first()
            assert sheet is not None
            assert sheet.records_count == 3
            # Médias: (8.5 + 7.0 + 5.0) / 3 = 6.83
            assert abs(sheet.avg_grade - 6.83) < 0.05
            # Frequência: (90.0 + 85.0 + 60.0) / 3 = 78.33
            assert abs(sheet.avg_attendance - 78.33) < 0.05
            
            records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == sheet.id).all()
            assert len(records) == 3
            assert {r.student_name for r in records} == {"Joao da Silva", "Maria Oliveira", "Pedro Santos"}
        finally:
            db.close()


class TestIncompleteSpreadsheet:
    def test_upload_incomplete_spreadsheet_triggers_prediction(self, professor_client):
        """Verifica que o upload de uma planilha com notas incompletas define is_completed = False, gera notas projetadas para VA3, frequência e situação final."""
        csv_data = (
            "aluno,sem_letivo,curso,disciplina,periodo,nota,frequencia,va1,va2\n"
            "Carlos Drumond,2024-1,Ciencia da Computacao,Estrutura de Dados,2,8.0,95.0,7.0,8.0\n"
            "Cecilia Meireles,2024-1,Ciencia da Computacao,Estrutura de Dados,2,9.0,100.0,9.0,9.5\n"
        )

        file_payload = {
            "file": ("notas_incompletas_2024.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
        }

        # Executar upload
        resp = professor_client.post("/api/historical-data/upload", files=file_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["course_organized"] is True

        # Verificar no banco se a planilha foi salva com is_completed = False
        db = SessionLocal()
        try:
            sheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.filename == "notas_incompletas_2024.csv").first()
            assert sheet is not None
            assert sheet.is_completed is False

            records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == sheet.id).all()
            assert len(records) == 2

            # Verificar se em records temos a chave "VA3 (Projetada) ✨"
            for r in records:
                assert "VA3 (Projetada) ✨" in r.grades
                val = r.grades["VA3 (Projetada) ✨"]
                assert isinstance(val, (int, float))
                assert 0.0 <= val <= 10.0

                # Verificar se a frequência foi salva e a situação foi estimada
                assert r.attendance is not None
                assert 0.0 <= r.attendance <= 100.0
                assert "SITUACAO" in r.grades
                assert any(term in r.grades["SITUACAO"] for term in ["Provável", "Aprovação", "Reprovação"])
        finally:
            db.close()

    def test_upload_recursively_missing_grades(self, professor_client):
        """Verifica que o upload de uma planilha onde falta VA2 e VA3 estima ambas de forma encadeada."""
        csv_data = (
            "aluno,sem_letivo,curso,disciplina,periodo,nota,frequencia,va1\n"
            "Machado de Assis,2024-1,Ciencia da Computacao,Estrutura de Dados,2,7.0,85.0,7.5\n"
        )
        file_payload = {
            "file": ("notas_recursivas_2024.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
        }

        # Executar upload
        resp = professor_client.post("/api/historical-data/upload", files=file_payload)
        assert resp.status_code == 200

        db = SessionLocal()
        try:
            sheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.filename == "notas_recursivas_2024.csv").first()
            assert sheet is not None
            assert sheet.is_completed is False

            records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == sheet.id).all()
            assert len(records) == 1
            r = records[0]

            # Verificar se estimou a VA2 e VA3 projetadas
            assert "VA2 (Projetada) ✨" in r.grades
            assert "VA3 (Projetada) ✨" in r.grades
            assert r.grades["VA2 (Projetada) ✨"] > 0
            assert r.grades["VA3 (Projetada) ✨"] > 0
            assert "SITUACAO" in r.grades
        finally:
            db.close()

    def test_analysis_workspace_calculates_projected_stats(self, professor_client):
        """Verifica se o endpoint do workspace de análises expõe is_projected e a contagem de riscos preventivos."""
        # 1. Primeiro realizar upload de uma planilha incompleta para gerar dados de teste
        csv_data = (
            "aluno,sem_letivo,curso,disciplina,periodo,nota,frequencia,va1,va2\n"
            "Carlos Drumond,2024-1,Ciencia da Computacao,Estrutura de Dados,2,8.0,95.0,4.0,5.0\n"
            "Cecilia Meireles,2024-1,Ciencia da Computacao,Estrutura de Dados,2,9.0,100.0,9.0,9.5\n"
        )
        file_payload = {
            "file": ("notas_workspace_proj_2024.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
        }
        resp = professor_client.post("/api/historical-data/upload", files=file_payload)
        assert resp.status_code == 200

        db = SessionLocal()
        try:
            sheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.filename == "notas_workspace_proj_2024.csv").first()
            assert sheet is not None
            assert sheet.is_completed is False

            # 2. Consultar o workspace de análises para essa planilha específica
            resp_workspace = professor_client.get(f"/api/historical-data/analysis-workspace?spreadsheet_id={sheet.id}")
            assert resp_workspace.status_code == 200
            w_data = resp_workspace.json()

            # 3. Validar se contem is_projected = True e preventive_risk_count >= 0 no overview
            assert "overview" in w_data
            assert w_data["overview"]["is_projected"] is True
            assert "preventive_risk_count" in w_data["overview"]
            assert isinstance(w_data["overview"]["preventive_risk_count"], int)
        finally:
            db.close()

    def test_grades_scenario_simulation(self, professor_client):
        """Verifica se o endpoint /simulate calcula corretamente a simulação preditiva."""
        # Simular notas para um estudante sem perfil persistido
        payload = {
            "student_name": "Machado de Assis Simulado",
            "grades": {"VA1": 5.0, "VA2": 6.0},
            "attendance": 80.0
        }

        resp = professor_client.post("/api/historical-data/simulate", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["student_name"] == "Machado de Assis Simulado"
        assert "simulated_grades" in data
        assert "VA3 (Projetada) ✨" in data["simulated_grades"]
        assert "simulated_average" in data
        assert isinstance(data["simulated_average"], float)
        assert "simulated_situation" in data

    def test_generate_spreadsheet_ai_analysis(self, professor_client):
        """Testa o endpoint POST /api/historical-data/spreadsheets/{id}/ai-analysis."""
        from unittest.mock import patch, PropertyMock
        with patch("app.services.gemini_service.GeminiInsightsService.is_available", new_callable=PropertyMock) as mock_avail:
            mock_avail.return_value = False

            # 1. Primeiro realizar upload de uma planilha de teste para gerar dados
            csv_data = (
                "aluno,sem_letivo,curso,disciplina,periodo,nota,frequencia\n"
                "Carlos Drumond,2024-1,Ciencia da Computacao,Estrutura de Dados,2,4.0,70.0\n"
                "Cecilia Meireles,2024-1,Ciencia da Computacao,Estrutura de Dados,2,9.0,100.0\n"
                "João Cabral,2024-1,Ciencia da Computacao,Estrutura de Dados,2,5.5,90.0\n"
            )
            file_payload = {
                "file": ("notas_analise_ia.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
            }
            resp = professor_client.post("/api/historical-data/upload", files=file_payload)
            assert resp.status_code == 200
            sheet_id = resp.json()["spreadsheet_id"]

            # 2. Chamar o endpoint de ai-analysis
            resp_analysis = professor_client.post(f"/api/historical-data/spreadsheets/{sheet_id}/ai-analysis")
            assert resp_analysis.status_code == 200
            data = resp_analysis.json()
            assert data["success"] is True
            assert "analysis_report" in data
            report = data["analysis_report"]

            # Validar se o fallback local gerou a tabela e o template de engajamento
            assert "Distribuição Preventiva Estimada da Turma" in report
            assert "Aprovação Provável" in report
            assert "Risco por Falta" in report or "Risco Crítico" in report
            assert "Template de Engajamento Coletivo" in report
            assert "Seu Professor" in report

    def test_generate_spreadsheet_ai_insights(self, professor_client):
        """Testa o endpoint POST /api/historical-data/spreadsheets/{id}/ai-insights."""
        from unittest.mock import patch, PropertyMock
        with patch("app.services.gemini_service.GeminiInsightsService.is_available", new_callable=PropertyMock) as mock_avail:
            mock_avail.return_value = False

            # 1. Primeiro realizar upload de uma planilha de teste para gerar dados
            csv_data = (
                "aluno,sem_letivo,curso,disciplina,periodo,nota,frequencia\n"
                "Carlos Drumond,2024-1,Ciencia da Computacao,Estrutura de Dados,2,4.0,70.0\n"
                "Cecilia Meireles,2024-1,Ciencia da Computacao,Estrutura de Dados,2,9.0,100.0\n"
                "João Cabral,2024-1,Ciencia da Computacao,Estrutura de Dados,2,5.5,90.0\n"
            )
            file_payload = {
                "file": ("notas_insights_ia.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
            }
            resp = professor_client.post("/api/historical-data/upload", files=file_payload)
            assert resp.status_code == 200
            sheet_id = resp.json()["spreadsheet_id"]

            # 2. Chamar o endpoint de ai-insights
            resp_insights = professor_client.post(f"/api/historical-data/spreadsheets/{sheet_id}/ai-insights")
            assert resp_insights.status_code == 200
            data = resp_insights.json()
            assert data["success"] is True
            assert "insights" in data
            insights = data["insights"]

            # Validar se o fallback local gerou a tabela de distribuição preventiva e o template
            assert "Distribuição Preventiva Estimada da Turma" in insights
            assert "Aprovação Provável" in insights
            assert "Risco por Falta" in insights or "Risco Crítico" in insights
            assert "Template de Engajamento Coletivo" in insights


