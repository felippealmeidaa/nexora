from collections import defaultdict
from typing import Any, Optional
import io
import logging
import re

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.historical_data import HistoricalRecord
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.historical_data import HistoricalUploadResponse
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.services.gemini_service import gemini_service
from app.services.historical_analysis_service import HistoricalAnalysisService
from app.services.historical_export_service import ANALYSIS_TITLES, HistoricalExportService

router = APIRouter(prefix="/api/historical-data", tags=["Dados Historicos"])
logger = logging.getLogger(__name__)

HEADER_KEYWORDS = {
    "aluno", "nome", "matricula", "ra", "curso", "disciplina", "materia",
    "semestre", "ano", "periodo", "serie", "nota", "media", "frequencia",
    "presenca", "faltas", "situacao", "status", "resultado", "turma",
}


def _require_pandas():
    try:
        import pandas as pd  # type: ignore
        return pd
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="O processamento de planilhas historicas esta indisponivel neste ambiente.",
        ) from exc


def _normalize_text(value: Any) -> str:
    text = str(value or "")
    return re.sub(r"\s+", " ", text).strip().lower()


def _clean_val(val: Any):
    pd = _require_pandas()
    if pd.isna(val):
        return None
    if isinstance(val, float) and val == int(val):
        return str(int(val))
    return str(val).strip()


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    text = str(value).strip().replace("%", "").replace(",", ".")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None


def _coerce_grade(value: Any) -> float | None:
    numeric = _coerce_float(value)
    if numeric is None:
        return None
    if numeric > 10:
        numeric = numeric / 10 if numeric <= 100 else 10.0
    return round(max(0.0, min(float(numeric), 10.0)), 2)


def _coerce_attendance(value: Any) -> float | None:
    numeric = _coerce_float(value)
    if numeric is None:
        return None
    if 0 <= numeric <= 1:
        numeric *= 100
    return round(max(0.0, min(float(numeric), 100.0)), 2)


def _coerce_period(value: Any) -> int | None:
    numeric = _coerce_float(value)
    if numeric is None:
        return None
    period = int(numeric)
    return period if 0 < period <= 20 else None


def _header_score(values: list[Any]) -> int:
    score = 0
    for value in values:
        normalized = _normalize_text(value)
        if not normalized or normalized.startswith("unnamed") or normalized.startswith("column"):
            continue
        if any(keyword in normalized for keyword in HEADER_KEYWORDS):
            score += 2
        elif re.search(r"^(va|n|nota|media|freq|presenca|faltas)\b", normalized):
            score += 1
    return score


def _make_unique_headers(values: list[Any]) -> list[str]:
    headers: list[str] = []
    counts: dict[str, int] = {}
    for index, value in enumerate(values, start=1):
        cleaned = str(value or "").strip() or f"COLUNA_{index}"
        if cleaned.lower().startswith("unnamed"):
            cleaned = f"COLUNA_{index}"
        counts[cleaned] = counts.get(cleaned, 0) + 1
        if counts[cleaned] > 1:
            cleaned = f"{cleaned}_{counts[cleaned]}"
        headers.append(cleaned)
    return headers


def _prepare_dataframe(df: Any) -> Any:
    if df is None:
        return None

    prepared = df.copy()
    prepared = prepared.dropna(axis=0, how="all").dropna(axis=1, how="all")
    if prepared.empty:
        return prepared

    prepared.columns = _make_unique_headers([_clean_val(column) for column in prepared.columns])
    current_score = _header_score(list(prepared.columns))
    promoted_index = None
    promoted_score = current_score

    for row_index in range(min(3, len(prepared.index))):
        candidate_headers = [_clean_val(value) for value in prepared.iloc[row_index].tolist()]
        score = _header_score(candidate_headers)
        if score >= 4 and score > promoted_score:
            promoted_index = row_index
            promoted_score = score

    if promoted_index is not None:
        prepared.columns = _make_unique_headers([_clean_val(value) for value in prepared.iloc[promoted_index].tolist()])
        prepared = prepared.iloc[promoted_index + 1 :].reset_index(drop=True)

    prepared = prepared.dropna(axis=0, how="all").dropna(axis=1, how="all")
    prepared.columns = _make_unique_headers([_clean_val(column) for column in prepared.columns])
    return prepared.reset_index(drop=True)

