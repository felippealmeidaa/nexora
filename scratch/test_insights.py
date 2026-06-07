import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def main():
    print("1. Tentando fazer login como professor.demo...")
    login_data = {
        "username": "professor.demo",
        "password": "professor123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        print(f"Status do Login: {response.status_code}")
        if response.status_code != 200:
            print(f"Erro no login: {response.text}")
            return
        
        token = response.json().get("access_token")
        headers = {
            "Authorization": f"Bearer {token}"
        }
        print("Login bem sucedido!")
        
        # 2. Obter as planilhas
        print("\n2. Buscando planilhas históricas do professor...")
        resp_sheets = requests.get(f"{BASE_URL}/historical-data/spreadsheets", headers=headers)
        print(f"Status: {resp_sheets.status_code}")
        sheets = resp_sheets.json()
        print(f"Planilhas encontradas: {len(sheets)}")
        
        spreadsheet_id = None
        if sheets:
            for s in sheets:
                print(f"  - Planilha ID: {s['id']}, Nome: {s['filename']}, Curso: {s.get('course_name')}")
            spreadsheet_id = sheets[0]['id']
        else:
            print("Nenhuma planilha encontrada no banco de dados!")
            
        # 3. Testar Insights Gerais de IA (GET /api/analytics/ai-insights)
        print("\n3. Chamando insights gerais (GET /api/analytics/ai-insights)...")
        resp_gen_insights = requests.get(f"{BASE_URL}/analytics/ai-insights", headers=headers)
        print(f"Status: {resp_gen_insights.status_code}")
        try:
            print(f"Resultado:\n{json.dumps(resp_gen_insights.json(), indent=2, ensure_ascii=False)}")
        except Exception as e:
            print(f"Corpo (não JSON): {resp_gen_insights.text}")

        # 4. Testar Insights de Planilha (POST /api/historical-data/spreadsheets/{id}/ai-insights)
        if spreadsheet_id:
            print(f"\n4. Chamando insights da planilha {spreadsheet_id} (POST /api/historical-data/spreadsheets/{spreadsheet_id}/ai-insights)...")
            resp_sheet_insights = requests.post(f"{BASE_URL}/historical-data/spreadsheets/{spreadsheet_id}/ai-insights", headers=headers)
            print(f"Status: {resp_sheet_insights.status_code}")
            try:
                print(f"Resultado:\n{json.dumps(resp_sheet_insights.json(), indent=2, ensure_ascii=False)[:1000]}...")
            except Exception as e:
                print(f"Corpo (não JSON): {resp_sheet_insights.text}")
        else:
            print("\n4. Ignorando teste de planilha porque nenhuma foi encontrada.")
            
    except Exception as exc:
        print(f"Erro na conexão com o servidor local: {exc}")

if __name__ == "__main__":
    main()
