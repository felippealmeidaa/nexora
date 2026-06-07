import sqlite3
import os
from app.database import SessionLocal
from app.models.professor import ProfessorAcademicCourse, ProfessorCourse
from app.models.historical_data import HistoricalRecord
from app.models.course import Course
from app.services.historical_analysis_service import HistoricalAnalysisService

# Importar outros models para o SQLAlchemy carregar mappers
from app.models.user import User
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.attendance import Attendance
from app.models.coordinator import Coordinator
from app.models.scraped_data import ScrapedAttendance, ScrapedGrade, ScrapedSchedule, ScrapedSubject
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.models.staff_code import StaffRegistrationCode

def cleanup():
    db = SessionLocal()
    try:
        print("=== INICIANDO LIMPEZA DO BANCO DE DADOS ===")
        
        # 1. Deletar do ProfessorAcademicCourse
        deleted_ac = db.query(ProfessorAcademicCourse).filter(
            ProfessorAcademicCourse.course_name.in_(["Engenharia de Software", "Eng. de Software"])
        ).delete(synchronize_session=False)
        print(f"Deletados {deleted_ac} cursos acadêmicos de perfil de professores.")
        
        # 2. Encontrar os IDs dos cursos (disciplinas) que contêm Metodologia do Trabalho Científico ou Engenharia de Software
        bad_courses = db.query(Course).filter(
            (Course.name.like("%METODOLOGIA DO TRABALHO CIENTÍFICO%")) |
            (Course.name.like("%ENGENHARIA DE SOFTWARE%")) |
            (Course.name == "Eng. de Software")
        ).all()
        
        bad_course_ids = [c.id for c in bad_courses if c.id]
        bad_course_names = [c.name for c in bad_courses if c.name]
        print(f"Disciplinas identificadas para remoção do escopo: {bad_course_names}")
        
        if bad_course_ids:
            # Remover dos ProfessorCourse (disciplinas selecionadas)
            deleted_pc = db.query(ProfessorCourse).filter(
                ProfessorCourse.course_id.in_(bad_course_ids)
            ).delete(synchronize_session=False)
            print(f"Removidas {deleted_pc} disciplinas selecionadas por professores.")
            
        # 3. Remover dos registros históricos (HistoricalRecord)
        deleted_hr = db.query(HistoricalRecord).filter(
            (HistoricalRecord.course_name.in_(["Engenharia de Software", "Eng. de Software"])) |
            (HistoricalRecord.subject.in_(["Eng. de Software", "Metodologia", "Metodologia do Trabalho Cientifico"]))
        ).delete(synchronize_session=False)
        print(f"Deletados {deleted_hr} registros históricos associados a Engenharia de Software / Metodologia.")
        
        # 4. Limpar cache de análises históricas
        HistoricalAnalysisService.clear_workspace_cache()
        print("Cache de workspaces limpo com sucesso.")
        
        db.commit()
        print("=== LIMPEZA CONCLUÍDA E ALTERAÇÕES SALVAS ===")
    except Exception as e:
        db.rollback()
        print(f"Erro na limpeza: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
