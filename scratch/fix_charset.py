import os

file_path = "frontend/src/pages/ProfessorProfile/index.jsx"

if not os.path.exists(file_path):
    print("File not found:", file_path)
    exit(1)

# Ler o arquivo
try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    print("Read with UTF-8 successfully.")
except UnicodeDecodeError:
    print("Failed to read with UTF-8. Trying latin-1...")
    with open(file_path, "r", encoding="latin-1") as f:
        content = f.read()
    print("Read with latin-1 successfully.")

# Substituir o caractere × por x
content_fixed = content.replace("×", "x")

# Gravar em UTF-8 limpo
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content_fixed)

print("File normalized to UTF-8 and specials fixed.")
