# -*- coding: utf-8 -*-
import os
import re
import subprocess

def run_git_checkout():
    print("Revertendo arquivos do backend via Git...")
    try:
        subprocess.run(["git", "checkout", "app/routers/historical_data.py"], check=True)
        subprocess.run(["git", "checkout", "app/services/historical_analysis_service.py"], check=True)
        print("Reversao concluida com sucesso!")
    except Exception as e:
        print(f"Erro ao reverter via Git: {e}")

def otimizar_routers_historical_data():
    file_path = "app/routers/historical_data.py"
    if not os.path.exists(file_path):
        print(f"Arquivo nao encontrado: {file_path}")
        return

    print(f"Lendo e otimizando {file_path}...")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Importar text do sqlalchemy
    content = content.replace(
        "from sqlalchemy import delete",
        "from sqlalchemy import delete, text"
    )

    # 2. Otimizar a iteracao do DataFrame em _map_dataframe_to_records
    old_iter = """    records = []
    for _, row in prepared.iterrows():
        semester = _build_semester(row, col_map)"""
    
    new_iter = """    records = []
    rows_dict = prepared.to_dict(orient="records")
    for row in rows_dict:
        semester = _build_semester(row, col_map)"""

    content = content.replace(old_iter, new_iter)

    # 3. Otimizar a leitura de CSV em _parse_csv
    old_parse_csv = """def _parse_csv(content: bytes) -> Any:
    pd = _require_pandas()
    best_df = None
    best_score = (-1, -1)

    for sep in [";", ",", "\\t", "|"]:
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

    return best_df"""

    new_parse_csv = """def _parse_csv(content: bytes) -> Any:
    pd = _require_pandas()
    best_df = None
    best_score = (-1, -1)
    best_sep = ";"
    best_encoding = "utf-8"

    for sep in [";", ",", "\\t", "|"]:
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                # Carregar apenas uma amostra de 100 linhas para detectar a melhor configuracao
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
        # Carregar o arquivo completo apenas uma vez com a melhor configuracao
        candidate = pd.read_csv(io.BytesIO(content), sep=best_sep, encoding=best_encoding, on_bad_lines="skip")
        best_df = _prepare_dataframe(candidate)
    except Exception:
        try:
            candidate = pd.read_csv(io.BytesIO(content), sep=None, engine="python", on_bad_lines="skip")
            best_df = _prepare_dataframe(candidate)
        except Exception:
            return None

    return best_df"""

    content = content.replace(old_parse_csv, new_parse_csv)

    # 4. Insercao em chunks de 20k no upload_historical_spreadsheet com PRAGMAs do SQLite
    old_bulk = """        # 4. Criar e associar novos registros históricos (Bulk Insert Mappings - resolve problema de Memória/Timeout)
        bulk_data = []
        for record_data in records_data:
            bulk_data.append({
                "semester": record_data.get("semester", "Desconhecido"),
                "course_name": record_data.get("course_name", "Desconhecido"),
                "subject": record_data.get("subject"),
                "period": record_data.get("period"),
                "student_name": record_data.get("student_name", "N/A"),
                "grades": record_data.get("grades", {}),
                "attendance": record_data.get("attendance"),
                "professor_id": current_user.id,
                "spreadsheet_id": spreadsheet.id,
            })
            
        db.bulk_insert_mappings(HistoricalRecord, bulk_data)
        
        # O backend não armazena mais localmente cada instância de new_records.
        # Nós usamos um mockup apenas para contabilizar para o front.
        new_records = bulk_data

        db.commit()"""

    new_bulk = """        # 4. Criar e associar novos registros históricos (Bulk Insert Mappings - em chunks e com SQLite PRAGMAs)
        # Otimizar conexão SQLite temporariamente para escrita em alta performance
        is_sqlite = db.bind.dialect.name == "sqlite"
        if is_sqlite:
            try:
                db.execute(text("PRAGMA journal_mode=WAL;"))
                db.execute(text("PRAGMA synchronous=NORMAL;"))
                db.execute(text("PRAGMA cache_size=-100000;"))
            except Exception as e:
                logger.warning("Nao foi possivel configurar PRAGMAs do SQLite: %s", e)

        bulk_data = []
        for record_data in records_data:
            bulk_data.append({
                "semester": record_data.get("semester", "Desconhecido"),
                "course_name": record_data.get("course_name", "Desconhecido"),
                "subject": record_data.get("subject"),
                "period": record_data.get("period"),
                "student_name": record_data.get("student_name", "N/A"),
                "grades": record_data.get("grades", {}),
                "attendance": record_data.get("attendance"),
                "professor_id": current_user.id,
                "spreadsheet_id": spreadsheet.id,
            })
            
        # Inserção em chunks de 20.000 para manter consumo de memória baixo e evitar timeouts disfarçados
        chunk_size = 20000
        for i in range(0, len(bulk_data), chunk_size):
            chunk = bulk_data[i:i + chunk_size]
            db.bulk_insert_mappings(HistoricalRecord, chunk)
            db.flush()
        
        # O backend não armazena mais localmente cada instância de new_records.
        # Nós usamos um mockup apenas para contabilizar para o front.
        new_records = bulk_data

        db.commit()"""

    content = content.replace(old_bulk, new_bulk)

    # 5. Limitar resumo de insights para 150 linhas
    content = content.replace(
        'records_summary = "\\n".join(lines)',
        'records_summary = "\\n".join(lines[:150])'
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Otimizacoes aplicadas com sucesso em {file_path}!")

def otimizar_services_historical_analysis_service():
    file_path = "app/services/historical_analysis_service.py"
    if not os.path.exists(file_path):
        print(f"Arquivo nao encontrado: {file_path}")
        return

    print(f"Lendo e otimizando {file_path}...")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.write() if False else f.read()

    # Otimizar get_scoped_records para filtrar no banco de dados
    old_query = "        all_records = self.db.query(HistoricalRecord).order_by(HistoricalRecord.id.desc()).all()"
    
    new_query = """        query = self.db.query(HistoricalRecord)
        if current_user.role == UserRole.PROFESSOR:
            query = query.filter(HistoricalRecord.professor_id == current_user.id)
        elif current_user.role == UserRole.COORDINATOR:
            coordinator = self.db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if coordinator and coordinator.academic_course_name:
                query = query.filter(HistoricalRecord.course_name.ilike(f"%{coordinator.academic_course_name.strip()}%"))
        
        all_records = query.order_by(HistoricalRecord.id.desc()).all()"""

    content = content.replace(old_query, new_query)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Otimizacoes aplicadas com sucesso em {file_path}!")

if __name__ == "__main__":
    run_git_checkout()
    otimizar_routers_historical_data()
    otimizar_services_historical_analysis_service()
