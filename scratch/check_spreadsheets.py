import sqlite3

def main():
    conn = sqlite3.connect("academico.db")
    cursor = conn.cursor()
    
    print("=== Planilhas Históricas ===")
    cursor.execute("SELECT id, filename, semester, course_name, records_count FROM historical_spreadsheets")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]} | Arquivo: {row[1]} | Semestre: {row[2]} | Curso: {row[3]} | Registros: {row[4]}")
        
    print("\n=== Registros da última planilha ===")
    if rows:
        last_id = rows[-1][0]
        cursor.execute("SELECT DISTINCT subject FROM historical_records WHERE spreadsheet_id = ?", (last_id,))
        subjects = cursor.fetchall()
        print(f"Disciplinas da planilha ID {last_id}: {[s[0] for s in subjects]}")
        
    conn.close()

if __name__ == "__main__":
    main()
