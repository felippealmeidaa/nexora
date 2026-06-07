import sys
sys.path.append(r"C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main")

import app.main # Loads all models in correct order
from app.database import SessionLocal
from app.models.student import Student, StudentStatus
from app.models.scraped_data import ScrapedSubject

db = SessionLocal()
try:
    print("=== ALUNOS COM LAST_SYNC_AT NÃO NULO ===")
    synced_students = db.query(Student).filter(Student.last_sync_at.isnot(None)).all()
    for s in synced_students:
        print(f"Student: id={s.id}, name={s.name}, reg={s.registration_number}, course={s.course_name}, sync_at={s.last_sync_at}")
        
        # Check ScrapedSubjects for this student
        subjects = db.query(ScrapedSubject).filter(ScrapedSubject.student_id == s.id).all()
        print(f"  Scraped subjects count: {len(subjects)}")
        for subj in subjects[:5]:
            print(f"    - Subject: {subj.disciplina}, status={subj.situacao}, docente={subj.docente}")
        if len(subjects) > 5:
            print("    ...")

    print(f"\nTotal Students in DB: {db.query(Student).count()}")
    print(f"Total Active Students in DB: {db.query(Student).filter(Student.status == StudentStatus.ACTIVE).count()}")
    print(f"Total Synced Students in DB: {len(synced_students)}")

except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
