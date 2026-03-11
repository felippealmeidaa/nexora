"""
Módulo de conexão com o banco de dados.
Configura o engine SQLAlchemy e a fábrica de sessões.
"""

from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

# Engine SQLAlchemy — connect_args necessário para SQLite
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=settings.DEBUG,
)


# Habilita foreign keys no SQLite
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn: object, connection_record: object) -> None:
    cursor = dbapi_conn.cursor()  # type: ignore[union-attr]
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency para injeção de sessão do banco nos endpoints FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
