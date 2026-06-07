import sys
import app.main
from app.database import SessionLocal
from app.models.student import Student
from app.models.scraped_data import ScrapedSubject, ScrapedGrade, ScrapedAttendance

def run():
    db = SessionLocal()
    try:
        total = db.query(Student).count()
        synced = db.query(Student).filter(Student.last_sync_at.isnot(None)).count()
        
        with_sub = db.query(ScrapedSubject.student_id).distinct().count()
        with_grade = db.query(ScrapedGrade.student_id).distinct().count()
        with_att = db.query(ScrapedAttendance.student_id).distinct().count()
        
        # Find students who have actual scraped records
        scraped_student_ids = set()
        for row in db.query(ScrapedSubject.student_id).distinct().all():
            scraped_student_ids.add(row[0])
        for row in db.query(ScrapedGrade.student_id).distinct().all():
            scraped_student_ids.add(row[0])
        for row in db.query(ScrapedAttendance.student_id).distinct().all():
            scraped_student_ids.add(row[0])
            
        print(f"Total students in DB: {total}")
        print(f"Synced students (last_sync_at not null): {synced}")
        print(f"Students with ScrapedSubject: {with_sub}")
        print(f"Students with ScrapedGrade: {with_grade}")
        print(f"Students with ScrapedAttendance: {with_att}")
        print(f"Unique student IDs with ANY scraped data: {len(scraped_student_ids)}")
        
        # Let's inspect some of the students without scraped data but synced
        empty_synced = db.query(Student).filter(Student.last_sync_at.isnot(None), ~Student.id.in_(list(scraped_student_ids))).all()
        print(f"Synced students with NO scraped data: {len(empty_synced)}")
        for s in empty_synced[:5]:
            print(f"  - ID: {s.id}, Name: {s.name}, Course: {s.course_name}")
            
    finally:
        db.close()

if __name__ == "__main__":
    run()
