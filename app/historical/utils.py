"""
Helpers genéricos de coerção e normalização de texto para dados históricos.
"""
import math
import re
from typing import Any


HEADER_KEYWORDS = {
    "aluno", "nome", "matricula", "ra", "curso", "disciplina", "materia",
    "semestre", "ano", "periodo", "serie", "nota", "media", "frequencia",
    "presenca", "faltas", "situacao", "status", "resultado", "turma",
}


def _normalize_text(value: Any) -> str:
    text = str(value or "")
    return re.sub(r"\s+", " ", text).strip().lower()


def _clean_val(val):
    """Limpa e converte um valor de célula para string, tratando NaN/None."""
    try:
        import pandas as pd  # type: ignore
        if pd.isna(val):
            return None
    except Exception:
        pass
    if isinstance(val, float) and math.isnan(val):
        return None
    try:
        if isinstance(val, float) and val == int(val):
            return str(int(val))
    except (ValueError, OverflowError):
        pass
    return str(val).strip()


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        val_float = float(value)
        if math.isnan(val_float) or math.isinf(val_float):
            return None
        return val_float
    text = str(value).strip().replace("%", "").replace(",", ".")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        val_float = float(match.group())
        if math.isnan(val_float) or math.isinf(val_float):
            return None
        return val_float
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
    try:
        period = int(numeric)
        return period if 0 < period <= 20 else None
    except (ValueError, OverflowError):
        return None


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
