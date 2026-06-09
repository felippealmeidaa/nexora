"""
Mapeamento de DataFrame para records + merge + class_groups para dados históricos.
"""
import re
from typing import Any

from app.historical.utils import (
    _clean_val,
    _coerce_attendance,
    _coerce_grade,
    _coerce_period,
    _find_column,
    _find_column_startswith,
    _normalize_text,
)
from app.historical.parser import _prepare_dataframe, _require_pandas
from app.historical.serializer import _extract_numeric_grade_summary, _extract_status_label


def _build_semester(row: Any, col_map: dict[str, str]) -> str:
    pd = _require_pandas()
    if "semester_full" in col_map:
        raw_value = row.get(col_map["semester_full"], "")
        if pd.notna(raw_value):
            text = str(raw_value).strip()
            match = re.search(r"(20\d{2})\D*([12])", text)
            if match:
                return f"{match.group(1)}-{match.group(2)}"
            return text or "Desconhecido"

    year_value = _clean_val(row.get(col_map.get("semester_year"), "")) if "semester_year" in col_map else None
    semester_value = _clean_val(row.get(col_map.get("semester_num"), "")) if "semester_num" in col_map else None
    if year_value and semester_value:
        if year_value in semester_value:
            return semester_value
        return f"{year_value}-{semester_value}"
    if year_value:
        return year_value
    if semester_value:
        return semester_value
    return "Desconhecido"


def _extract_grade_columns(cols_upper: dict[str, str], reserved_columns: set[str]) -> list[str]:
    grade_columns = []
    for orig_col, upper_col in cols_upper.items():
        if orig_col in reserved_columns:
            continue
        if re.match(r"^(VA|N|NOTA|P|NP|AP)\d", upper_col):
            grade_columns.append(orig_col)
            continue
        if any(keyword in upper_col for keyword in ["MEDIA", "NOTA_FINAL", "NF", "AVALIACAO"]):
            grade_columns.append(orig_col)
    return grade_columns


def _map_dataframe_to_records(df: Any, source_label: str | None = None) -> list[dict[str, Any]]:
    pd = _require_pandas()
    prepared = _prepare_dataframe(df)
    if prepared is None or prepared.empty:
        return []

    cols_upper = {column: _normalize_text(column).upper().replace(" ", "_") for column in prepared.columns}
    col_map: dict[str, str] = {}

    mapping_rules = [
        ("student_name", ["NOME_ALUNO", "NOME", "ALUNO", "STUDENT"]),
        ("student_id", ["ID_ALUNO", "MATRICULA", "RA", "COD_ALUNO", "CODIGO_ALUNO"]),
        ("course_name", ["NOME_CURSO", "CURSO", "CURSO_ALUNO"]),
        ("course_code", ["COD_CURSO", "CODIGO_CURSO"]),
        ("subject", ["NOME_DISCIPLINA", "NOME_DISICPLINA", "NOME_DISICIPLINA", "DISCIPLINA", "MATERIA", "COMPONENTE_CURRICULAR"]),
        ("subject_code", ["COD_DISCIPLINA", "CODIGO_DISCIPLINA"]),
        ("semester_year", ["ANO"]),
        ("semester_num", ["SEMESTRE"]),
        ("semester_full", ["SEM_LETIVO", "SEMESTRE_LETIVO", "PERIODO_LETIVO"]),
        ("period", ["SERIE", "PERIODO"]),
        ("situation", ["SITUACAO", "STATUS", "RESULTADO"]),
        ("grade", ["NOTA", "MEDIA", "NOTA_FINAL", "MEDIA_FINAL"]),
        ("attendance", ["FREQUENCIA", "FREQ", "PRESENCA", "PERCENTUAL_PRESENCA"]),
        ("absences", ["FALTAS", "TOTAL_FALTAS"]),
    ]

    for field, exact_names in mapping_rules:
        found = _find_column(cols_upper, exact_names)
        if found:
            col_map[field] = found

    startswith_rules = [
        ("course_name", ["NOME_CURS", "CURSO"]),
        ("subject", ["NOME_DISC", "NOME_DISI", "DISCIPLI", "MATERIA"]),
        ("situation", ["SITUAC"]),
        ("attendance", ["FREQUEN", "PRESENC"]),
    ]
    for field, prefixes in startswith_rules:
        if field not in col_map:
            found = _find_column_startswith(cols_upper, prefixes)
            if found:
                col_map[field] = found

    grade_columns = _extract_grade_columns(cols_upper, set(col_map.values()))

    records = []
    rows_dict = prepared.to_dict(orient="records")
    for row in rows_dict:
        semester = _build_semester(row, col_map)
        student_name = _clean_val(row.get(col_map["student_name"], "")) if "student_name" in col_map else None
        student_code = _clean_val(row.get(col_map["student_id"], "")) if "student_id" in col_map else None
        if not student_name and student_code:
            student_name = f"Aluno {student_code}"

        course_name = _clean_val(row.get(col_map["course_name"], "")) if "course_name" in col_map else None
        if not course_name and "course_code" in col_map:
            course_name = _clean_val(row.get(col_map["course_code"], ""))

        subject = _clean_val(row.get(col_map["subject"], "")) if "subject" in col_map else None
        if not subject and "subject_code" in col_map:
            subject = _clean_val(row.get(col_map["subject_code"], ""))
        if not subject and source_label:
            subject = source_label

        period = _coerce_period(row.get(col_map["period"], None)) if "period" in col_map else None
        attendance = _coerce_attendance(row.get(col_map["attendance"], None)) if "attendance" in col_map else None
        if attendance is None and "absences" in col_map:
            from app.historical.utils import _coerce_float
            absences = _coerce_float(row.get(col_map["absences"], None))
            if absences is not None:
                attendance = round(max(0.0, 100.0 - absences), 2)

        grades: dict[str, Any] = {}
        if "situation" in col_map:
            situation = _clean_val(row.get(col_map["situation"], None))
            if situation:
                grades["SITUACAO"] = situation
        if "grade" in col_map:
            grade_value = row.get(col_map["grade"], None)
            numeric_grade = _coerce_grade(grade_value)
            grades["Nota"] = numeric_grade if numeric_grade is not None else _clean_val(grade_value)
        for grade_column in grade_columns:
            grade_value = row.get(grade_column, None)
            if pd.notna(grade_value):
                label = str(grade_column).strip()
                numeric_grade = _coerce_grade(grade_value)
                grades[label] = numeric_grade if numeric_grade is not None else _clean_val(grade_value)

        # Filtrar disciplinas ou alunos fantasmas de cabeçalhos repetidos ou nulos
        if not subject or str(subject).strip().lower() in {"", "nan", "none", "null", "undefined"}:
            continue
        if not student_name or str(student_name).strip().lower() in {"", "nan", "none", "null", "undefined", "n/a"}:
            continue

        subj_norm = _normalize_text(subject).upper()
        if subj_norm in {"DISCIPLINA", "MATERIA", "NOME_DISCIPLINA", "NOME_DE_DISCIPLINA", "COMPONENTE_CURRICULAR", "DISCIPLINAS", "SUBJECT"}:
            continue

        student_norm = _normalize_text(student_name).upper()
        if student_norm in {"NOME", "ALUNO", "NOME_ALUNO", "STUDENT", "NOME_DO_ALUNO", "NOME_COMPLETO"}:
            continue

        if not any([student_name, course_name, subject, grades, attendance is not None]):
            continue

        records.append({
            "semester": semester or "Desconhecido",
            "course_name": course_name or "Desconhecido",
            "subject": subject,
            "period": period,
            "student_name": student_name or "N/A",
            "student_code": student_code,
            "grades": grades,
            "attendance": attendance,
        })

    return records


