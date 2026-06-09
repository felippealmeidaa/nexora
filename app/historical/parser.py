"""
Parsing de arquivos CSV, Excel, TXT e PDF para dados históricos.
"""
import io
import re
from typing import Any

from fastapi import HTTPException

from app.historical.utils import (
    _clean_val,
    _coerce_attendance,
    _coerce_float,
    _coerce_grade,
    _header_score,
    _make_unique_headers,
    _normalize_text,
)


def _require_pandas():
    try:
        import pandas as pd  # type: ignore
        return pd
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="O processamento de planilhas historicas esta indisponivel neste ambiente.",
        ) from exc


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


def _parse_csv(content: bytes) -> Any:
    pd = _require_pandas()
    best_df = None
    best_score = (-1, -1)
    best_sep = ";"
    best_encoding = "utf-8"

    for sep in [";", ",", "\t", "|"]:
        for encoding in ["utf-8-sig", "utf-8", "cp1252", "latin-1"]:
            try:
                candidate = pd.read_csv(io.BytesIO(content), sep=sep, encoding=encoding, on_bad_lines="skip", nrows=100)
                prepared = _prepare_dataframe(candidate)
                if prepared is None or prepared.empty:
                    continue
                score = (_header_score(list(prepared.columns)), len(prepared.columns))
                if score > best_score:
                    best_score = score
                    best_sep = sep
                    best_encoding = encoding
            except Exception:
                continue

    try:
        candidate = pd.read_csv(io.BytesIO(content), sep=best_sep, encoding=best_encoding, on_bad_lines="skip")
        best_df = _prepare_dataframe(candidate)
    except Exception:
        try:
            candidate = pd.read_csv(io.BytesIO(content), sep=None, engine="python", on_bad_lines="skip")
            best_df = _prepare_dataframe(candidate)
        except Exception:
            return None

    return best_df


def _clean_table_text_by_separator(text: str, sep: str) -> str:
    from collections import Counter
    lines = text.splitlines()
    counts = [line.count(sep) for line in lines]
    valid_counts = [c for c in counts if c > 0]
    if not valid_counts:
        return text

    most_common = Counter(valid_counts).most_common(1)
    if not most_common:
        return text

    predominant_count = most_common[0][0]
    if predominant_count < 2:
        return text

    filtered_lines = [line for line in lines if line.count(sep) == predominant_count]
    return "\n".join(filtered_lines)


def _parse_text_table(spreadsheet_text: str) -> Any:
    pd = _require_pandas()
    if not spreadsheet_text.strip():
        return None

    for sep in [";", "|", "\t", ","]:
        try:
            cleaned_text = _clean_table_text_by_separator(spreadsheet_text, sep)
            candidate = pd.read_csv(io.StringIO(cleaned_text), sep=sep, engine="python", on_bad_lines="skip")
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
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        if row:
                            pages_text.append(" | ".join([str(cell) if cell else "" for cell in row]))
            else:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
    return "\n".join(pages_text)


def _parse_pdf_via_regex_fallback(spreadsheet_text: str) -> list[dict[str, Any]]:
    records = []
    lines = [line.strip() for line in spreadsheet_text.splitlines() if line.strip()]

    global_semester = None
    global_course = None
    global_subject = None

    semester_match = re.search(r"\b(20\d{2})[-./]?([12])\b", spreadsheet_text)
    if semester_match:
        global_semester = f"{semester_match.group(1)}-{semester_match.group(2)}"
    else:
        year_match = re.search(r"\b(20\d{2})\b", spreadsheet_text)
        if year_match:
            global_semester = year_match.group(1)

    course_match = re.search(r"(?:curso|graduação|habilitação):\s*([^\n|;]+)", spreadsheet_text, re.IGNORECASE)
    if course_match:
        global_course = course_match.group(1).strip()

    subject_match = re.search(r"(?:disciplina|matéria|componente curricular):\s*([^\n|;]+)", spreadsheet_text, re.IGNORECASE)
    if subject_match:
        global_subject = subject_match.group(1).strip()

    for line in lines:
        if any(kw in line.lower() for kw in ["curso:", "disciplina:", "matéria:", "semestre:", "professor:", "relatório", "nexora", "histórico"]):
            continue

        if len(line) < 6:
            continue

        # Tentar achar alguma situação textual (como "Aprovado", "Reprovado", "Risco")
        situation = None
        for word in ["aprovado", "reprovado", "risco", "alerta", "em risco", "reprovada", "aprovada"]:
            if word in line.lower():
                situation = word.capitalize()
                line = re.sub(rf"\b{word}\b", " ", line, flags=re.IGNORECASE)
                break

        attendance = None
        att_match = re.search(r"\b(\d{2,3}(?:[\.,]\d+)?)\s*%", line)
        if att_match:
            attendance = _coerce_attendance(att_match.group(1))
            line = line.replace(att_match.group(0), " ")

        student_code = None
        code_match = re.match(r"^(\d{4,12})\b", line)
        if code_match:
            student_code = code_match.group(1)
            line = line[code_match.end():].strip()

        numbers = re.findall(r"\b(\d{1,2}(?:[\.,]\d+)?)\b", line)

        if attendance is None and numbers:
            last_num = _coerce_float(numbers[-1])
            if last_num is not None and last_num > 10.0:
                attendance = _coerce_attendance(last_num)
                numbers = numbers[:-1]

        grades_list = []
        for num in numbers:
            g = _coerce_grade(num)
            if g is not None:
                grades_list.append(g)

        text_part = re.sub(r"[\d\.,;:|%\(\)\-\_]", " ", line).strip()
        text_part = re.sub(r"\s+", " ", text_part).strip()

        words = text_part.split()
        if not words or len(words) < 2:
            if not words or len(words[0]) < 3 or not words[0][0].isupper():
                continue

        student_name = text_part
        student_norm = _normalize_text(student_name).upper()
        if any(keyword in student_norm for keyword in ["ALUNO", "NOME", "MATRICULA", "CURSO", "DISCIPLINA", "SEMESTRE", "MÉDIA", "SITUAÇÃO"]):
            continue

        grades_dict = {}
        if grades_list:
            if len(grades_list) == 1:
                grades_dict["Nota"] = grades_list[0]
            else:
                for idx, g in enumerate(grades_list, start=1):
                    grades_dict[f"Nota_{idx}"] = g

        if situation:
            grades_dict["SITUACAO"] = situation

        if student_name and (grades_dict or attendance is not None):
            records.append({
                "semester": global_semester or "Desconhecido",
                "course_name": global_course or "Desconhecido",
                "subject": global_subject or "Desconhecido",
                "period": None,
                "student_name": student_name,
                "student_code": student_code,
                "grades": grades_dict,
                "attendance": attendance,
            })

    return records
