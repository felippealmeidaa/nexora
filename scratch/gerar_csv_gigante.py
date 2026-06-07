# -*- coding: utf-8 -*-
import io
import os
import sys
import time
import csv
import random

# Adicionar a raiz do projeto ao path para importar modulos do backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    import pandas as pd
    from sqlalchemy.orm import Session
    from app.database import get_db, engine
    
    # Importar todos os modelos explicitamente para que o SQLAlchemy resolva as relações circulares
    from app.models.base import BaseModel
    from app.models.user import User, UserRole
    from app.models.professor import Professor
    from app.models.student import Student
    from app.models.course import Course
    from app.models.grade import Grade
    from app.models.attendance import Attendance
    from app.models.enrollment import Enrollment
    from app.models.coordinator import Coordinator
    from app.models.coordinator_course import CoordinatorCourse
    from app.models.historical_data import HistoricalRecord
    from app.models.historical_spreadsheet import HistoricalSpreadsheet
    from app.models.login_attempt import LoginAttempt
    from app.models.staff_code import StaffRegistrationCode
    from app.models.user_session import UserSession
    
    from app.routers.historical_data import _parse_csv, _map_dataframe_to_records
    from sqlalchemy import text
except ImportError as e:
    print(f"Erro ao importar modulos: {e}")
    print("Certifique-se de que o ambiente virtual esta ativado e as dependencias estao instaladas.")
    sys.exit(1)

CSV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "dados_historicos_gigantes.csv"))

def gerar_csv_gigante(num_rows=155000):
    print(f"Gerando arquivo CSV sintético gigante com {num_rows} linhas...")
    start_time = time.time()
    
    cursos = [
        "Ciência da Computação", "Engenharia de Software", "Sistemas de Informação",
        "Medicina", "Direito", "Administração", "Arquitetura e Urbanismo", "Psicologia"
    ]
    disciplinas = [
        "Estruturas de Dados", "Programação Orientada a Objetos", "Cálculo Diferencial e Integral",
        "Álgebra Linear", "Banco de Dados I", "Inteligência Artificial", "Redes de Computadores",
        "Introdução à Programação", "Anatomia Humana", "Direito Constitucional", "Teoria da Administração"
    ]
    semestres = ["2024-1", "2024-2", "2025-1", "2025-2"]
    
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        # Escrever cabecalho compativel com o SIMA
        writer.writerow(["Matricula", "Nome", "Curso", "Disciplina", "Semestre", "Periodo", "Nota", "Frequencia"])
        
        for i in range(1, num_rows + 1):
            matricula = f"RA{100000 + i}"
            nome = f"Estudante Sintetico {i}"
            curso = random.choice(cursos)
            disciplina = random.choice(disciplinas)
            semestre = random.choice(semestres)
            periodo = random.randint(1, 8)
            nota = round(random.uniform(3.0, 10.0), 2)
            frequencia = round(random.uniform(60.0, 100.0), 2)
            
            writer.writerow([matricula, nome, curso, disciplina, semestre, periodo, nota, frequencia])
            
            if i % 50000 == 0:
                print(f"-> {i} linhas escritas...")
                
    elapsed = time.time() - start_time
    file_size_mb = os.path.getsize(CSV_PATH) / (1024 * 1024)
    print(f"CSV gigante gerado com sucesso!")
    print(f"- Linhas: {num_rows}")
    print(f"- Tamanho do arquivo: {file_size_mb:.2f} MB")
    print(f"- Tempo de geração: {elapsed:.2f} segundos\n")

