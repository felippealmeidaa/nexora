import sqlite3

conn = sqlite3.connect("academico.db")
cursor = conn.cursor()

# Listar usuários com nome completo
cursor.execute("SELECT id, username, full_name, email, role FROM users")
users = cursor.fetchall()
print("Usuários cadastrados:")
for u in users:
    print(f"  - ID: {u[0]}, Username: {u[1]}, Full Name: {u[2]}, Email: {u[3]}, Role: {u[4]}")

conn.close()
