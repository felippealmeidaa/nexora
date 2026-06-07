import sqlite3

conn = sqlite3.connect("academico.db")
cursor = conn.cursor()

try:
    print("Atualizando coluna status de students para maiúsculas...")
    cursor.execute("UPDATE students SET status = UPPER(status)")
    print(f"Modificados: {cursor.rowcount} registros de status.")
    
    print("\nAtualizando coluna class_schedule de students para maiúsculas...")
    cursor.execute("UPDATE students SET class_schedule = UPPER(class_schedule) WHERE class_schedule IS NOT NULL")
    print(f"Modificados: {cursor.rowcount} registros de class_schedule.")
    
    conn.commit()
    print("\nAtualização bem-sucedida!")
except Exception as e:
    conn.rollback()
    print("Erro durante a atualização:", e)
finally:
    conn.close()