def _find_column(cols_upper: dict[str, str], exact_names: list[str]) -> str | None:
    for orig_col, upper_col in cols_upper.items():
        if upper_col in exact_names:
            return orig_col
    return None


def _find_column_startswith(cols_upper: dict[str, str], prefixes: list[str]) -> str | None:
    for orig_col, upper_col in cols_upper.items():
        if any(upper_col.startswith(prefix) for prefix in prefixes):
            return orig_col
    return None


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
        return f"{year_value}-{semester_value}"
    if year_value:
        return year_value
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
        ("subject", ["NOME_DISCIPLINA", "DISCIPLINA", "MATERIA", "COMPONENTE_CURRICULAR"]),
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
        ("subject", ["NOME_DISC", "DISCIPLI", "MATERIA"]),
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
    for _, row in prepared.iterrows():
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

        if not any([student_name, course_name, subject, grades, attendance is not None]):
            continue

        records.append({
            "semester": semester or "Desconhecido",
            "course_name": course_name or "Desconhecido",
            "subject": subject,
            "period": period,
            "student_name": student_name or "N/A",
            "grades": grades,
            "attendance": attendance,
        })

    return records


def _parse_csv(content: bytes) -> Any:
    pd = _require_pandas()
    best_df = None
    best_score = (-1, -1)

    for sep in [";", ",", "\t", "|"]:
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                candidate = pd.read_csv(io.BytesIO(content), sep=sep, encoding=encoding, on_bad_lines="skip")
                prepared = _prepare_dataframe(candidate)
                if prepared is None or prepared.empty:
                    continue
                score = (_header_score(list(prepared.columns)), len(prepared.columns))
                if score > best_score:
                    best_df = prepared
                    best_score = score
            except Exception:
                continue

    if best_df is None:
        try:
            candidate = pd.read_csv(io.BytesIO(content), sep=None, engine="python", on_bad_lines="skip")
            best_df = _prepare_dataframe(candidate)
        except Exception:
            return None

    return best_df

def _parse_text_table(spreadsheet_text: str) -> Any:
    pd = _require_pandas()
    if not spreadsheet_text.strip():
        return None

    for sep in [";", "|", "\t", ","]:
        try:
            candidate = pd.read_csv(io.StringIO(spreadsheet_text), sep=sep, engine="python", on_bad_lines="skip")
            prepared = _prepare_dataframe(candidate)
            if prepared is not None and not prepared.empty and len(prepared.columns) >= 3:
                return prepared
        except Exception:
            continue

    return None


def _extract_text_from_pdf(content: bytes) -> str:
    import pdfplumber

    pages_text = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
            tables = page.extract_tables() or []
            for table in tables:
                for row in table:
                    if row:
                        pages_text.append(" | ".join([str(cell) if cell else "" for cell in row]))
    return "\n".join(pages_text)


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

