import app.main
from fastapi.testclient import TestClient
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app.main.app)

# Obter usuário Jefferson (user_id = 7)
db = SessionLocal()
jeff = db.query(User).filter(User.id == 7).first()
print(f"Testando API com o usuário: {jeff.username} | Email: {jeff.email} | Role: {jeff.role}")
db.close()

# Para simular o usuário logado nas rotas FastAPI, nós mockamos a dependência 'get_current_user' ou criamos o token JWT
# Vamos sobrescrever a dependência get_current_user e require_role no app
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.models.user import UserRole

app.main.app.dependency_overrides[get_current_user] = lambda: jeff
app.main.app.dependency_overrides[require_role(UserRole.PROFESSOR, UserRole.ADMIN)] = lambda: jeff

try:
    print("\n[Chamando API] GET /api/historical-data/analysis-workspace")
    response = client.get("/api/historical-data/analysis-workspace")
    print(f"Status Code da Resposta: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\nSucesso! Estrutura da Resposta obtida:")
        print(f"  - total_records: {data.get('overview', {}).get('total_records')}")
        print(f"  - total_students: {data.get('overview', {}).get('total_students')}")
        print(f"  - total_classes: {data.get('overview', {}).get('total_classes')}")
        print(f"  - course_distribution: {data.get('overview', {}).get('course_distribution')}")
        print(f"  - has filters: {bool(data.get('filters'))}")
        print(f"  - filters courses: {data.get('filters', {}).get('courses')}")
    else:
        print("\nErro obtido da API:")
        print(response.text)
        
except Exception as e:
    import traceback
    traceback.print_exc()

# Limpar overrides
app.main.app.dependency_overrides.clear()
