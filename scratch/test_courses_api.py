import app.main
from fastapi.testclient import TestClient
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app.main.app)

db = SessionLocal()
jeff = db.query(User).filter(User.id == 2).first() # professor.demo
print(f"Testando API com o usuário: {jeff.username} | Email: {jeff.email} | Role: {jeff.role}")
db.close()

from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.models.user import UserRole

app.main.app.dependency_overrides[get_current_user] = lambda: jeff
app.main.app.dependency_overrides[require_role(UserRole.PROFESSOR, UserRole.ADMIN)] = lambda: jeff

try:
    print("\n[Chamando API] GET /api/courses/academic-courses")
    response = client.get("/api/courses/academic-courses")
    print(f"Status Code da Resposta: {response.status_code}")
    print(response.json()[:10] if isinstance(response.json(), list) else response.json())
except Exception as e:
    import traceback
    traceback.print_exc()

app.main.app.dependency_overrides.clear()