@router.post("/upload", response_model=HistoricalUploadResponse)
async def upload_historical_spreadsheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    content = await file.read()
    filename = (file.filename or "").lower()
    warnings: list[str] = []
    normalization_steps = [
        "Detecta colunas fora de ordem e tenta promover o cabecalho correto automaticamente.",
        "Padroniza nomes de aluno, curso, disciplina, semestre, nota e frequencia para uma estrutura unica.",
        "Consolida linhas repetidas da mesma turma e do mesmo aluno antes de alimentar as analises.",
    ]

    try:
        records_data: list[dict[str, Any]] = []

        if filename.endswith(".csv"):
            df = _parse_csv(content)
            if df is None or len(df.index) == 0:
                raise HTTPException(status_code=422, detail="Nao foi possivel ler o CSV. Verifique o formato do arquivo.")
            records_data = _map_dataframe_to_records(df)

        elif filename.endswith((".xls", ".xlsx")):
            pd = _require_pandas()
            workbook = pd.read_excel(io.BytesIO(content), sheet_name=None)
            for sheet_name, df in workbook.items():
                mapped_records = _map_dataframe_to_records(df, source_label=sheet_name)
                if mapped_records:
                    records_data.extend(mapped_records)
            if not records_data:
                raise HTTPException(status_code=422, detail="Nao foi possivel identificar registros validos na planilha Excel.")

        elif filename.endswith(".txt"):
            spreadsheet_text = ""
            for encoding in ["utf-8", "latin-1", "cp1252"]:
                try:
                    spreadsheet_text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if not spreadsheet_text:
                spreadsheet_text = content.decode("utf-8", errors="ignore")

            local_df = _parse_text_table(spreadsheet_text)
            if local_df is not None:
                records_data = _map_dataframe_to_records(local_df)
            if not records_data:
                warnings.append("Leitura heuristica insuficiente. A NEXORA acionou a extracao assistida por IA para completar a organizacao.")
                records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text[:15000])

        elif filename.endswith(".pdf"):
            spreadsheet_text = _extract_text_from_pdf(content)
            local_df = _parse_text_table(spreadsheet_text)
            if local_df is not None:
                records_data = _map_dataframe_to_records(local_df)
            if not records_data:
                warnings.append("O PDF nao trouxe tabela estruturada suficiente. A NEXORA usou a extracao assistida por IA para recuperar os registros.")
                records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text[:15000])

        else:
            raise HTTPException(status_code=400, detail="Formato nao suportado. Use CSV, Excel, TXT ou PDF.")

        if not records_data:
            raise HTTPException(status_code=422, detail="Nenhum dado importante foi extraido do arquivo enviado.")

        records_data = _merge_duplicate_records(records_data)
        class_groups = _build_upload_class_groups(records_data)

        existing_records = db.query(HistoricalRecord).filter(HistoricalRecord.professor_id == current_user.id).all()
        existing_by_key: dict[tuple[str, str, str, str, str], list[HistoricalRecord]] = defaultdict(list)
        for existing in existing_records:
            existing_by_key[_record_key({
                "semester": existing.semester,
                "course_name": existing.course_name,
                "subject": existing.subject,
                "period": existing.period,
                "student_name": existing.student_name,
            })].append(existing)

        for record_data in records_data:
            for existing in existing_by_key.get(_record_key(record_data), []):
                db.delete(existing)

        new_records = []
        for record_data in records_data:
            record = HistoricalRecord(
                semester=record_data.get("semester", "Desconhecido"),
                course_name=record_data.get("course_name", "Desconhecido"),
                subject=record_data.get("subject"),
                period=record_data.get("period"),
                student_name=record_data.get("student_name", "N/A"),
                grades=record_data.get("grades", {}),
                attendance=record_data.get("attendance"),
                professor_id=current_user.id,
            )
            db.add(record)
            new_records.append(record)

        db.commit()

        unique_courses = sorted({record.get("course_name") for record in records_data if record.get("course_name")})
        unique_subjects = sorted({record.get("subject") for record in records_data if record.get("subject")})
        unique_semesters = sorted({record.get("semester") for record in records_data if record.get("semester")})
        attendance_values = [float(record.get("attendance")) for record in records_data if record.get("attendance") is not None]
        numeric_grades = []
        for record in records_data:
            grade_average, _ = _extract_numeric_grade_summary(record.get("grades") or {})
            if grade_average is not None:
                numeric_grades.append(float(grade_average))

        return {
            "message": "Arquivo tratado, turmas organizadas e base historica atualizada com sucesso.",
            "records_count": len(new_records),
            "semester": unique_semesters[0] if len(unique_semesters) == 1 else "Multiplos",
            "course_organized": True,
            "courses": unique_courses[:8],
            "subjects": unique_subjects[:10],
            "warnings": warnings,
            "normalization_steps": normalization_steps,
            "summary": {
                "avg_attendance": round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else None,
                "avg_grade": round(sum(numeric_grades) / len(numeric_grades), 2) if numeric_grades else None,
                "students": len({record.get("student_name") for record in records_data if record.get("student_name")}),
                "classes": len(class_groups),
                "semesters": len(unique_semesters),
            },
            "class_groups": class_groups,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Erro ao processar arquivo: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {exc}") from exc


@router.delete("/clear")
def clear_historical_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    deleted = db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == current_user.id
    ).delete()
    db.commit()
    return {"message": f"{deleted} registros removidos com sucesso."}


