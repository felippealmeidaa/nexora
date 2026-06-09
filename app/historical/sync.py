"""
Sincronização de registros históricos com a base de dados principal e limpeza de dados.
"""
import re
import logging
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import delete

from app.models.student import Student, StudentStatus
from app.models.professor import Professor, ProfessorCourse, ProfessorAcademicCourse
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.grade import Grade, AssessmentType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.historical_data import HistoricalRecord
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.historical.utils import _normalize_text

logger = logging.getLogger(__name__)


def _sync_historical_to_main_db(db: Session, records_data: list[dict[str, Any]], user_id: int):
    """
    Sincroniza registros históricos recém-importados diretamente com as tabelas principais do banco de dados (Course, Student, Enrollment, Grade, Attendance, ProfessorCourse).
    Garante que todo o ecossistema do SIMA passe a dispor de dados verídicos e integrados de forma orgânica.
    """
    # 1. Carregar/Criar Professor
    professor = db.query(Professor).filter(Professor.user_id == user_id).first()
    if not professor:
        professor = Professor(user_id=user_id)
        db.add(professor)
        db.flush()

    # 2. Caches locais em dicionário para performance máxima em SQLite (evita gargalo de consultas N+1)
    courses_cache = {(c.name.strip().upper(), c.semester.strip()): c for c in db.query(Course).all()}
    students_cache = {s.name.strip().upper(): s for s in db.query(Student).all()}

    # 3. Conjuntos para controlar relações existentes do professor
    existing_prof_courses = {pc.course_id for pc in professor.professor_courses}
    existing_prof_academic = {pa.course_name.strip().upper() for pa in professor.academic_courses}

    # 4. Criar disciplinas (Course) inexistentes de forma atômica
    for record in records_data:
        subject = (record.get("subject") or "").strip()
        semester = (record.get("semester") or "Desconhecido").strip()
        if not subject:
            continue

        ckey = (subject.upper(), semester)
        if ckey not in courses_cache:
            cleaned_subj = re.sub(r'[^A-Z0-9]', '', subject.upper())[:6]
            cleaned_sem = re.sub(r'[^A-Z0-9]', '', semester.upper())[:6]
            h = abs(hash(subject + semester)) % 1000000
            code = f"{cleaned_subj}{cleaned_sem}{h}"[:20]

            course = Course(
                name=subject,
                code=code,
                credits=4,
                semester=semester,
                department=record.get("course_name", "Geral") or "Geral"
            )
            db.add(course)
            db.flush()
            courses_cache[ckey] = course

    # 5. Associar disciplinas e cursos acadêmicos ao professor logado (REMOVIDO para evitar poluição do perfil ativo)
    # Anteriormente o histórico associava automaticamente as disciplinas ao professor ativo.
    # Agora isso é controlado apenas via perfil/seleção manual de disciplinas reais.
    pass

    db.flush()

    # 6. Criar alunos (Student) inexistentes
    for record in records_data:
        student_name = (record.get("student_name") or "").strip()
        course_name = (record.get("course_name") or "").strip()
        period = record.get("period")
        student_code = record.get("student_code")
        if not student_name:
            continue

        skey = student_name.upper()
        if skey not in students_cache:
            h = abs(hash(student_name)) % 100000000

            # Se a planilha contiver matrícula real, usaremos ela; senão criamos código padrão visualizável
            reg_number = student_code if student_code else f"ALU-{h}"
            email = f"alu_{h}@sima.edu"

            student = Student(
                name=student_name,
                course_name=course_name or "Geral",
                current_period=period,
                email=email,
                registration_number=reg_number,
                enrollment_date=date.today(),
                status=StudentStatus.ACTIVE
            )
            db.add(student)
            db.flush()
            students_cache[skey] = student

    # 7. Matrículas (Enrollment)
    enrollments_cache = {(e.student_id, e.course_id): e for e in db.query(Enrollment).all()}

    for record in records_data:
        student_name = (record.get("student_name") or "").strip()
        subject = (record.get("subject") or "").strip()
        semester = (record.get("semester") or "Desconhecido").strip()
        if not student_name or not subject:
            continue

        student = students_cache.get(student_name.upper())
        course = courses_cache.get((subject.upper(), semester))
        if student and course:
            ekey = (student.id, course.id)
            if ekey not in enrollments_cache:
                enrollment = Enrollment(
                    student_id=student.id,
                    course_id=course.id,
                    semester=semester,
                    status=EnrollmentStatus.ENROLLED
                )
                db.add(enrollment)
                enrollments_cache[ekey] = enrollment

    db.flush()

    # 8. Limpar Notas (Grade) e Frequências (Attendance) antigas para evitar duplicidade de reimportações
    student_ids = [s.id for s in students_cache.values()]
    course_ids = [c.id for c in courses_cache.values()]

    if student_ids and course_ids:
        db.execute(
            delete(Grade).where(
                Grade.student_id.in_(student_ids),
                Grade.course_id.in_(course_ids)
            )
        )
        db.execute(
            delete(Attendance).where(
                Attendance.student_id.in_(student_ids),
                Attendance.course_id.in_(course_ids)
            )
        )

    db.flush()

    # 9. Inserir Notas e Presenças de forma massiva e otimizada (Bulk Insert)
    base_date = date.today() - timedelta(days=90)
    bulk_grades = []
    bulk_attendances = []

    # Se for planilha de grande porte (mais de 1.000 linhas), reduzimos a assiduidade diária operacional para 1 registro consolidado.
    # Isso evita gerar 8.8 milhões de linhas para 147.000 alunos no SQLite, acelerando a importação em mais de 100x.
    is_giant_file = len(records_data) > 1000
    total_lessons = 1 if is_giant_file else 60

    for record in records_data:
        student_name = (record.get("student_name") or "").strip()
        subject = (record.get("subject") or "").strip()
        semester = (record.get("semester") or "Desconhecido").strip()
        if not student_name or not subject:
            continue

        student = students_cache.get(student_name.upper())
        course = courses_cache.get((subject.upper(), semester))
        if student and course:
            # Lançar Notas principais
            grades_dict = record.get("grades") or {}
            for name_val, val in grades_dict.items():
                if name_val == "SITUACAO":
                    continue
                if val is not None:
                    try:
                        fval = float(val)
                        bulk_grades.append({
                            "student_id": student.id,
                            "course_id": course.id,
                            "value": fval,
                            "weight": 1.0,
                            "assessment_type": AssessmentType.EXAM,
                            "description": str(name_val)
                        })
                    except ValueError:
                        continue

            # Lançar Frequências
            attendance_pct = record.get("attendance")

            if attendance_pct is not None:
                try:
                    att_float = float(attendance_pct)
                    if att_float <= 1.0:
                        att_float = att_float * 100.0

                    if is_giant_file:
                        # Para planilhas gigantes, cria apenas 1 presença consolidada diária de status geral
                        status_val = AttendanceStatus.PRESENT if att_float >= 75.0 else AttendanceStatus.ABSENT
                        bulk_attendances.append({
                            "student_id": student.id,
                            "course_id": course.id,
                            "date": base_date,
                            "status": status_val
                        })
                    else:
                        absent_lessons = int(round(total_lessons * (1.0 - att_float / 100.0)))
                        absent_lessons = max(0, min(total_lessons, absent_lessons))
                        present_lessons = total_lessons - absent_lessons
                        for idx in range(total_lessons):
                            lesson_date = base_date + timedelta(days=idx)
                            status_val = AttendanceStatus.PRESENT if idx < present_lessons else AttendanceStatus.ABSENT
                            bulk_attendances.append({
                                "student_id": student.id,
                                "course_id": course.id,
                                "date": lesson_date,
                                "status": status_val
                            })
                except ValueError:
                    bulk_attendances.append({
                        "student_id": student.id,
                        "course_id": course.id,
                        "date": base_date,
                        "status": AttendanceStatus.PRESENT
                    })
            else:
                bulk_attendances.append({
                    "student_id": student.id,
                    "course_id": course.id,
                    "date": base_date,
                    "status": AttendanceStatus.PRESENT
                })

    # Executar inserções em lote otimizadas (Bulk Mappings em chunks)
    if bulk_grades:
        chunk_size = 10000
        for i in range(0, len(bulk_grades), chunk_size):
            db.bulk_insert_mappings(Grade, bulk_grades[i:i + chunk_size])
            db.flush()

    if bulk_attendances:
        chunk_size = 20000
        for i in range(0, len(bulk_attendances), chunk_size):
            db.bulk_insert_mappings(Attendance, bulk_attendances[i:i + chunk_size])
            db.flush()

    db.flush()


