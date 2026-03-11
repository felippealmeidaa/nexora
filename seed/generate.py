"""
Gerador de dados sintéticos realistas para demonstração.

Cria ~80 alunos, 12 disciplinas, notas e frequências com
distribuições variadas para demonstrar todas as funcionalidades
analíticas do sistema.
"""

import random
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.grade import Grade, AssessmentType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.user import User, UserRole
from app.security.hashing import hash_password


# Nomes brasileiros para seed
FIRST_NAMES = [
    "Ana", "Bruno", "Carla", "Daniel", "Elena", "Felipe", "Gabriela",
    "Henrique", "Isabela", "João", "Karen", "Lucas", "Marina", "Nicolas",
    "Olivia", "Pedro", "Raquel", "Samuel", "Tatiana", "Victor",
    "Amanda", "Bernardo", "Cecília", "Diego", "Fernanda", "Gustavo",
    "Helena", "Igor", "Juliana", "Kevin", "Laura", "Mateus", "Natália",
    "Oscar", "Patrícia", "Rafael", "Sofia", "Thiago", "Valentina", "Wesley",
]

LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira",
    "Almeida", "Nascimento", "Lima", "Araújo", "Fernandes", "Barros",
    "Ribeiro", "Martins", "Carvalho", "Gomes", "Rocha", "Pereira",
    "Costa", "Moreira",
]

COURSES_DATA = [
    ("Cálculo I", "MAT101", 6, "Matemática"),
    ("Cálculo II", "MAT201", 6, "Matemática"),
    ("Álgebra Linear", "MAT102", 4, "Matemática"),
    ("Estatística", "MAT301", 4, "Matemática"),
    ("Programação I", "CMP101", 4, "Computação"),
    ("Programação II", "CMP201", 4, "Computação"),
    ("Banco de Dados", "CMP301", 4, "Computação"),
    ("Redes de Computadores", "CMP302", 4, "Computação"),
    ("Eng. de Software", "CMP401", 4, "Computação"),
    ("Física I", "FIS101", 4, "Física"),
    ("Física II", "FIS201", 4, "Física"),
    ("Inteligência Artificial", "CMP501", 4, "Computação"),
]


def seed_database(db: Session):
    """Popula o banco com dados sintéticos para demonstração."""

    random.seed(42)  # Reprodutibilidade

    # ── 1. Criar usuário admin ──
    admin = User(
        username="admin",
        full_name="Administrador do Sistema",
        email="admin@universidade.edu.br",
        hashed_password=hash_password("admin123"),
        role=UserRole.ADMIN,
    )
    coordinator = User(
        username="coordenador",
        full_name="Maria Coordenadora",
        email="coordenacao@universidade.edu.br",
        hashed_password=hash_password("coord123"),
        role=UserRole.COORDINATOR,
    )
    professor = User(
        username="professor",
        full_name="José Professor",
        email="professor@universidade.edu.br",
        hashed_password=hash_password("prof123"),
        role=UserRole.PROFESSOR,
    )
    db.add_all([admin, coordinator, professor])
    db.flush()

    # ── 2. Criar disciplinas ──
    courses = []
    for name, code, credits, dept in COURSES_DATA:
        course = Course(
            name=name,
            code=code,
            credits=credits,
            semester="2025.1",
            department=dept,
        )
        courses.append(course)
    db.add_all(courses)
    db.flush()

    # ── 3. Criar alunos (~80) ──
    students = []
    used_names = set()
    for i in range(80):
        while True:
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"
            if full_name not in used_names:
                used_names.add(full_name)
                break

        reg_num = f"2024{i + 1:04d}"
        email = f"{first.lower()}.{last.lower()}{i}@aluno.edu.br"
        enroll_date = date(2024, 2, 1) + timedelta(days=random.randint(0, 30))

        # 10% inativos, 5% graduados
        r = random.random()
        if r < 0.10:
            status = StudentStatus.INACTIVE
        elif r < 0.15:
            status = StudentStatus.GRADUATED
        else:
            status = StudentStatus.ACTIVE

        student = Student(
            name=full_name,
            registration_number=reg_num,
            email=email,
            enrollment_date=enroll_date,
            status=status,
        )
        students.append(student)
    db.add_all(students)
    db.flush()

    # ── Perfis de aluno para gerar dados realistas ──
    # Distribui alunos em perfis de desempenho
    profiles = {
        "excellent": 0.15,   # 15% - GPA 8-10, frequência > 90%
        "good": 0.35,        # 35% - GPA 6-8, frequência 75-90%
        "average": 0.25,     # 25% - GPA 5-6.5, frequência 65-80%
        "struggling": 0.15,  # 15% - GPA 3-5, frequência 50-70%
        "at_risk": 0.10,     # 10% - GPA < 3, frequência < 50%
    }

    def get_profile(idx: int) -> str:
        r = idx / len(students)
        cumulative = 0
        for profile, pct in profiles.items():
            cumulative += pct
            if r < cumulative:
                return profile
        return "average"

    def grade_for_profile(profile: str) -> float:
        ranges = {
            "excellent": (8.0, 10.0),
            "good": (6.0, 8.5),
            "average": (4.5, 7.0),
            "struggling": (2.5, 5.5),
            "at_risk": (0.5, 3.5),
        }
        low, high = ranges[profile]
        return round(random.uniform(low, high), 1)

    def attendance_for_profile(profile: str) -> AttendanceStatus:
        absent_prob = {
            "excellent": 0.05,
            "good": 0.12,
            "average": 0.22,
            "struggling": 0.35,
            "at_risk": 0.55,
        }
        if random.random() < absent_prob[profile]:
            return AttendanceStatus.ABSENT
        elif random.random() < 0.05:
            return AttendanceStatus.LATE
        elif random.random() < 0.03:
            return AttendanceStatus.JUSTIFIED
        return AttendanceStatus.PRESENT

    # ── 4. Matrículas, notas e frequências ──
    assessment_types = list(AssessmentType)

    for idx, student in enumerate(students):
        if student.status != StudentStatus.ACTIVE:
            continue

        profile = get_profile(idx)
        # Cada aluno se matricula em 4-6 disciplinas
        n_courses = random.randint(4, 6)
        enrolled_courses = random.sample(courses, min(n_courses, len(courses)))

        for course in enrolled_courses:
            # Enrollment
            enroll_status = EnrollmentStatus.ENROLLED
            enrollment = Enrollment(
                student_id=student.id,
                course_id=course.id,
                semester="2025.1",
                status=enroll_status,
            )
            db.add(enrollment)

            # 3-4 notas por disciplina (provas + trabalhos)
            for j in range(random.randint(3, 4)):
                grade_val = grade_for_profile(profile)
                grade = Grade(
                    student_id=student.id,
                    course_id=course.id,
                    value=grade_val,
                    weight=0.3 if j < 2 else 0.2,
                    assessment_type=assessment_types[j % len(assessment_types)],
                    description=f"Avaliação {j + 1}",
                )
                db.add(grade)

            # Frequências (30 aulas por disciplina)
            base_date = date(2025, 2, 10)
            for day in range(30):
                att_date = base_date + timedelta(days=day * 2 + random.randint(0, 1))
                att_status = attendance_for_profile(profile)
                att = Attendance(
                    student_id=student.id,
                    course_id=course.id,
                    date=att_date,
                    status=att_status,
                )
                db.add(att)

    db.commit()
    print(f"📚 Seed concluído: {len(students)} alunos, {len(courses)} disciplinas")
