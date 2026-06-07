import sqlite3

conn = sqlite3.connect("academico.db")
cursor = conn.cursor()

# Obter todas as tabelas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]

print("Pesquisando por termos no banco SQLite:")
terms = ["cinco", "recortes", "restritos", "vinculadas"]

for table in tables:
    try:
        # Obter colunas da tabela
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [c[1] for c in cursor.fetchall()]
        
        for col in columns:
            for term in terms:
                query = f"SELECT COUNT(*) FROM {table} WHERE CAST({col} AS TEXT) LIKE ?"
                cursor.execute(query, (f"%{term}%",))
                count = cursor.fetchone()[0]
                if count > 0:
                    print(f"  - Encontrado '{term}' na tabela '{table}', coluna '{col}' ({count} registros)")
                    
                    # Mostrar amostra
                    cursor.execute(f"SELECT {col} FROM {table} WHERE CAST({col} AS TEXT) LIKE ? LIMIT 3", (f"%{term}%",))
                    samples = cursor.fetchall()
                    for idx, s in enumerate(samples):
                        print(f"    Sample {idx}: {s[0]}")
    except Exception as e:
        # Pular tabelas do sistema ou erros de tipos
        continue

conn.close()
