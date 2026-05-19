import math
import re

DEFAULT_TOTAL_CLASSES = 60


def _parse_numeric(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    cleaned = re.sub(r'[^0-9,.-]', '', text)
    if cleaned.count(',') > 1 and '.' not in cleaned:
        cleaned = cleaned.replace(',', '')
    cleaned = cleaned.replace(',', '.')
    if cleaned in {'', '-', '.', '-.'}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _get_value(record, key):
    if isinstance(record, dict):
        return record.get(key)
    return getattr(record, key, None)


def resolve_total_classes(total_aulas=None, total_faltas=None, percentual_presenca=None):
    classes = _parse_numeric(total_aulas)
    absences = _parse_numeric(total_faltas)
    attendance = _parse_numeric(percentual_presenca)

    if classes is not None and classes > 0:
        return int(round(classes))

    if absences is None or attendance is None:
        return None

    attendance = max(0.0, min(100.0, attendance))
    if attendance >= 100.0:
        return None

    absence_ratio = 1 - (attendance / 100.0)
    if absence_ratio <= 0:
        return None

    inferred = absences / absence_ratio
    if not math.isfinite(inferred) or inferred <= 0:
        return None

    return max(int(round(inferred)), int(absences))


def resolve_attendance_percentage(percentual_presenca, total_faltas=None, total_aulas=None):
    direct = _parse_numeric(percentual_presenca)
    absences = _parse_numeric(total_faltas)
    classes = resolve_total_classes(total_aulas, total_faltas, percentual_presenca)

    derived = None
    if classes is not None and classes > 0 and absences is not None:
        derived = max(0.0, min(100.0, ((classes - absences) / classes) * 100.0))

    if direct is None:
        return round(derived, 2) if derived is not None else None

    direct = max(0.0, min(100.0, direct))
    impossible_counters = (
        classes is not None
        and absences is not None
        and (absences > classes or (absences == classes and direct > 0.0))
    )

    if impossible_counters:
        return round(direct, 2)

    if derived is not None and (direct == 0.0 or (direct >= 99.9 and absences is not None and absences > 0)):
        return round(derived, 2)

    return round(direct, 2)


def infer_total_classes_baseline(records, fallback=DEFAULT_TOTAL_CLASSES):
    parsed_classes = []
    for record in records or []:
        classes = _parse_numeric(_get_value(record, 'total_aulas'))
        if classes is not None and classes >= 40:
            parsed_classes.append(int(round(classes)))

    if parsed_classes:
        return max(parsed_classes)

    return fallback


def normalize_attendance_record(total_faltas=None, total_aulas=None, percentual_presenca=None, baseline_total_classes=None):
    absences = _parse_numeric(total_faltas)
    classes = _parse_numeric(total_aulas)
    percentage = _parse_numeric(percentual_presenca)

    if percentage is not None:
        percentage = max(0.0, min(100.0, percentage))

    if classes is not None and classes <= 0:
        classes = None

    if absences is not None and absences < 0:
        absences = 0.0

    if classes is None:
        classes = resolve_total_classes(classes, absences, percentage)
    elif classes is not None:
        classes = int(round(classes))

    if baseline_total_classes is not None:
        baseline_total_classes = int(round(baseline_total_classes))

    if (
        baseline_total_classes
        and percentage is not None
        and percentage >= 99.9
        and classes is not None
        and classes < baseline_total_classes
    ):
        if absences is None:
            absences = float(classes)
            classes = baseline_total_classes
        elif classes == int(round(absences)):
            classes = baseline_total_classes

    ambiguous_absences = False
    if percentage is not None and classes is not None and classes > 0 and absences is not None:
        derived = max(0.0, min(100.0, ((classes - absences) / classes) * 100.0))
        impossible_counters = absences > classes or (absences == classes and percentage > 0.0)
        if impossible_counters:
            ambiguous_absences = True
        elif percentage > 0.0 and percentage < 99.9 and abs(percentage - derived) > 25.0:
            ambiguous_absences = True

    resolved_percentage = resolve_attendance_percentage(percentage, absences, classes)

    return {
        'total_faltas': int(round(absences)) if absences is not None and not ambiguous_absences else None,
        'total_aulas': int(round(classes)) if classes is not None else None,
        'percentual_presenca': resolved_percentage,
        'faltas_confirmadas': absences is not None and not ambiguous_absences,
    }


def normalize_attendance_records(records, baseline_total_classes=None):
    baseline = baseline_total_classes or infer_total_classes_baseline(records)
    return [
        normalize_attendance_record(
            _get_value(record, 'total_faltas'),
            _get_value(record, 'total_aulas'),
            _get_value(record, 'percentual_presenca'),
            baseline_total_classes=baseline,
        )
        for record in (records or [])
    ]
