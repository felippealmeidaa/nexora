"""
Serialização de HistoricalRecord e extração de grades/status para dados históricos.
"""
from typing import Any

from app.models.historical_data import HistoricalRecord
from app.models.student import Student
from app.historical.utils import _coerce_grade


def _extract_status_label(grades: dict[str, Any]) -> str | None:
    for key, value in (grades or {}).items():
        key_name = str(key).strip().lower()
        if "situacao" in key_name or "status" in key_name or "resultado" in key_name:
            return str(value)
    return None


def _extract_numeric_grade_summary(grades: dict[str, Any]) -> tuple[float | None, list[dict[str, float]]]:
    numeric_items: list[dict[str, float]] = []

    for key, value in (grades or {}).items():
        key_name = str(key).strip().lower()
        if "situacao" in key_name or "status" in key_name or "resultado" in key_name:
            continue

        numeric_value = _coerce_grade(value)
        if numeric_value is None:
            continue

        numeric_items.append({"label": str(key), "value": round(numeric_value, 2)})

    if not numeric_items:
        return None, []

    average = round(sum(item["value"] for item in numeric_items) / len(numeric_items), 2)
    return average, numeric_items[:4]


def _format_student_enum(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _serialize_historical_record(record: HistoricalRecord, matched_student: Student | None) -> dict[str, Any]:
    grade_average, grade_items = _extract_numeric_grade_summary(record.grades or {})
    status_label = _extract_status_label(record.grades or {})
    schedule = _format_student_enum(getattr(matched_student, "class_schedule", None))
    student_status = _format_student_enum(getattr(matched_student, "status", None))

    return {
        "id": record.id,
        "semester": record.semester,
        "course_name": record.course_name,
        "subject": record.subject,
        "period": record.period,
        "student_name": matched_student.name if matched_student else record.student_name,
        "attendance": record.attendance,
        "grades": record.grades,
        "grade_average": grade_average,
        "grade_items": grade_items,
        "status_label": status_label,
        "class_key": f"{record.subject or 'Turma sem disciplina'}::{record.period or 'Sem periodo'}::{record.semester or 'Sem semestre'}::{record.course_name or 'Curso nao informado'}",
        "professor_id": record.professor_id,
        "spreadsheet_id": record.spreadsheet_id,
        "student_id": getattr(matched_student, "id", None),
        "registration_number": getattr(matched_student, "registration_number", None),
        "current_period": getattr(matched_student, "current_period", None),
        "class_schedule": schedule,
        "student_status": student_status,
        "enrollment_date": matched_student.enrollment_date.isoformat() if getattr(matched_student, "enrollment_date", None) else None,
        "is_working": bool(getattr(matched_student, "is_working", False)),
        "work_schedule": getattr(matched_student, "work_schedule", None),
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }
