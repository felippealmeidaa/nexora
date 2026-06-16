from __future__ import annotations

import sqlite3
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "academico.db"

TABLES_TO_CLEAR = [
    "user_sessions",
    "login_attempts",
    "coordinator_courses",
    "coordinator_approvals",
    "coordinators",
    "professor_live_students",
    "professor_live_classes",
    "historical_spreadsheets",
    "historical_records",
    "scraped_schedule",
    "scraped_subjects",
    "scraped_attendance",
    "scraped_grades",
    "attendances",
    "grades",
    "enrollments",
    "professor_academic_courses",
    "professor_courses",
    "professors",
    "students",
    "courses",
    "staff_registration_codes",
]


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Banco nao encontrado em: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        cur = conn.cursor()
        existing_tables = {
            row["name"]
            for row in cur.execute("select name from sqlite_master where type = 'table'")
        }

        if "users" not in existing_tables:
            raise SystemExit("Tabela users nao encontrada; reset abortado.")

        admin_rows = cur.execute(
            "select id, username from users where lower(username) = 'admin'"
        ).fetchall()
        if not admin_rows:
            raise SystemExit("Nenhum usuario 'admin' encontrado; reset abortado para evitar perda total de acesso.")

        total_users_before = cur.execute("select count(*) from users").fetchone()[0]
        keep_user_ids = [row["id"] for row in admin_rows]

        cur.execute("PRAGMA foreign_keys = OFF")

        deleted_tables: list[str] = []
        for table_name in TABLES_TO_CLEAR:
            if table_name not in existing_tables:
                continue
            cur.execute(f"delete from {table_name}")
            deleted_tables.append(table_name)

        placeholders = ",".join("?" for _ in keep_user_ids)
        cur.execute(
            f"delete from users where id not in ({placeholders})",
            keep_user_ids,
        )

        if "sqlite_sequence" in existing_tables:
            reset_targets = [table for table in TABLES_TO_CLEAR if table in existing_tables]
            reset_targets.append("users")
            for table_name in reset_targets:
                cur.execute("delete from sqlite_sequence where name = ?", (table_name,))

        conn.commit()

        cur.execute("PRAGMA foreign_keys = ON")
        conn.commit()

        conn.isolation_level = None
        cur.execute("VACUUM")
        conn.isolation_level = ""

        total_users_after = cur.execute("select count(*) from users").fetchone()[0]
        remaining_users = cur.execute(
            "select id, username, role from users order by id"
        ).fetchall()

        print(f"Banco limpo com sucesso: {DB_PATH}")
        print(f"Tabelas limpas: {', '.join(deleted_tables) if deleted_tables else 'nenhuma tabela alvo encontrada'}")
        print(f"Usuarios antes: {total_users_before}")
        print(f"Usuarios depois: {total_users_after}")
        print("Usuarios preservados:")
        for row in remaining_users:
            print(f" - id={row['id']} username={row['username']} role={row['role']}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