@router.get("")
def get_historical_records(
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    scoped_records, _ = service.get_scoped_records(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
    )

    total_count = len(scoped_records)
    page_start = (page - 1) * page_size
    page_end = page_start + page_size
    records = scoped_records[page_start:page_end]
    student_by_name, student_by_name_and_course = service._build_student_indexes()

    return {
        "records": [
            _serialize_historical_record(
                record=record,
                matched_student=service._match_student(record, student_by_name, student_by_name_and_course),
            )
            for record in records
        ],
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
    }

@router.get("/filters")
def get_historical_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    scoped_records, _ = service.get_scoped_records(current_user=current_user)
    return service._build_filters(scoped_records)


@router.get("/analysis-workspace")
def get_historical_analysis_workspace(
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    return service.build_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
    )


@router.get("/analysis-workspace/at-risk-students")
def get_at_risk_students_by_class(
    class_key: str = Query(...),
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    limit: int = Query(4, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    bundle = service.get_workspace_bundle(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
    )
    prepared = bundle.get("prepared_records", [])

    selected = [row for row in prepared if row.get("class_key") == class_key]
    if not selected:
        raise HTTPException(status_code=404, detail="Turma nao encontrada para o recorte atual.")

    payload = service._serialize_priority_students(selected, limit=limit)

    return {
        "class_key": class_key,
        "total_students": len({row.get("student_name") for row in selected if row.get("student_name")}),
        "at_risk_count": len(payload),
        "students": payload,
    }


@router.get("/analysis-workspace/export")
def export_historical_analysis_workspace(
    analysis_id: str = Query(...),
    export_format: str = Query(..., pattern="^(pdf|csv|xlsx|json)$"),
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis_service = HistoricalAnalysisService(db)
    export_service = HistoricalExportService()
    workspace = analysis_service.build_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
    )

    title = ANALYSIS_TITLES.get(analysis_id)
    if not title:
        raise HTTPException(status_code=400, detail="Analise solicitada nao e suportada para exportacao.")

    rows = export_service.get_analysis_rows(workspace, analysis_id)
    payload = {
        "analysis_id": analysis_id,
        "analysis_title": title,
        "scope": workspace.get("scope", {}),
        "filters": {
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
        },
        "overview": workspace.get("overview", {}),
        "rows": rows,
    }

    if export_format == "json":
        content = export_service.export_json(payload)
        media_type = "application/json"
    elif export_format == "csv":
        content = export_service.export_csv(rows)
        media_type = "text/csv; charset=utf-8"
    elif export_format == "xlsx":
        content = export_service.export_xlsx(rows, title)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = export_service.export_pdf(workspace, analysis_id, title, rows)
        media_type = "application/pdf"

    filename = export_service.build_filename(analysis_id, export_format)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@router.post("/chat")
async def chat_about_spreadsheet(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    message = request.get("message", "")
    file_content = request.get("file_content", "")

    if not message:
        raise HTTPException(status_code=400, detail="Mensagem e obrigatoria")
    if not file_content:
        raise HTTPException(status_code=400, detail="Conteudo da planilha e obrigatorio")

    try:
        response_text = await gemini_service.chat_with_file(
            message=message,
            file_content=file_content,
            kpis={},
            risk_students=[],
        )
        return {"response": response_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao processar: {exc}") from exc


@router.post("/insights")
async def generate_historical_insights(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    message = request.get("message", "").strip()
    if not message:
        message = (
            "Gere uma analise geral completa dos dados historicos. "
            "Identifique padroes, tendencias, disciplinas criticas e recomendacoes praticas."
        )

    records = db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == current_user.id
    ).all()

    if not records:
        return {"response": "Nenhum dado historico encontrado. Carregue planilhas primeiro para gerar insights."}

    lines = []
    for record in records:
        grades_str = ", ".join([f"{key}={value}" for key, value in (record.grades or {}).items()])
        lines.append(
            f"Sem:{record.semester} | Curso:{record.course_name} | Materia:{record.subject or 'N/A'} | "
            f"Aluno:{record.student_name} | Notas:[{grades_str}] | Freq:{record.attendance}%"
        )

    records_summary = "\n".join(lines)

    try:
        response_text = await gemini_service.chat_historical_insights(
            message=message,
            records_summary=records_summary,
            total_records=len(records),
        )
        return {"response": response_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar insights: {exc}") from exc
