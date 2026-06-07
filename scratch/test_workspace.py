import app.main # Carrega todo o ecossistema de models e endpoints

import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User, UserRole
from app.models.historical_data import HistoricalRecord
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.services.historical_analysis_service import HistoricalAnalysisService

# Inicializar SQLAlchemy Session
engine = create_engine("sqlite:///academico.db")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Obter usuário Jefferson (user_id = 7)
jeff = db.query(User).filter(User.id == 7).first()
print(f"Usuário: {jeff.username}, Email: {jeff.email}, Role: {jeff.role}")

# Instanciar o serviço de análise
service = HistoricalAnalysisService(db)

try:
    print("\nExecutando get_scoped_records...")
    records, scope = service.get_scoped_records(current_user=jeff)
    print(f"Quantidade de registros scoped retornados: {len(records)}")
    print(f"Escopo: {scope}")
    
    print("\nExecutando build_workspace...")
    workspace = service.build_workspace(current_user=jeff)
    overview = workspace.get("overview", {})
    print("Overview do Workspace:")
    for k, v in overview.items():
        if k != "model_diagnostics":
            print(f"  - {k}: {v}")
            
    print("\nQuantidade de classes em analysis_data:")
    by_class = workspace.get("analysis_data", {}).get("by_class", [])
    print(f"  - Classes encontradas: {len(by_class)}")
    
except Exception as e:
    import traceback
    print("Erro durante a execução do serviço:")
    traceback.print_exc()

db.close()