def _merge_duplicate_records(records_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}

    for record in records_data:
        key = (
            _normalize_text(record.get("semester")),
            _normalize_text(record.get("course_name")),
            _normalize_text(record.get("subject")),
            str(record.get("period") or ""),
            _normalize_text(record.get("student_name")),
        )
        existing = grouped.get(key)
        if not existing:
            grouped[key] = {
                "semester": str(record.get("semester") or "Desconhecido").strip() or "Desconhecido",
                "course_name": str(record.get("course_name") or "Desconhecido").strip() or "Desconhecido",
                "subject": str(record.get("subject") or "").strip() or None,
                "period": record.get("period"),
                "student_name": str(record.get("student_name") or "N/A").strip() or "N/A",
                "grades": dict(record.get("grades") or {}),
                "attendance": record.get("attendance"),
            }
            continue

        existing["grades"].update({key_name: value for key_name, value in (record.get("grades") or {}).items() if value not in (None, "")})
        existing_attendance = existing.get("attendance")
        new_attendance = record.get("attendance")
        if existing_attendance is None:
            existing["attendance"] = new_attendance
        elif new_attendance is not None:
            existing["attendance"] = round((float(existing_attendance) + float(new_attendance)) / 2, 2)

    return list(grouped.values())


def _record_key(record: dict[str, Any]) -> tuple[str, str, str, str, str]:
    return (
        _normalize_text(record.get("semester")),
        _normalize_text(record.get("course_name")),
        _normalize_text(record.get("subject")),
        str(record.get("period") or ""),
        _normalize_text(record.get("student_name")),
    )


def _build_upload_class_groups(records_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}

    for record in records_data:
        semester = record.get("semester") or "Sem semestre"
        subject = record.get("subject") or "Turma sem disciplina"
        course_name = record.get("course_name") or "Curso nao informado"
        period_label = f"{record['period']}o periodo" if record.get("period") else "Periodo nao informado"
        key = f"{semester}::{course_name}::{subject}::{period_label}"

        group = groups.setdefault(key, {
            "key": key,
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
            "period_label": period_label,
            "students": set(),
            "attendance_values": [],
            "grade_values": [],
            "attention_count": 0,
        })
        group["students"].add(record.get("student_name") or "N/A")

        attendance = _coerce_attendance(record.get("attendance"))
        if attendance is not None:
            group["attendance_values"].append(attendance)

        grade_average, _ = _extract_numeric_grade_summary(record.get("grades") or {})
        if grade_average is not None:
            group["grade_values"].append(grade_average)

        if (attendance is not None and attendance < 75) or (grade_average is not None and grade_average < 6):
            group["attention_count"] += 1
        elif _extract_status_label(record.get("grades") or {}) and re.search(r"reprov|risco|alerta", _extract_status_label(record.get("grades") or {}) or "", re.I):
            group["attention_count"] += 1

    payload = []
    for group in groups.values():
        attendance_values = group.pop("attendance_values")
        grade_values = group.pop("grade_values")
        students = group.pop("students")
        payload.append({
            **group,
            "student_count": len(students),
            "avg_attendance": round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else None,
            "avg_grade": round(sum(grade_values) / len(grade_values), 2) if grade_values else None,
        })

    payload.sort(key=lambda item: (-item["attention_count"], item["subject"], item["semester"]))
    return payload[:8]
