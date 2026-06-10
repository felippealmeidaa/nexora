"""
Script utilitário para migração de dados de SQLite para PostgreSQL.

Este script lê todos os registros do banco de dados SQLite local (academico.db)
e os insere no banco PostgreSQL configurado no arquivo .env (settings.DATABASE_URL),
preservando todas as chaves estrangeiras e integridade referencial.
"""

import logging
from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.orm import sessionmaker

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

# Ordem correta de inserção de dados para respeitar restrições de chaves estrangeiras
TABLE_ORDER = [
    "users",
    "staff_registration_codes",
    "students",
    "professors",
    "coordinators",
    "courses",
    "enrollments",
    "grades",
    "attendances",
    "scraped_grades",
    "scraped_attendance",  # nome da tabela mapeada no SQLAlchemy
    "scraped_subjects",
    "scraped_schedule",
    "historical_spreadsheets",
    "historical_records",
    "user_sessions",
    "login_attempts",
    "coordinator_courses",
    "professor_courses",
    "professor_academic_courses",
]

def migrate_data():
    sqlite_url = "sqlite:///./academico.db"
    postgres_url = settings.DATABASE_URL

    if not postgres_url.startswith("postgresql"):
        logger.error("DATABASE_URL configurado não é PostgreSQL. Abortando migração.")
        return

    logger.info("Iniciando migração de dados de SQLite para PostgreSQL...")
    logger.info(f"Origem (SQLite): {sqlite_url}")
    logger.info(f"Destino (PostgreSQL): {postgres_url}")

    sqlite_engine = create_engine(sqlite_url)
    postgres_engine = create_engine(postgres_url)

    sqlite_metadata = MetaData()
    sqlite_metadata.reflect(bind=sqlite_engine)

    postgres_metadata = MetaData()
    postgres_metadata.reflect(bind=postgres_engine)

    # Criar sessões
    SqliteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)

    sqlite_session = SqliteSession()
    postgres_session = PostgresSession()

    try:
        # 1. Desabilitar triggers/constraints temporariamente se necessário, 
        # mas faremos a inserção na ordem TABLE_ORDER para respeitar chaves estrangeiras.
        for table_name in TABLE_ORDER:
            if table_name not in sqlite_metadata.tables:
                logger.warning(f"Tabela '{table_name}' não encontrada no SQLite. Pulando...")
                continue
            
            if table_name not in postgres_metadata.tables:
                logger.error(f"Tabela '{table_name}' não existe no PostgreSQL. Execute as migrações Alembic primeiro.")
                continue

            sqlite_table = Table(table_name, sqlite_metadata, autoload_with=sqlite_engine)
            postgres_table = Table(table_name, postgres_metadata, autoload_with=postgres_engine)

            # Verificar se já existem dados no PostgreSQL para esta tabela
            count_pg = postgres_session.query(postgres_table).count()
            if count_pg > 0:
                logger.info(f"Tabela '{table_name}' já contém {count_pg} registros no PostgreSQL. Pulando cópia para evitar duplicados.")
                continue

            # Ler registros do SQLite
            records = sqlite_session.query(sqlite_table).all()
            if not records:
                logger.info(f"Tabela '{table_name}' está vazia no SQLite. Nada a migrar.")
                continue

            logger.info(f"Copiando {len(records)} registros da tabela '{table_name}'...")
            
            # Converter linhas do SQLAlchemy em dicionários compatíveis para inserção em lote
            insert_data = []
            for record in records:
                # O record._asdict() ou similar retorna os campos da linha
                row_dict = record._asdict() if hasattr(record, "_asdict") else dict(record._mapping)
                insert_data.append(row_dict)

            # Bulk insert no PostgreSQL
            postgres_engine.execute(postgres_table.insert(), insert_data)
            logger.info(f"Tabela '{table_name}' migrada com sucesso!")

        postgres_session.commit()
        logger.info("Migração concluída com sucesso!")

    except Exception as e:
        postgres_session.rollback()
        logger.error(f"Erro durante a migração: {e}", exc_info=True)
    finally:
        sqlite_session.close()
        postgres_session.close()

if __name__ == "__main__":
    migrate_data()
