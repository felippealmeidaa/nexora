from __future__ import annotations

from io import BytesIO, StringIO
from datetime import datetime
import csv
import json
from typing import Any

from fastapi import HTTPException


ANALYSIS_TITLES = {
    "overview": "Visao geral",
    "by_class": "Analise por turma",
    "between_classes": "Comparativo entre turmas",
    "by_semester": "Analise por semestre",
    "intervention_window": "Janela de Intervencao Critica",
    "high_risk_classes": "Turmas com maior risco",
    "discipline_bottlenecks": "Gargalos por disciplina",
    "intervention_priorities": "Prioridades de intervencao",
}


class HistoricalExportService:
    def get_analysis_rows(self, workspace: dict[str, Any], analysis_id: str) -> list[dict[str, Any]]:
        analysis_data = workspace.get("analysis_data", {})

        if analysis_id == "overview":
            overview = workspace.get("overview", {})
            course_distribution = overview.get("course_distribution") or {}
            top_courses = ", ".join(
                f"{course} ({total})"
                for course, total in sorted(course_distribution.items(), key=lambda item: item[1], reverse=True)[:5]
            ) or "Sem concentracao relevante"

            rows = [
                {"categoria": "Base", "indicador": "Registros analisados", "valor": overview.get("total_records", 0), "interpretação": "Total de linhas aproveitadas no recorte."},
                {"categoria": "Base", "indicador": "Alunos mapeados", "valor": overview.get("total_students", 0), "interpretação": "Quantidade de estudantes distintos considerados."},
                {"categoria": "Base", "indicador": "Turmas mapeadas", "valor": overview.get("total_classes", 0), "interpretação": "Turmas incluídas no recorte analítico."},
                {"categoria": "Desempenho", "indicador": "Media de notas", "valor": overview.get("avg_grade", 0.0), "interpretação": "Panorama consolidado de desempenho."},
                {"categoria": "Desempenho", "indicador": "Presenca media", "valor": overview.get("avg_attendance", 0.0), "interpretação": "Frequencia média observada no recorte."},
                {"categoria": "Risco", "indicador": "Risco medio", "valor": overview.get("avg_risk", 0.0), "interpretação": "Quanto maior, maior a necessidade de acompanhamento."},
                {"categoria": "Risco", "indicador": "Turmas criticas", "valor": overview.get("critical_classes", 0), "interpretação": "Turmas com maior concentração de alunos em alerta."},
                {"categoria": "Distribuicao", "indicador": "Cursos em destaque", "valor": top_courses, "interpretação": "Cursos mais representados na base atual."},
            ]

            if overview.get("training_strategy"):
                rows.append({
                    "categoria": "Treinamento",
                    "indicador": "Estrategia historica",
                    "valor": overview.get("historical_training_records", 0),
                    "interpretação": overview.get("training_strategy"),
                })
            return rows

        rows = analysis_data.get(analysis_id)
        if rows is None:
            raise HTTPException(status_code=404, detail="Analise solicitada nao encontrada para exportacao.")

        normalized_rows = []
        for row in rows:
            normalized = {}
            for key, value in row.items():
                normalized[self._humanize_key(key)] = self._normalize_value(value)
            normalized_rows.append(normalized)
        return normalized_rows

    def build_filename(self, analysis_id: str, export_format: str) -> str:
        return f"nexora-{analysis_id}.{export_format}"

    def build_executive_summary(self, payload: dict[str, Any]) -> list[str]:
        overview = payload.get("overview", {})
        scope = payload.get("scope", {})
        filters = payload.get("filters", {})
        lines = [
            f"Analise exportada: {payload.get('analysis_title', 'Nao informado')}.",
            f"Escopo: {scope.get('label', 'Nao informado')}.",
        ]

        if scope.get("description"):
            lines.append(scope["description"])

        if overview:
            lines.append(
                f"Base com {overview.get('total_students', 0)} alunos, {overview.get('total_classes', 0)} turmas e media geral de {overview.get('avg_grade', 0.0)}."
            )
            lines.append(
                f"Frequencia media de {overview.get('avg_attendance', 0.0)}% e risco medio de {overview.get('avg_risk', 0.0)}."
            )

        filter_parts = [
            f"Semestre: {filters.get('semester')}" if filters.get("semester") else None,
            f"Curso: {filters.get('course_name')}" if filters.get("course_name") else None,
            f"Disciplina: {filters.get('subject')}" if filters.get("subject") else None,
            f"Turmas selecionadas: {filters.get('class_ids')}" if filters.get("class_ids") else None,
        ]
        active_filters = [item for item in filter_parts if item]
        if active_filters:
            lines.append("Filtros aplicados: " + " | ".join(active_filters))

        if overview.get("training_strategy"):
            lines.append("Uso historico no treinamento: " + str(overview.get("training_strategy")))

        return lines

    def export_json(self, payload: dict[str, Any]) -> bytes:
        normalized = {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "analysis": {
                "id": payload.get("analysis_id"),
                "title": payload.get("analysis_title"),
            },
            "scope": payload.get("scope", {}),
            "filters": payload.get("filters", {}),
            "executive_summary": self.build_executive_summary(payload),
            "overview": payload.get("overview", {}),
            "rows": payload.get("rows", []),
        }
        return json.dumps(normalized, ensure_ascii=False, indent=2).encode("utf-8")

    def export_csv(self, payload: dict[str, Any]) -> bytes:
        output = StringIO()
        output.write("NEXORA - Exportacao Analitica\n")
        output.write(f"Analise;{payload.get('analysis_title', 'Nao informado')}\n")
        output.write(f"Gerado em;{datetime.utcnow().isoformat()}Z\n")
        for line in self.build_executive_summary(payload):
            output.write(f"Resumo;{line}\n")
        output.write("\n")

        rows = payload.get("rows", [])
        if rows:
            writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()), delimiter=';')
            writer.writeheader()
            for row in rows:
                writer.writerow({key: self._normalize_value(value) for key, value in row.items()})
        else:
            output.write("sem_dados\n")
        return output.getvalue().encode("utf-8")

    def export_xlsx(self, payload: dict[str, Any]) -> bytes:
        from openpyxl import Workbook
        from openpyxl.styles import Font

        workbook = Workbook()
        summary_sheet = workbook.active
        summary_sheet.title = "Resumo"
        summary_sheet["A1"] = "NEXORA - Exportacao Analitica"
        summary_sheet["A1"].font = Font(bold=True, size=14)
        summary_sheet["A3"] = "Analise"
        summary_sheet["B3"] = payload.get("analysis_title", "Nao informado")
        summary_sheet["A4"] = "Gerado em"
        summary_sheet["B4"] = datetime.utcnow().isoformat() + "Z"

        row_cursor = 6
        for line in self.build_executive_summary(payload):
            summary_sheet[f"A{row_cursor}"] = line
            row_cursor += 1

        data_sheet = workbook.create_sheet("Dados")
        rows = payload.get("rows", [])
        if rows:
            headers = list(rows[0].keys())
            data_sheet.append(headers)
            for row in rows:
                data_sheet.append([self._normalize_value(row.get(header)) for header in headers])
        else:
            data_sheet.append(["sem_dados"])

        stream = BytesIO()
        workbook.save(stream)
        return stream.getvalue()

    def export_pdf(self, payload: dict[str, Any]) -> bytes:
        try:
            from reportlab.lib import colors
            from reportlab.lib.enums import TA_LEFT
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="A exportacao em PDF esta indisponivel porque a dependencia reportlab nao esta instalada.",
            ) from exc

        buffer = BytesIO()
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
        )

        styles = getSampleStyleSheet()
        heading = ParagraphStyle(
            name="Heading",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0F172A"),
            alignment=TA_LEFT,
        )
        subtitle = ParagraphStyle(
            name="Subtitle",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#1E3A8A"),
        )
        body = ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#475569"),
        )

        elements = [
            Paragraph("NEXORA - Exportacao analitica", heading),
            Spacer(1, 4 * mm),
            Paragraph(f"Analise: {payload.get('analysis_title', 'Nao informado')}", subtitle),
            Spacer(1, 2 * mm),
        ]

        for line in self.build_executive_summary(payload):
            elements.append(Paragraph(line, body))
            elements.append(Spacer(1, 1.4 * mm))

        elements.append(Spacer(1, 4 * mm))
        elements.append(Paragraph("Quadro analitico", subtitle))
        elements.append(Spacer(1, 2 * mm))

        rows = payload.get("rows", [])
        table_rows = []
        if rows:
            headers = list(rows[0].keys())[:5]
            table_rows.append([str(header) for header in headers])
            for row in rows[:30]:
                table_rows.append([self._truncate(self._normalize_value(row.get(header)), 42) for header in headers])
        else:
            table_rows.append(["Sem dados disponiveis"])

        table = Table(table_rows, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003B8F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("LEADING", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(table)
        document.build(elements)
        return buffer.getvalue()

    def _truncate(self, value: Any, limit: int = 46) -> str:
        text = str(value if value is not None else "")
        if len(text) <= limit:
            return text
        return f"{text[:limit - 3]}..."

    def _humanize_key(self, key: str) -> str:
        return str(key or "").replace("_", " ").strip().title()

    def _normalize_value(self, value: Any) -> Any:
        if isinstance(value, list):
            return " | ".join(str(item) for item in value)
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False)
        if isinstance(value, bool):
            return "Sim" if value else "Nao"
        return value