def executar_teste_performance():
    print("Iniciando teste de performance de importacao e parseamento...")
    if not os.path.exists(CSV_PATH):
        print("Arquivo CSV não encontrado. Gerando primeiro...")
        gerar_csv_gigante()
        
    start_time = time.time()
    
    # 1. Simular leitura do arquivo em bytes (como o FastAPI faz)
    print("1. Lendo arquivo CSV em memória (simulando upload)...")
    with open(CSV_PATH, "rb") as f:
        file_bytes = f.read()
    read_time = time.time() - start_time
    print(f"-> Leitura em bytes concluída: {read_time:.2f} segundos")
    
    # 2. Executar parse do CSV (pandas + detecção rápida)
    print("2. Parseando bytes com o detector _parse_csv...")
    parse_start = time.time()
    df = _parse_csv(file_bytes)
    parse_time = time.time() - parse_start
    if df is None or df.empty:
        print("Erro: detector não conseguiu parsear o arquivo CSV.")
        return
    print(f"-> DataFrame gerado: {len(df.index)} linhas.")
    print(f"-> Tempo do parser (_parse_csv): {parse_time:.2f} segundos")
    
    # 3. Mapeamento do Dataframe para dicionários de registro (com a otimização de to_dict que fizemos!)
    print("3. Convertendo Dataframe para registros estruturados...")
    map_start = time.time()
    records_data = _map_dataframe_to_records(df)
    map_time = time.time() - map_start
    print(f"-> Mapeados {len(records_data)} registros válidos.")
    print(f"-> Tempo de mapeamento: {map_time:.2f} segundos")
    
    # 4. Gravação no banco SQLite usando PRAGMAs e bulk inserts em blocos de 20k
    print("4. Persistindo registros no banco de dados SQLite...")
    persist_start = time.time()
    
    db = Session(bind=engine)
    
    try:
        # Otimizar conexão SQLite para alta performance antes de iniciar a transação
        try:
            db.execute(text("PRAGMA journal_mode=WAL;"))
            db.execute(text("PRAGMA synchronous=NORMAL;"))
            db.execute(text("PRAGMA cache_size=-100000;"))
        except Exception as e:
            print(f"Aviso: Não foi possível configurar PRAGMAs do SQLite: {e}")
            
        # Criar professor dummy se não houver no banco, ou usar o ID 1
        professor_id = 1
        
        # Criar planilha dummy
        spreadsheet = HistoricalSpreadsheet(
            filename="dados_historicos_gigantes.csv",
            semester="Multiplos",
            course_name="Multiplos",
            records_count=len(records_data),
            avg_grade=7.0,
            avg_attendance=85.0,
            professor_id=professor_id
        )
        db.add(spreadsheet)
        db.flush()
        
        bulk_data = []
        for r in records_data:
            bulk_data.append({
                "semester": r.get("semester", "Desconhecido"),
                "course_name": r.get("course_name", "Desconhecido"),
                "subject": r.get("subject"),
                "period": r.get("period"),
                "student_name": r.get("student_name", "N/A"),
                "grades": r.get("grades", {}),
                "attendance": r.get("attendance"),
                "professor_id": professor_id,
                "spreadsheet_id": spreadsheet.id,
            })
            
        # Inserção em blocos de 20k
        chunk_size = 20000
        for i in range(0, len(bulk_data), chunk_size):
            chunk = bulk_data[i:i + chunk_size]
            db.bulk_insert_mappings(HistoricalRecord, chunk)
            db.flush()
            
        db.commit()
        persist_time = time.time() - persist_start
        print(f"-> Persistência concluída com sucesso!")
        print(f"-> Tempo de banco de dados: {persist_time:.2f} segundos")
        
        # Limpar os dados de teste gerados no banco para não sujar o ambiente
        print("\nLimpando registros do banco de dados gerados no teste...")
        db.execute(text(f"DELETE FROM historical_records WHERE spreadsheet_id = {spreadsheet.id}"))
        db.delete(spreadsheet)
        db.commit()
        print("-> Limpeza concluída!")
        
    except Exception as exc:
        db.rollback()
        print(f"Erro na transação de banco de dados: {exc}")
        return
    finally:
        db.close()
        
    total_time = time.time() - start_time
    print(f"\n==========================================")
    print(f"RESULTADOS DO TESTE DE ALTA PERFORMANCE:")
    print(f"- Total de registros: {len(records_data)}")
    print(f"- Tempo Leitura: {read_time:.2f}s")
    print(f"- Tempo Parser: {parse_time:.2f}s")
    print(f"- Tempo Mapeamento: {map_time:.2f}s")
    print(f"- Tempo Escrita DB: {persist_time:.2f}s")
    print(f"- TEMPO TOTAL DE PROCESSAMENTO: {total_time:.2f}s")
    print(f"- Velocidade média de processamento: {len(records_data) / total_time:.1f} registros/segundo")
    print(f"==========================================")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "gerar":
        gerar_csv_gigante()
    else:
        gerar_csv_gigante()
        executar_teste_performance()
