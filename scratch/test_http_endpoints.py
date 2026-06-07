import requests

def test_endpoints():
    # 1. Test Professor
    session_prof = requests.Session()
    login_url = "http://127.0.0.1:8000/api/auth/login"
    login_payload_prof = {
        "identifier": "professor.demo",
        "password": "professor123"
    }
    
    print("=== TESTING PROFESSOR ENDPOINTS ===")
    try:
        r_login = session_prof.post(login_url, json=login_payload_prof)
        if r_login.status_code == 200:
            print("Professor logged in successfully.")
            r_students = session_prof.get("http://127.0.0.1:8000/api/professors/me/students")
            print(f"Professor students status: {r_students.status_code}")
            if r_students.status_code == 200:
                data = r_students.json()
                total_in_list = sum(len(entry.get("students", [])) for entry in data)
                print(f"Total students in list: {total_in_list}")
        else:
            print(f"Professor login failed: {r_login.text}")
    except Exception as e:
        print(f"Error: {e}")

    # 2. Test Coordinator
    session_coord = requests.Session()
    login_payload_coord = {
        "identifier": "coordenador.demo",
        "password": "coordenador123"
    }
    
    print("\n=== TESTING COORDINATOR ENDPOINTS ===")
    try:
        r_login = session_coord.post(login_url, json=login_payload_coord)
        if r_login.status_code == 200:
            print("Coordinator logged in successfully.")
            r_students = session_coord.get("http://127.0.0.1:8000/api/coordinators/me/students")
            print(f"Coordinator students status: {r_students.status_code}")
            if r_students.status_code == 200:
                data = r_students.json()
                print(f"Total students in coordinator list: {len(data)}")
                if len(data) > 0:
                    print(f"Sample student in coordinator list: {data[0]['student_name']} (Course: {data[0]['course_name']})")
                    
            r_overview = session_coord.get("http://127.0.0.1:8000/api/coordinators/me/overview")
            print(f"Coordinator overview status: {r_overview.status_code}")
            if r_overview.status_code == 200:
                overview_data = r_overview.json()
                print("Coordinator overview KPIs:", overview_data.get("kpis"))
        else:
            print(f"Coordinator login failed: {r_login.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_endpoints()
