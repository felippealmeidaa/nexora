import sys
sys.path.append(r"C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main")

import app.main
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.coordinator import Coordinator

db = SessionLocal()
try:
    print("=== COORDENADORES CADASTRADOS ===")
    coordinators = db.query(User).filter(User.role == UserRole.COORDINATOR).all()
    for c in coordinators:
        coord_profile = db.query(Coordinator).filter(Coordinator.user_id == c.id).first()
        course = coord_profile.academic_course_name if coord_profile else "Sem perfil de coordenador"
        print(f"User: id={c.id}, username={c.username}, email={c.email}, course={course}")
except Exception as e:
    print("Error:", e)
finally:
    db.close()
