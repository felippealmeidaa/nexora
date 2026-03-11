"""
Ponto de entrada da aplicação FastAPI.

Configura middlewares, routers, servimento de arquivos estáticos
e eventos de ciclo de vida (criação de tabelas e seed).
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models.base import Base

# Importar todos os modelos para registrar no metadata
from app.models.student import Student  # noqa: F401
from app.models.course import Course  # noqa: F401
from app.models.enrollment import Enrollment  # noqa: F401
from app.models.grade import Grade  # noqa: F401
from app.models.attendance import Attendance  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.professor import Professor, ProfessorCourse, ProfessorAcademicCourse  # noqa: F401
from app.models.coordinator import Coordinator  # noqa: F401
from app.models.staff_code import StaffRegistrationCode, StaffRole  # noqa: F401
from app.models.scraped_data import (  # noqa: F401
    ScrapedGrade, ScrapedAttendance, ScrapedSubject, ScrapedSchedule,
)
from app.models.historical_data import HistoricalRecord  # noqa: F401

# Routers
from app.routers import (
    auth, students, courses, grades, attendance, 
    analytics, professors, historical_data, coordinators
)


def seed_staff_registration_codes(db):
    """Popula a tabela de códigos de matrícula fictícios se estiver vazia."""
    if db.query(StaffRegistrationCode).count() > 0:
        return  # Já populada

    codes = [
        # 3 Coordenadores
        StaffRegistrationCode(code="10001", role=StaffRole.COORDINATOR),
        StaffRegistrationCode(code="10002", role=StaffRole.COORDINATOR),
        StaffRegistrationCode(code="10003", role=StaffRole.COORDINATOR),
        # 10 Professores
        StaffRegistrationCode(code="20001", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20002", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20003", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20004", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20005", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20006", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20007", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20008", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20009", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20010", role=StaffRole.PROFESSOR),
    ]

    for code in codes:
        db.add(code)
    db.commit()
    print("✅ 13 códigos de matrícula fictícios cadastrados (3 coord + 10 prof).")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cria tabelas no banco e executa seed na inicialização."""
    Base.metadata.create_all(bind=engine)

    # Executar seed se banco estiver vazio
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        # Seed de códigos de matrícula (sempre verificar)
        seed_staff_registration_codes(db)

        # Seed do admin se não existir
        from app.models.user import UserRole
        from app.security.hashing import hash_password
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            admin_user = User(
                username="admin",
                full_name="Administrador SIMA",
                email="admin@sima.com",
                hashed_password=hash_password("admin123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            print("✅ Conta admin criada (admin@sima.com / admin123)")

        if db.query(Student).count() == 0:
            from seed.generate import seed_database
            seed_database(db)
            print("✅ Banco populado com dados de demonstração.")
        else:
            print("📊 Banco já possui dados.")
    finally:
        db.close()

    yield


# ── Aplicação FastAPI ──
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API para monitoramento e predição acadêmica com "
                "análise estatística, PCA, predição de evasão e recomendações.",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Registrar Routers ──
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(courses.router)
app.include_router(grades.router)
app.include_router(attendance.router)
app.include_router(analytics.router)
app.include_router(professors.router)
app.include_router(coordinators.router)
app.include_router(historical_data.router)

@app.get("/", tags=["Sistema"])
async def root():
    """Rota raiz da API."""
    return {
        "message": "Bem-vindo à API do SIMA. Acesse /docs para a documentação.",
        "version": settings.APP_VERSION,
        "docs_url": "/docs"
    }


@app.get("/health", tags=["Sistema"])
async def health_check():
    """Health check do sistema."""
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }