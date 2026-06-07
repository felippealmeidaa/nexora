from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.professor import Professor, ProfessorCourse, ProfessorAcademicCourse
from app.models.course import Course
from app.routers.professors import _serialize_professor_courses, _get_selected_professor_course_ids

# Carregar models
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.models.attendance import Attendance
from app.models.coordinator import Coordinator
from app.models.scraped_data import ScrapedAttendance, ScrapedGrade, ScrapedSchedule, ScrapedSubject
from app.models.historical_data import HistoricalRecord
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.models.staff_code import StaffRegistrationCode

def debug_demo():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "professor.demo").first()
        if not user:
            print("Usuário professor.demo não encontrado.")
            return
            
        prof = db.query(Professor).filter(Professor.user_id == user.id).first()
        if not prof:
            print("Professor demo não encontrado.")
            return
            
        print(f"Professor ID: {prof.id}, Username: {user.username}, Name: {user.full_name}")
        
        ac_list = db.query(ProfessorAcademicCourse).filter(ProfessorAcademicCourse.professor_id == prof.id).all()
        courses_str = ", ".join([ac.course_name for ac in ac_list])
        print(f"Cursos Acadêmicos: {courses_str}")
        
        selected_ids = sorted(_get_selected_professor_course_ids(prof))
        print(f"IDs selecionados no banco: {selected_ids}")
        for cid in selected_ids:
            c = db.query(Course).filter(Course.id == cid).first()
            print(f"  - ID: {cid}, Code: {c.code if c else 'N/A'}, Name: {c.name if c else 'N/A'}")
            
        available_courses = _serialize_professor_courses(db, prof, user)
        available_ids = {c["id"] for c in available_courses if c.get("id")}
        print(f"IDs disponíveis: {sorted(list(available_ids))}")
        
        missing = [cid for cid in selected_ids if cid not in available_ids]
        if missing:
            print(f"--> ERRO: IDs {missing} estão selecionados mas não aparecem nas disponíveis!")
            for mid in missing:
                c = db.query(Course).filter(Course.id == mid).first()
                if c:
                    print(f"    - ID: {mid}, Code: {c.code}, Name: {c.name}")
        else:
            print("--> OK: Todos os IDs selecionados estão no escopo das disponíveis.")
            
    finally:
        db.close()

if __name__ == "__main__":
    debug_demo()
