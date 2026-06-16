"""add live professor data and coordinator approvals

Revision ID: 20260611_0004
Revises: 20260609_0003
Create Date: 2026-06-11 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260611_0004"
down_revision = "20260609_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "professor_live_classes" not in tables:
        op.create_table(
            "professor_live_classes",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("professor_user_id", sa.Integer(), nullable=False),
            sa.Column("professor_name", sa.String(length=200), nullable=False),
            sa.Column("external_class_code", sa.String(length=50), nullable=True),
            sa.Column("subject_name", sa.String(length=255), nullable=False),
            sa.Column("class_code", sa.String(length=100), nullable=True),
            sa.Column("academic_course_name", sa.String(length=255), nullable=True),
            sa.Column("period_label", sa.String(length=120), nullable=True),
            sa.Column("start_date_label", sa.String(length=40), nullable=True),
            sa.Column("end_date_label", sa.String(length=40), nullable=True),
            sa.Column("lessons_planned", sa.Integer(), nullable=True),
            sa.Column("lessons_given", sa.Integer(), nullable=True),
            sa.Column("vacancies", sa.Integer(), nullable=True),
            sa.Column("pre_enrolled", sa.Integer(), nullable=True),
            sa.Column("enrolled_count", sa.Integer(), nullable=True),
            sa.Column("cancelled_count", sa.Integer(), nullable=True),
            sa.Column("shift_label", sa.String(length=80), nullable=True),
            sa.Column("room_label", sa.String(length=255), nullable=True),
            sa.Column("unit_name", sa.String(length=255), nullable=True),
            sa.Column("physical_unit_name", sa.String(length=255), nullable=True),
            sa.Column("workload_label", sa.String(length=60), nullable=True),
            sa.Column("class_status", sa.String(length=80), nullable=True),
            sa.Column("detail_url", sa.Text(), nullable=True),
            sa.Column("synced_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["professor_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_professor_live_classes_id"), "professor_live_classes", ["id"], unique=False)
        op.create_index(op.f("ix_professor_live_classes_professor_user_id"), "professor_live_classes", ["professor_user_id"], unique=False)
        op.create_index(op.f("ix_professor_live_classes_external_class_code"), "professor_live_classes", ["external_class_code"], unique=False)
        op.create_index(op.f("ix_professor_live_classes_subject_name"), "professor_live_classes", ["subject_name"], unique=False)
        op.create_index(op.f("ix_professor_live_classes_class_code"), "professor_live_classes", ["class_code"], unique=False)
        op.create_index(op.f("ix_professor_live_classes_academic_course_name"), "professor_live_classes", ["academic_course_name"], unique=False)
        op.create_index(op.f("ix_professor_live_classes_period_label"), "professor_live_classes", ["period_label"], unique=False)

    if "professor_live_students" not in tables:
        op.create_table(
            "professor_live_students",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("live_class_id", sa.Integer(), nullable=False),
            sa.Column("professor_user_id", sa.Integer(), nullable=False),
            sa.Column("student_name", sa.String(length=255), nullable=False),
            sa.Column("student_code", sa.String(length=50), nullable=True),
            sa.Column("status_label", sa.String(length=80), nullable=True),
            sa.Column("academic_course_name", sa.String(length=255), nullable=True),
            sa.Column("va1", sa.Float(), nullable=True),
            sa.Column("va2", sa.Float(), nullable=True),
            sa.Column("va3", sa.Float(), nullable=True),
            sa.Column("attendance_percentage", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["live_class_id"], ["professor_live_classes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["professor_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_professor_live_students_id"), "professor_live_students", ["id"], unique=False)
        op.create_index(op.f("ix_professor_live_students_live_class_id"), "professor_live_students", ["live_class_id"], unique=False)
        op.create_index(op.f("ix_professor_live_students_professor_user_id"), "professor_live_students", ["professor_user_id"], unique=False)
        op.create_index(op.f("ix_professor_live_students_student_name"), "professor_live_students", ["student_name"], unique=False)
        op.create_index(op.f("ix_professor_live_students_student_code"), "professor_live_students", ["student_code"], unique=False)
        op.create_index(op.f("ix_professor_live_students_status_label"), "professor_live_students", ["status_label"], unique=False)
        op.create_index(op.f("ix_professor_live_students_academic_course_name"), "professor_live_students", ["academic_course_name"], unique=False)

    if "coordinator_approvals" not in tables:
        op.create_table(
            "coordinator_approvals",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("code", sa.String(length=20), nullable=False),
            sa.Column("full_name", sa.String(length=200), nullable=False),
            sa.Column("course_names", sa.JSON(), nullable=False),
            sa.Column("is_claimed", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("claimed_user_id", sa.Integer(), nullable=True),
            sa.Column("created_by_admin_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["claimed_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["created_by_admin_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_coordinator_approvals_id"), "coordinator_approvals", ["id"], unique=False)
        op.create_index(op.f("ix_coordinator_approvals_code"), "coordinator_approvals", ["code"], unique=True)

    professor_columns = {col["name"] for col in inspector.get_columns("professors")}
    with op.batch_alter_table("professors") as batch_op:
        if "lyceum_password" not in professor_columns:
            batch_op.add_column(sa.Column("lyceum_password", sa.String(length=255), nullable=True))
        if "last_portal_sync_at" not in professor_columns:
            batch_op.add_column(sa.Column("last_portal_sync_at", sa.DateTime(), nullable=True))
        if "portal_sync_status" not in professor_columns:
            batch_op.add_column(sa.Column("portal_sync_status", sa.String(length=30), nullable=False, server_default="idle"))
        if "portal_sync_error" not in professor_columns:
            batch_op.add_column(sa.Column("portal_sync_error", sa.String(length=500), nullable=True))

    coordinator_columns = {col["name"] for col in inspector.get_columns("coordinators")}
    if "course_names" not in coordinator_columns:
        with op.batch_alter_table("coordinators") as batch_op:
            batch_op.add_column(sa.Column("course_names", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("coordinators") as batch_op:
        batch_op.drop_column("course_names")

    with op.batch_alter_table("professors") as batch_op:
        batch_op.drop_column("portal_sync_error")
        batch_op.drop_column("portal_sync_status")
        batch_op.drop_column("last_portal_sync_at")
        batch_op.drop_column("lyceum_password")

    op.drop_index(op.f("ix_coordinator_approvals_code"), table_name="coordinator_approvals")
    op.drop_index(op.f("ix_coordinator_approvals_id"), table_name="coordinator_approvals")
    op.drop_table("coordinator_approvals")

    op.drop_index(op.f("ix_professor_live_students_academic_course_name"), table_name="professor_live_students")
    op.drop_index(op.f("ix_professor_live_students_status_label"), table_name="professor_live_students")
    op.drop_index(op.f("ix_professor_live_students_student_code"), table_name="professor_live_students")
    op.drop_index(op.f("ix_professor_live_students_student_name"), table_name="professor_live_students")
    op.drop_index(op.f("ix_professor_live_students_professor_user_id"), table_name="professor_live_students")
    op.drop_index(op.f("ix_professor_live_students_live_class_id"), table_name="professor_live_students")
    op.drop_index(op.f("ix_professor_live_students_id"), table_name="professor_live_students")
    op.drop_table("professor_live_students")

    op.drop_index(op.f("ix_professor_live_classes_period_label"), table_name="professor_live_classes")
    op.drop_index(op.f("ix_professor_live_classes_academic_course_name"), table_name="professor_live_classes")
    op.drop_index(op.f("ix_professor_live_classes_class_code"), table_name="professor_live_classes")
    op.drop_index(op.f("ix_professor_live_classes_subject_name"), table_name="professor_live_classes")
    op.drop_index(op.f("ix_professor_live_classes_external_class_code"), table_name="professor_live_classes")
    op.drop_index(op.f("ix_professor_live_classes_professor_user_id"), table_name="professor_live_classes")
    op.drop_index(op.f("ix_professor_live_classes_id"), table_name="professor_live_classes")
    op.drop_table("professor_live_classes")
