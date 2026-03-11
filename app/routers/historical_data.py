from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import re
import pandas as pd
import os
import logging
from datetime import datetime

from app.database import get_db
from app.models.user import User, UserRole
from app.models.historical_data import HistoricalRecord
from app.schemas.historical_data import (
    HistoricalRecordResponse,
    HistoricalUploadResponse
)
from app.services.gemini_service import gemini_service
from app.security.auth import get_current_user
from app.security.rbac import require_role

router = APIRouter(prefix="/api/historical-data", tags=["Dados Históricos"])
logger = logging.getLogger(__name__)


def _clean_val(val):
    """Convert float IDs like 106693.0 to clean int strings."""
    if pd.isna(val):
        return None
    if isinstance(val, float) and val == int(val):
        return str(int(val))
    return str(val).strip()


def _find_column(cols_upper: dict, exact_names: list) -> str:
    """Find column by EXACT match only. Returns original column name or None."""
    for orig_col, upper_col in cols_upper.items():
        if upper_col in exact_names:
            return orig_col
    return None


def _find_column_startswith(cols_upper: dict, prefixes: list) -> str:
    """Find column that starts with any prefix. Returns original column name or None."""
    for orig_col, upper_col in cols_upper.items():
        if any(upper_col.startswith(p) for p in prefixes):
            return orig_col
    return None


def _map_dataframe_to_records(df: pd.DataFrame) -> List[dict]:
    """
    Maps a DataFrame with varied column names to our standard record format.
    Uses EXACT matching first to prevent COD_CURSO from matching before NOME_CURSO.
    """
    cols_upper = {c: c.upper().strip() for c in df.columns}
    col_map = {}

    # Step 1: Exact match mapping (priority order matters)
    mapping_rules = [
        # Student
        ('student_name', ['NOME_ALUNO', 'NOME', 'ALUNO', 'STUDENT']),
        ('student_id', ['ID_ALUNO', 'MATRICULA', 'RA', 'COD_ALUNO']),
        # Course - NOME first!
        ('course_name', ['NOME_CURSO']),
        ('course_code', ['COD_CURSO']),
        # Subject - NOME first!
        ('subject', ['NOME_DISCIPLINA']),
        ('subject_code', ['COD_DISCIPLINA']),
        # Time
        ('semester_year', ['ANO']),
        ('semester_num', ['SEMESTRE']),
        ('semester_full', ['SEM_LETIVO', 'SEMESTRE_LETIVO']),
        ('period', ['SERIE', 'PERIODO']),
        # Status
        ('situation', ['SITUACAO', 'SITUAÇÃO', 'STATUS', 'RESULTADO']),
        ('grade', ['NOTA', 'MEDIA', 'NOTA_FINAL', 'MEDIA_FINAL']),
        ('attendance', ['FREQUENCIA', 'FREQ', 'PRESENCA']),
        ('absences', ['FALTAS', 'FALTA']),
    ]

    for field, exact_names in mapping_rules:
        if field not in col_map:
            found = _find_column(cols_upper, exact_names)
            if found:
                col_map[field] = found

    # Step 2: Startswith fallback for truncated column names
    startswith_rules = [
        ('course_name', ['NOME_CURS', 'NOME_CU']),
        ('subject', ['NOME_DISC', 'NOME_DIS']),
        ('situation', ['SITUAC', 'SITUAÇ']),
        ('attendance', ['FREQUEN']),
    ]
    for field, prefixes in startswith_rules:
        if field not in col_map:
            found = _find_column_startswith(cols_upper, prefixes)
            if found:
                col_map[field] = found

    # Step 3: Find all VA/N grade columns (VA1, VA2, N1, N2, BOLSA, etc.)
    grade_columns = []
    for orig_col, upper_col in cols_upper.items():
        if orig_col in col_map.values():
            continue
        if re.match(r'^(VA|N|NOTA)\d', upper_col) or upper_col == 'BOLSA':
            grade_columns.append(orig_col)

    logger.info(f"Column mapping: {col_map}")
    logger.info(f"Extra grade columns: {grade_columns}")
    logger.info(f"DataFrame columns: {list(df.columns)}")

    records = []
    for _, row in df.iterrows():
        # ── Semester ──
        semester = "Desconhecido"
        if 'semester_full' in col_map:
            val = row.get(col_map['semester_full'], '')
            semester = str(val) if pd.notna(val) else "Desconhecido"
        elif 'semester_year' in col_map:
            year = row.get(col_map['semester_year'], '')
            num = row.get(col_map.get('semester_num', ''), '') if 'semester_num' in col_map else ''
            y = _clean_val(year) or ''
            n = _clean_val(num) or ''
            semester = f"{y}-{n}" if y and n else y or "Desconhecido"

        # ── Student name ──
        student_name = "N/A"
        if 'student_name' in col_map:
            student_name = _clean_val(row.get(col_map['student_name'], '')) or "N/A"
        elif 'student_id' in col_map:
            clean_id = _clean_val(row.get(col_map['student_id'], ''))
            student_name = f"Aluno {clean_id}" if clean_id else "N/A"

        # ── Course name ──
        course_name = "Desconhecido"
        if 'course_name' in col_map:
            course_name = _clean_val(row.get(col_map['course_name'], '')) or "Desconhecido"
        elif 'course_code' in col_map:
            course_name = _clean_val(row.get(col_map['course_code'], '')) or "Desconhecido"

        # ── Subject ──
        subject = None
        if 'subject' in col_map:
            subject = _clean_val(row.get(col_map['subject'], None))
        elif 'subject_code' in col_map:
            subject = _clean_val(row.get(col_map['subject_code'], None))

        # ── Grades (collect everything) ──
        grades = {}
        if 'situation' in col_map:
            val = row.get(col_map['situation'], '')
            if pd.notna(val):
                grades['SITUAÇÃO'] = str(val)
        if 'grade' in col_map:
            val = row.get(col_map['grade'], None)
            if pd.notna(val):
                try:
                    grades['Nota'] = float(val)
                except (ValueError, TypeError):
                    grades['Nota'] = str(val)
        # Capture VA1, VA2, N1, N2, BOLSA, etc.
        for gc in grade_columns:
            val = row.get(gc, None)
            if pd.notna(val):
                label = cols_upper[gc]
                try:
                    grades[label] = float(val)
                except (ValueError, TypeError):
                    grades[label] = str(val)

        # ── Attendance ──
        attendance = None
        if 'attendance' in col_map:
            val = row.get(col_map['attendance'], None)
            if pd.notna(val):
                try:
                    attendance = float(val)
                except (ValueError, TypeError):
                    pass
        elif 'absences' in col_map:
            val = row.get(col_map['absences'], None)
            if pd.notna(val):
                try:
                    attendance = max(0, 100 - float(val))
                except (ValueError, TypeError):
                    pass

        # ── Period ──
        period = None
        if 'period' in col_map:
            val = row.get(col_map['period'], None)
            if pd.notna(val):
                try:
                    period = int(float(val))
                except (ValueError, TypeError):
                    pass

        records.append({
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
            "period": period,
            "student_name": student_name,
            "grades": grades,
            "attendance": attendance,
        })

    return records


