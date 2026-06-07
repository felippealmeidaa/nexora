import sys
# Import app.main to load all models and routers
import app.main
from app.database import SessionLocal
from app.models.user import User
from app.models.professor import Professor
from app.routers.professors import get_my_profile

def test():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "professor.demo").first()
        if not user:
            print("USER 'professor.demo' NOT FOUND!")
            return
        print(f"User found: ID={user.id}, Username={user.username}, Role={user.role}")
        
        professor = db.query(Professor).filter(Professor.user_id == user.id).first()
        if not professor:
            print("Professor record NOT FOUND for user!")
        else:
            print(f"Professor found: ID={professor.id}, UserID={professor.user_id}")
            
        # Call endpoint logic
        res = get_my_profile(db=db, current_user=user)
        print("Endpoint profile response:", res)
    except Exception as e:
        print("ERROR RUNNING ENDPOINT:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