def _cleanup_main_db_for_spreadsheet(db: Session, spreadsheet: HistoricalSpreadsheet):
    """
    Remove da base de dados principal (Grade, Attendance, Enrollment, etc.) os dados gerados
    a partir da planilha que está sendo excluída, mantendo o banco de dados limpo e consistente.
    """
    try:
        # 1. Puxar todos os registros históricos associados à planilha
        records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == spreadsheet.id).all()
        if not records:
            return

        student_names = {r.student_name.strip().upper() for r in records if r.student_name}
        subjects = {r.subject.strip().upper() for r in records if r.subject}
        semesters = {r.semester.strip() for r in records if r.semester}

        if not student_names or not subjects:
            return

        # 2. Localizar os alunos e disciplinas correspondentes no banco principal
        students = db.query(Student).filter(Student.name.in_(student_names)).all()
        student_ids = [s.id for s in students]

        courses = db.query(Course).filter(
            Course.name.in_(subjects),
            Course.semester.in_(semesters)
        ).all()
        course_ids = [c.id for c in courses]

        if not student_ids or not course_ids:
            return

        # 3. Remover notas (Grade) e presenças (Attendance) correspondentes
        db.execute(
            delete(Grade).where(
                Grade.student_id.in_(student_ids),
                Grade.course_id.in_(course_ids)
            )
        )
        db.execute(
            delete(Attendance).where(
                Attendance.student_id.in_(student_ids),
                Attendance.course_id.in_(course_ids)
            )
        )

        # 4. Remover matrículas (Enrollment) correspondentes
        db.execute(
            delete(Enrollment).where(
                Enrollment.student_id.in_(student_ids),
                Enrollment.course_id.in_(course_ids)
            )
        )

        db.flush()

        # 5. Limpar estudantes cujos e-mails sejam do domínio sima.edu fictício
        # e que não tenham mais nenhuma matrícula ativa no sistema
        for student in students:
            if student.email and student.email.endswith("@sima.edu"):
                enrollment_count = db.query(Enrollment).filter(Enrollment.student_id == student.id).count()
                if enrollment_count == 0:
                    db.delete(student)

        # 6. Limpar disciplinas (Course) fictícias que não tenham mais nenhuma matrícula ativa
        for course in courses:
            enrollment_count = db.query(Enrollment).filter(Enrollment.course_id == course.id).count()
            if enrollment_count == 0:
                # Remover associações de professor
                db.execute(
                    delete(ProfessorCourse).where(ProfessorCourse.course_id == course.id)
                )
                db.delete(course)

        db.flush()
    except Exception as cleanup_exc:
        logger.error("Erro ao limpar dados principais da planilha excluida: %s", cleanup_exc, exc_info=True)