def _parse_csv(content: bytes) -> pd.DataFrame:
    """Try multiple separators and encodings to find the best CSV parse."""
    best_df = None
    best_cols = 0
    for sep in [';', ',', '\t']:
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                candidate = pd.read_csv(io.BytesIO(content), sep=sep, encoding=encoding, on_bad_lines='skip')
                if len(candidate) > 0 and len(candidate.columns) > best_cols:
                    best_df = candidate
                    best_cols = len(candidate.columns)
            except Exception:
                continue
        if best_cols >= 3:
            break
    if best_df is None or best_cols <= 1:
        try:
            candidate = pd.read_csv(io.BytesIO(content), sep=None, engine='python', on_bad_lines='skip')
            if len(candidate) > 0 and len(candidate.columns) > best_cols:
                best_df = candidate
        except Exception:
            pass
    return best_df


@router.post("/upload", response_model=HistoricalUploadResponse)
async def upload_historical_spreadsheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    """
    Recebe uma planilha, extrai os dados e salva no banco.
    CSV/Excel: parsing direto com pandas.
    TXT/PDF: usa Gemini para extrair dados.
    """
    content = await file.read()
    filename = file.filename.lower()

    try:
        records_data = []

        if filename.endswith(".csv"):
            df = _parse_csv(content)
            if df is not None and len(df) > 0:
                logger.info(f"CSV parsed: {len(df)} rows, {len(df.columns)} cols: {list(df.columns)}")
                records_data = _map_dataframe_to_records(df)
            else:
                raise HTTPException(status_code=422, detail="Não foi possível ler o CSV. Verifique o formato.")

        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
            logger.info(f"Excel parsed: {len(df)} rows, {len(df.columns)} cols: {list(df.columns)}")
            records_data = _map_dataframe_to_records(df)

        elif filename.endswith(".txt"):
            spreadsheet_text = ""
            for enc in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    spreadsheet_text = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if not spreadsheet_text:
                spreadsheet_text = content.decode('utf-8', errors='ignore')
            if len(spreadsheet_text) > 15000:
                spreadsheet_text = spreadsheet_text[:15000]
            records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text)

        elif filename.endswith(".pdf"):
            import pdfplumber
            pages_text = []
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages_text.append(text)
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            if row:
                                pages_text.append(" | ".join([str(cell) if cell else "" for cell in row]))
            spreadsheet_text = "\n".join(pages_text)
            if len(spreadsheet_text) > 15000:
                spreadsheet_text = spreadsheet_text[:15000]
            records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text)

        else:
            raise HTTPException(status_code=400, detail="Formato não suportado. Use: CSV, Excel (.xls/.xlsx), TXT ou PDF.")

        if not records_data:
            raise HTTPException(status_code=422, detail="Nenhum dado foi extraído do arquivo.")

        logger.info(f"Total records to save: {len(records_data)}")
        if records_data:
            logger.info(f"Sample record: {records_data[0]}")

        # Salvar no banco
        new_records = []
        for rd in records_data:
            record = HistoricalRecord(
                semester=rd.get("semester", "Desconhecido"),
                course_name=rd.get("course_name", "Desconhecido"),
                subject=rd.get("subject"),
                period=rd.get("period"),
                student_name=rd.get("student_name", "N/A"),
                grades=rd.get("grades", {}),
                attendance=rd.get("attendance"),
                professor_id=current_user.id
            )
            db.add(record)
            new_records.append(record)

        db.commit()

        return {
            "message": "Dados processados e salvos com sucesso",
            "records_count": len(new_records),
            "semester": records_data[0].get("semester", "Múltiplos") if records_data else "N/A",
            "course_organized": True
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao processar arquivo: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")


@router.delete("/clear")
def clear_historical_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    """Limpa todos os registros históricos do professor (para re-upload)."""
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
    """
    Lista registros históricos com filtros e paginação.
    """
    query = db.query(HistoricalRecord)
    
    if current_user.role == UserRole.PROFESSOR:
        query = query.filter(HistoricalRecord.professor_id == current_user.id)
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso não autorizado")

    if semester:
        query = query.filter(HistoricalRecord.semester == semester)
    if course_name:
        query = query.filter(HistoricalRecord.course_name.ilike(f"%{course_name}%"))
    if subject:
        query = query.filter(HistoricalRecord.subject.ilike(f"%{subject}%"))

    total_count = query.count()
    records = query.order_by(HistoricalRecord.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "records": [
            {
                "id": r.id,
                "semester": r.semester,
                "course_name": r.course_name,
                "subject": r.subject,
                "period": r.period,
                "student_name": r.student_name,
                "grades": r.grades,
                "attendance": r.attendance,
                "professor_id": r.professor_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in records
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
    """
    Retorna filtros disponíveis (semestres e cursos únicos).
    """
    query = db.query(HistoricalRecord)
    if current_user.role == UserRole.PROFESSOR:
        query = query.filter(HistoricalRecord.professor_id == current_user.id)

    semesters = [r[0] for r in query.with_entities(HistoricalRecord.semester).distinct().all() if r[0]]
    courses = [r[0] for r in query.with_entities(HistoricalRecord.course_name).distinct().all() if r[0]]
    subjects = [r[0] for r in query.with_entities(HistoricalRecord.subject).distinct().all() if r[0]]

    return {
        "semesters": sorted(list(set(semesters)), reverse=True),
        "courses": sorted(list(set(courses))),
        "subjects": sorted(list(set(subjects)))
    }


@router.post("/chat")
async def chat_about_spreadsheet(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    """
    Chat com Gemini sobre dados de planilha carregada pelo professor.
    Recebe: { message: str, file_content: str, history?: list }
    """
    message = request.get("message", "")
    file_content = request.get("file_content", "")
    history = request.get("history", [])

    if not message:
        raise HTTPException(status_code=400, detail="Mensagem é obrigatória")

    if not file_content:
        raise HTTPException(status_code=400, detail="Conteúdo da planilha é obrigatório")

    try:
        response_text = await gemini_service.chat_with_file(
            message=message,
            file_content=file_content,
            kpis={},
            risk_students=[],
        )
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar: {str(e)}")


@router.post("/insights")
async def generate_historical_insights(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    """
    Gera insights sobre dados históricos usando Gemini.
    Busca TODOS os registros históricos do professor no banco e os envia ao Gemini.
    Recebe: { message: str } — se vazio, gera insights gerais.
    """
    message = request.get("message", "").strip()
    if not message:
        message = "Gere uma análise geral completa dos dados históricos. Identifique padrões, tendências, disciplinas críticas e recomendações práticas."

    query = db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == current_user.id
    )
    records = query.all()

    if not records:
        return {"response": "Nenhum dado histórico encontrado. Carregue planilhas primeiro para gerar insights."}

    lines = []
    for r in records:
        grades_str = ", ".join([f"{k}={v}" for k, v in (r.grades or {}).items()])
        lines.append(
            f"Sem:{r.semester} | Curso:{r.course_name} | Matéria:{r.subject or 'N/A'} | "
            f"Aluno:{r.student_name} | Notas:[{grades_str}] | Freq:{r.attendance}%"
        )
    records_summary = "\n".join(lines)

    try:
        response_text = await gemini_service.chat_historical_insights(
            message=message,
            records_summary=records_summary,
            total_records=len(records),
        )
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar insights: {str(e)}")
