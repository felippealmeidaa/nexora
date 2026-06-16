"""
Service de scraping do Lyceum.

Mantem compatibilidade minima com o fluxo legado de aluno e
implementa o novo fluxo de scraping no portal docente.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import logging
import os
import random
import re
import sys
import time
import unicodedata
from pathlib import Path
from shutil import which
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from sqlalchemy.orm import Session

from app.config import settings
from app.utils.attendance import normalize_attendance_records, resolve_total_classes
from app.utils.subject_name import clean_subject_name, normalize_subject_key

logger = logging.getLogger(__name__)


class LyceumScraperService:
    BASE_URL = "https://portal.unievangelica.edu.br/aluno/"
    LOGIN_URL = BASE_URL + "#/login"
    DISCIPLINAS_URL = BASE_URL + "#/home/disciplinas"
    DOCENTE_BASE_URL = "https://academico.unievangelica.edu.br/DOnline/DOnline"
    DOCENTE_LOGIN_URL = DOCENTE_BASE_URL + "/avisos/TDOL303D.tp"
    DOCENTE_CLASSES_URL = (
        DOCENTE_BASE_URL
        + "/geral/TDOL300D.tp?aplicacaoOrigem=DOnline&moduloOrigem=turma&transacaoOrigem=TDOL306D&tipoTurma=MATRICULADA"
    )

    def __init__(self):
        self.driver = None
        self.active_browser_name: Optional[str] = None
        self.http_session = None
        self._trace_steps: list[str] = []

    def _trace(self, message: str) -> None:
        logger.info("[lyceum-docente] %s", message)
        self._trace_steps.append(message)

    def _ensure_selenium_available(self) -> None:
        if importlib.util.find_spec("selenium") is not None:
            return

        major = sys.version_info.major
        minor = sys.version_info.minor
        local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
        app_data = Path(os.environ.get("APPDATA", ""))

        candidate_paths = [
            app_data / f"Python/Python{major}{minor}/site-packages",
            local_app_data / f"Programs/Python/Python{major}{minor}/Lib/site-packages",
        ]

        package_roots = local_app_data / "Packages"
        if package_roots.exists():
            for package_dir in package_roots.glob("PythonSoftwareFoundation.Python.*"):
                candidate_paths.append(
                    package_dir / f"LocalCache/local-packages/Python{major}{minor}/site-packages"
                )

        for candidate in candidate_paths:
            if candidate.exists() and str(candidate) not in sys.path:
                sys.path.append(str(candidate))
                if importlib.util.find_spec("selenium") is not None:
                    logger.info("selenium carregado a partir de %s", candidate)
                    return

        raise RuntimeError(
            "A dependencia selenium nao esta disponivel no ambiente atual. "
            "Instale-a no mesmo Python do backend."
        )

    def _browser_candidates(self, browser_name: str) -> list[str]:
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("PROGRAMFILES", "")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)", "")
        if browser_name == "chrome":
            candidates = [
                os.environ.get("NEXORA_BROWSER_BINARY", ""),
                os.environ.get("CHROME_BINARY", ""),
                which("google-chrome") or "",
                which("google-chrome-stable") or "",
                which("chromium") or "",
                which("chromium-browser") or "",
            ]
            if os.name == "nt":
                candidates.extend(
                    [
                        str(Path(local_app_data) / "Google/Chrome/Application/chrome.exe"),
                        str(Path(program_files) / "Google/Chrome/Application/chrome.exe"),
                        str(Path(program_files_x86) / "Google/Chrome/Application/chrome.exe"),
                    ]
                )
            return candidates

        candidates = [
            os.environ.get("NEXORA_EDGE_BINARY", ""),
            os.environ.get("EDGE_BINARY", ""),
            which("microsoft-edge") or "",
            which("microsoft-edge-stable") or "",
            which("msedge") or "",
        ]
        if os.name == "nt":
            candidates.extend(
                [
                    str(Path(local_app_data) / "Microsoft/Edge/Application/msedge.exe"),
                    str(Path(program_files) / "Microsoft/Edge/Application/msedge.exe"),
                    str(Path(program_files_x86) / "Microsoft/Edge/Application/msedge.exe"),
                ]
            )
        return candidates

    def _find_browser_binary(self, browser_name: str) -> Optional[str]:
        for candidate in self._browser_candidates(browser_name):
            if candidate and Path(candidate).exists():
                return candidate
        return None

    def _find_driver_binary(self, browser_name: str) -> Optional[str]:
        if browser_name == "chrome":
            driver_candidates = [
                os.environ.get("NEXORA_DRIVER_BINARY", ""),
                os.environ.get("CHROMEDRIVER_PATH", ""),
                which("chromedriver") or "",
                which("chromedriver.exe") or "",
            ]
        else:
            driver_candidates = [
                os.environ.get("NEXORA_DRIVER_BINARY", ""),
                os.environ.get("EDGEDRIVER_PATH", ""),
                which("msedgedriver") or "",
                which("msedgedriver.exe") or "",
            ]

        for candidate in driver_candidates:
            if candidate and Path(candidate).exists():
                return candidate

        home = Path.home()
        cache_root = home / ".cache/selenium"
        if not cache_root.exists():
            return None
        executable_names = (
            ["chromedriver", "chromedriver.exe"]
            if browser_name == "chrome"
            else ["msedgedriver", "msedgedriver.exe"]
        )
        for executable_name in executable_names:
            matches = sorted(cache_root.rglob(executable_name), reverse=True)
            if matches:
                return str(matches[0])
        return None

    def _build_common_args(self, options):
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--disable-features=VizDisplayCompositor")
        options.add_argument("--remote-debugging-pipe")
        options.add_argument("--log-level=3")
        options.add_argument("--window-size=1920,1080")
        return options

    def _init_driver(self) -> None:
        self._ensure_selenium_available()

        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options as ChromeOptions
        from selenium.webdriver.chrome.service import Service as ChromeService
        from selenium.webdriver.edge.options import Options as EdgeOptions
        from selenium.webdriver.edge.service import Service as EdgeService

        errors: list[str] = []
        for browser_name in ("chrome", "edge"):
            binary_path = self._find_browser_binary(browser_name)
            driver_path = self._find_driver_binary(browser_name)
            try:
                if browser_name == "chrome":
                    options = self._build_common_args(ChromeOptions())
                    if binary_path:
                        options.binary_location = binary_path
                    service = ChromeService(executable_path=driver_path) if driver_path else ChromeService()
                    self.driver = webdriver.Chrome(service=service, options=options)
                else:
                    options = self._build_common_args(EdgeOptions())
                    if binary_path:
                        options.binary_location = binary_path
                    service = EdgeService(executable_path=driver_path) if driver_path else EdgeService()
                    self.driver = webdriver.Edge(service=service, options=options)

                self.driver.implicitly_wait(10)
                self.active_browser_name = browser_name
                self._trace(f"navegador Selenium inicializado com {browser_name}")
                return
            except Exception as exc:
                errors.append(f"{browser_name}: {exc}")
                self._close_driver()

        raise RuntimeError(
            "Nao foi possivel inicializar o navegador de scraping. "
            f"Tentativas: {' | '.join(errors)}"
        )

    def _close_driver(self) -> None:
        if self.http_session:
            try:
                self.http_session.close()
            except Exception:
                pass
            self.http_session = None

        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
            self.active_browser_name = None

    @staticmethod
    def _normalize_portal_label(value: str | None) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(char for char in text if not unicodedata.combining(char))
        text = re.sub(r"\s+", " ", text)
        return text.strip().lower()

    def _wait_for_text(self, expected_text: str, timeout_seconds: int = 180) -> bool:
        expected_key = self._normalize_portal_label(expected_text)
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            try:
                body_text = self.driver.find_element("tag name", "body").text or ""
                if expected_key in self._normalize_portal_label(body_text):
                    return True
            except Exception:
                pass
            time.sleep(1.0)
        return False

    def _find_visible_inputs(self):
        inputs = []
        for element in self.driver.find_elements("css selector", "input"):
            try:
                if not element.is_displayed():
                    continue
                input_type = (element.get_attribute("type") or "text").lower()
                if input_type in {"hidden", "submit", "button", "checkbox", "radio"}:
                    continue
                inputs.append(element)
            except Exception:
                continue
        return inputs

    def _click_element_by_text(
        self,
        labels: list[str],
        selectors: str = "a, button, input[type='submit']",
    ) -> bool:
        normalized_labels = [self._normalize_portal_label(label) for label in labels if label]
        for element in self.driver.find_elements("css selector", selectors):
            try:
                if not element.is_displayed():
                    continue
                raw_label = " ".join(
                    [
                        element.text or "",
                        element.get_attribute("value") or "",
                        element.get_attribute("title") or "",
                    ]
                ).strip()
                normalized_label = self._normalize_portal_label(raw_label)
                if any(label and label == normalized_label for label in normalized_labels):
                    element.click()
                    return True
            except Exception:
                continue
        return False

    def _extract_professor_name_from_text(self, raw_text: str) -> str | None:
        match = re.search(r"USU[ÁA]RIO:\s*([A-ZÀ-Ÿ\s]+)", raw_text, re.IGNORECASE)
        if not match:
            return None
        return " ".join(match.group(1).strip().split())

    def _create_authenticated_http_session(self) -> None:
        try:
            import requests
        except Exception:
            self.http_session = None
            self._trace("requests indisponivel; scraper seguira apenas com Selenium")
            return

        session = requests.Session()
        try:
            user_agent = self.driver.execute_script("return navigator.userAgent;")
        except Exception:
            user_agent = None

        if user_agent:
            session.headers.update({"User-Agent": str(user_agent)})

        for cookie in self.driver.get_cookies():
            try:
                session.cookies.set(
                    cookie.get("name"),
                    cookie.get("value"),
                    domain=cookie.get("domain"),
                    path=cookie.get("path") or "/",
                )
            except Exception:
                continue

        self.http_session = session
        self._trace("sessao HTTP autenticada criada a partir dos cookies do Selenium")

    def _fetch_html_with_fallback(
        self,
        url: str,
        *,
        expected_markers: list[str],
        timeout_seconds: int = 240,
    ) -> str:
        normalized_markers = [self._normalize_portal_label(marker) for marker in expected_markers if marker]

        if self.http_session:
            try:
                response = self.http_session.get(url, timeout=min(timeout_seconds, 60))
                response.raise_for_status()
                html = response.text or ""
                normalized_html = self._normalize_portal_label(html)
                if all(marker in normalized_html for marker in normalized_markers):
                    return html
            except Exception as exc:
                self._trace(f"requests falhou para {url}; fallback para Selenium ({exc})")

        self.driver.get(url)
        deadline = time.time() + timeout_seconds
        last_html = ""
        while time.time() < deadline:
            try:
                html = self.driver.page_source or ""
                last_html = html
                normalized_html = self._normalize_portal_label(html)
                if all(marker in normalized_html for marker in normalized_markers):
                    return html
            except Exception:
                pass
            time.sleep(1.0)
        return last_html

    def _extract_table_headers(self, table) -> list[str]:
        for row in table.find_all("tr"):
            cells = row.find_all(["th", "td"])
            values = [cell.get_text(" ", strip=True) for cell in cells]
            normalized = [self._normalize_portal_label(value) for value in values]
            if "aluno" in normalized or "nome" in normalized:
                return values
        return []

    @staticmethod
    def _extract_cell_text_by_class(row_table, class_fragment: str) -> str:
        if not row_table or not class_fragment:
            return ""
        cell = row_table.find(
            "td",
            class_=lambda value: bool(value and class_fragment in value),
        )
        if not cell:
            return ""
        return cell.get_text(" ", strip=True)

    @staticmethod
    def _extract_click_target_id(row_table) -> str | None:
        if not row_table:
            return None

        clickable = row_table.find(
            lambda tag: tag.name in {"span", "a", "div"}
            and (
                (tag.get("id") and "gpfNomeDisciplina:" in tag.get("id"))
                or (tag.get("onclick") and "linkMethodCall(" in tag.get("onclick"))
            )
        )
        if not clickable:
            return None

        click_id = clickable.get("id")
        if click_id:
            return str(click_id).strip() or None

        onclick = str(clickable.get("onclick") or "")
        match = re.search(r"linkMethodCall\((\d+)\)", onclick)
        if not match:
            return None
        return f"gpfNomeDisciplina:{match.group(1)}"

    @staticmethod
    def _canonical_detail_field_name(normalized_label: str) -> str | None:
        aliases = {
            "usuario": "usuario",
            "email": "email",
            "curso": "curso",
            "disciplina": "disciplina",
            "unid. resp.": "unidade_responsavel",
            "unid. fisica": "unidade_fisica",
            "turma": "turma",
            "turno": "turno",
            "sala": "sala",
            "matriculados": "matriculados",
            "periodo letivo": "periodo_letivo",
            "situacao": "situacao",
            "carga horaria": "carga_horaria",
        }
        return aliases.get(normalized_label)

    @staticmethod
    def _detail_field_id_aliases() -> dict[str, str]:
        return {
            "blkTurma.txtDocente": "usuario",
            "blkTurma.txtEmail": "email",
            "blkTurma.txtCurso": "curso",
            "blkTurma.txtDisciplina": "disciplina",
            "blkTurma.txtUnidadeResponsavel": "unidade_responsavel",
            "blkTurma.txtUnidadeFisica": "unidade_fisica",
            "blkTurma.txtTurma": "turma",
            "blkTurma.txtTurno": "turno",
            "blkTurma.txtSala": "sala",
            "blkTurma.txtMatriculados": "matriculados",
            "blkTurma.txtPeriodoLetivo": "periodo_letivo",
            "blkTurma.txtSituacao": "situacao",
            "blkTurma.txtCargaHoraria": "carga_horaria",
        }

    @staticmethod
    def _canonical_student_column_name(normalized_label: str) -> str | None:
        aliases = {
            "aluno": "aluno",
            "codigo": "codigo",
            "situacao": "situacao",
            "curso": "curso",
            "va1": "va1",
            "va2": "va2",
            "va3": "va3",
            "frequencia (%)": "frequencia_percentual",
            "frequencia": "frequencia_percentual",
        }
        return aliases.get(normalized_label)

    def _parse_docente_catalog_html(self, html: str) -> list[dict[str, Any]]:
        try:
            from bs4 import BeautifulSoup
        except Exception:
            self._trace("beautifulsoup4 indisponivel; parse de catalogo nao pode prosseguir")
            return []

        soup = BeautifulSoup(html or "", "html.parser")
        seen_urls: set[str] = set()
        seen_click_targets: set[str] = set()
        header_aliases = {
            "disciplina": "external_class_code",
            "nome": "subject_name",
            "turma": "class_code",
            "periodo letivo": "period_label",
            "inicio": "start_date_label",
            "termino": "end_date_label",
            "aulas previstas": "lessons_planned",
            "aulas dadas": "lessons_given",
            "vagas": "vacancies",
            "pre matriculados": "pre_enrolled",
            "matriculados": "enrolled_count",
            "cancelados trancados": "cancelled_count",
        }

        payload: list[dict[str, Any]] = []

        fragmented_rows = soup.find_all(
            "table",
            class_=lambda value: bool(value and "x-grid3-row-table" in value),
        )
        for row_table in fragmented_rows:
            subject_name = clean_subject_name(
                self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfNomeDisciplina")
            )
            if not subject_name:
                continue

            click_target_id = self._extract_click_target_id(row_table)
            if click_target_id and click_target_id in seen_click_targets:
                continue

            row_payload = {
                "catalog_click_target_id": click_target_id,
                "external_class_code": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfCodDisciplina"),
                "subject_name": subject_name,
                "class_code": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfTurma"),
                "period_label": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfDescPeriodo"),
                "start_date_label": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfDataInicio"),
                "end_date_label": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfDataFim"),
                "lessons_planned": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfAulasPrevistas"),
                "lessons_given": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfAulasDadas"),
                "vacancies": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfNumVagasTurma"),
                "pre_enrolled": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfNumAlunosPreMatriculados"),
                "enrolled_count": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfQtdAlunosMatriculados"),
                "cancelled_count": self._extract_cell_text_by_class(row_table, "x-grid3-td-gpfQtdAlunosCanceladosTrancados"),
            }

            if click_target_id:
                seen_click_targets.add(click_target_id)

            payload.append(
                {
                    "detail_url": None,
                    "catalog_click_target_id": click_target_id,
                    "external_class_code": str(row_payload.get("external_class_code") or "").strip() or None,
                    "subject_name": subject_name,
                    "class_code": str(row_payload.get("class_code") or "").strip() or None,
                    "period_label": str(row_payload.get("period_label") or "").strip() or None,
                    "start_date_label": str(row_payload.get("start_date_label") or "").strip() or None,
                    "end_date_label": str(row_payload.get("end_date_label") or "").strip() or None,
                    "lessons_planned": self._parse_optional_int(row_payload.get("lessons_planned")),
                    "lessons_given": self._parse_optional_int(row_payload.get("lessons_given")),
                    "vacancies": self._parse_optional_int(row_payload.get("vacancies")),
                    "pre_enrolled": self._parse_optional_int(row_payload.get("pre_enrolled")),
                    "enrolled_count": self._parse_optional_int(row_payload.get("enrolled_count")),
                    "cancelled_count": self._parse_optional_int(row_payload.get("cancelled_count")),
                }
            )

        if payload:
            return payload

        for table in soup.find_all("table"):
            headers = self._extract_table_headers(table)
            normalized_headers = [self._normalize_portal_label(header) for header in headers]
            if "nome" not in normalized_headers or "periodo letivo" not in normalized_headers:
                continue

            for row in table.find_all("tr"):
                cells = row.find_all("td")
                if not cells:
                    continue

                anchor = row.find("a", href=re.compile(r"TDOL306D|turma/TDOL306D", re.IGNORECASE))
                if not anchor:
                    continue

                detail_url = urljoin(self.DOCENTE_BASE_URL + "/", anchor.get("href") or "")
                if not detail_url or detail_url in seen_urls:
                    continue

                values = [cell.get_text(" ", strip=True) for cell in cells]
                if len(values) < len(headers):
                    values.extend([""] * (len(headers) - len(values)))

                row_payload: dict[str, Any] = {"detail_url": detail_url}
                for index, normalized_header in enumerate(normalized_headers):
                    alias = header_aliases.get(normalized_header)
                    if alias:
                        row_payload[alias] = values[index] if index < len(values) else ""

                subject_name = clean_subject_name(row_payload.get("subject_name") or "")
                if not subject_name:
                    continue

                seen_urls.add(detail_url)
                payload.append(
                    {
                        "detail_url": detail_url,
                        "external_class_code": str(row_payload.get("external_class_code") or "").strip() or None,
                        "subject_name": subject_name,
                        "class_code": str(row_payload.get("class_code") or "").strip() or None,
                        "period_label": str(row_payload.get("period_label") or "").strip() or None,
                        "start_date_label": str(row_payload.get("start_date_label") or "").strip() or None,
                        "end_date_label": str(row_payload.get("end_date_label") or "").strip() or None,
                        "lessons_planned": self._parse_optional_int(row_payload.get("lessons_planned")),
                        "lessons_given": self._parse_optional_int(row_payload.get("lessons_given")),
                        "vacancies": self._parse_optional_int(row_payload.get("vacancies")),
                        "pre_enrolled": self._parse_optional_int(row_payload.get("pre_enrolled")),
                        "enrolled_count": self._parse_optional_int(row_payload.get("enrolled_count")),
                        "cancelled_count": self._parse_optional_int(row_payload.get("cancelled_count")),
                    }
                )

        return payload

    def _parse_docente_class_detail_html(self, html: str) -> dict[str, Any]:
        try:
            from bs4 import BeautifulSoup
        except Exception:
            self._trace("beautifulsoup4 indisponivel; parse de detalhe nao pode prosseguir")
            return {"fields": {}, "students": []}

        soup = BeautifulSoup(html or "", "html.parser")
        fields: dict[str, str] = {}

        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue

            index = 0
            while index + 1 < len(cells):
                label = cells[index].get_text(" ", strip=True).replace(":", "")
                value_cell = cells[index + 1]
                input_field = value_cell.find("input")
                value = ""
                if input_field:
                    value = (input_field.get("value") or "").strip()
                if not value:
                    value = value_cell.get_text(" ", strip=True)
                normalized_label = self._normalize_portal_label(label)
                canonical_name = self._canonical_detail_field_name(normalized_label)
                if canonical_name and value:
                    fields[canonical_name] = value.strip()
                index += 2

        for element_id, canonical_name in self._detail_field_id_aliases().items():
            if fields.get(canonical_name):
                continue
            element = soup.find(id=element_id)
            if not element:
                continue
            value = element.get("value") if hasattr(element, "get") else None
            if not value:
                value = element.get_text(" ", strip=True)
            cleaned_value = " ".join(str(value or "").split()).strip()
            if cleaned_value:
                fields[canonical_name] = cleaned_value

        students: list[dict[str, str]] = []
        fragmented_header_table = None
        fragmented_headers: list[str] = []
        for table in soup.find_all("table"):
            headers = self._extract_table_headers(table)
            normalized_headers = [self._normalize_portal_label(header) for header in headers]
            if "aluno" not in normalized_headers:
                continue
            fragmented_header_table = table
            fragmented_headers = headers
            if "situacao" not in normalized_headers and "frequencia (%)" not in normalized_headers and "frequencia" not in normalized_headers:
                continue

            data_started = False
            for row in table.find_all("tr"):
                cells = row.find_all(["th", "td"])
                values = [cell.get_text(" ", strip=True) for cell in cells]
                normalized_values = [self._normalize_portal_label(value) for value in values]
                if not data_started:
                    if "aluno" in normalized_values:
                        data_started = True
                    continue
                if not values or len(values) < 4:
                    continue
                if len(values) < len(headers):
                    values.extend([""] * (len(headers) - len(values)))
                item: dict[str, str] = {}
                for index in range(min(len(headers), len(values))):
                    canonical_header = self._canonical_student_column_name(
                        self._normalize_portal_label(headers[index])
                    )
                    if canonical_header:
                        item[canonical_header] = values[index]
                if item.get("aluno"):
                    students.append(item)

            if students:
                break

        if not students and fragmented_header_table and fragmented_headers:
            all_tables = list(soup.find_all("table"))
            try:
                start_index = all_tables.index(fragmented_header_table) + 1
            except ValueError:
                start_index = 0

            for table in all_tables[start_index:]:
                if table is fragmented_header_table:
                    continue
                cells = table.find_all("td")
                if len(cells) < len(fragmented_headers):
                    continue

                values = [cell.get_text(" ", strip=True) for cell in cells[: len(fragmented_headers)]]
                if not values or self._normalize_portal_label(values[0]) == "aluno":
                    continue

                item: dict[str, str] = {}
                for index in range(min(len(fragmented_headers), len(values))):
                    canonical_header = self._canonical_student_column_name(
                        self._normalize_portal_label(fragmented_headers[index])
                    )
                    if canonical_header:
                        item[canonical_header] = values[index]
                if item.get("aluno"):
                    students.append(item)

        return {"fields": fields, "students": students}

    def _open_docente_class_from_catalog(self, class_payload: dict[str, Any]) -> bool:
        click_target_id = str(class_payload.get("catalog_click_target_id") or "").strip()
        subject_name = class_payload.get("subject_name") or "turma"
        if not click_target_id:
            return False

        try:
            trigger = self.driver.find_element("id", click_target_id)
            self._trace(f"clicando na turma '{subject_name}' via alvo {click_target_id}")
            trigger.click()
            return True
        except Exception as exc:
            self._trace(f"falha ao clicar na turma '{subject_name}' por id ({exc}); tentando fallback por JavaScript")

        try:
            escaped_target = json.dumps(click_target_id)
            self.driver.execute_script(
                f"""
                const target = document.getElementById({escaped_target});
                if (!target) {{
                    throw new Error('target not found');
                }}
                if (typeof target.onclick === 'function') {{
                    target.onclick();
                }} else {{
                    target.click();
                }}
                """
            )
            return True
        except Exception as exc:
            self._trace(f"fallback JavaScript falhou para '{subject_name}' ({exc})")
            return False

    def _return_to_docente_catalog(self) -> None:
        for candidate_id in ("blkTurma.lkmListarTurmas", "blkTurma\\.lkmListarTurmas"):
            try:
                if "\\" in candidate_id:
                    element = self.driver.find_element("css selector", f"#{candidate_id}")
                else:
                    element = self.driver.find_element("id", candidate_id)
                element.click()
                self._wait_for_catalog_html(timeout_seconds=240)
                return
            except Exception:
                continue

        if self._click_element_by_text(["Selecionar outra turma"], selectors="a, button, div, span"):
            self._wait_for_catalog_html(timeout_seconds=240)
            return

        self.driver.back()
        self._wait_for_catalog_html(timeout_seconds=240)

    def _wait_for_catalog_html(self, timeout_seconds: int = 240) -> str:
        deadline = time.time() + timeout_seconds
        last_html = ""
        empty_state_since: float | None = None
        while time.time() < deadline:
            try:
                html = self.driver.page_source or ""
                last_html = html
                parsed_rows = self._parse_docente_catalog_html(html)
                normalized_html = self._normalize_portal_label(html)
                if parsed_rows:
                    return html

                is_loading = "carregando" in normalized_html
                has_empty_message = (
                    "nao ha turmas desse tipo" in normalized_html
                    or "sem registros para exibir" in normalized_html
                )

                if is_loading:
                    empty_state_since = None
                elif has_empty_message:
                    if empty_state_since is None:
                        empty_state_since = time.time()
                    elif time.time() - empty_state_since >= 12:
                        self._trace("catalogo permaneceu vazio por 12s sem indicador de carregamento")
                        return html
                else:
                    empty_state_since = None
            except Exception:
                pass
            time.sleep(1.0)
        return last_html

    def _wait_for_class_detail_html(self, subject_name: str, timeout_seconds: int = 240) -> str:
        deadline = time.time() + timeout_seconds
        last_html = ""
        while time.time() < deadline:
            try:
                html = self.driver.page_source or ""
                last_html = html
                normalized_html = self._normalize_portal_label(html)
                parsed = self._parse_docente_class_detail_html(html)
                fields = parsed.get("fields", {}) or {}
                students = parsed.get("students") or []
                enrolled_count = self._parse_optional_int(fields.get("matriculados"))
                is_loading = "carregando" in normalized_html

                if (
                    "selecionar outra turma" in normalized_html
                    and not is_loading
                    and (
                        students
                        or enrolled_count == 0
                        or (
                            enrolled_count is not None
                            and enrolled_count > 0
                            and "aluno" in normalized_html
                            and "frequencia" in normalized_html
                        )
                    )
                ):
                    return html
            except Exception:
                pass
            time.sleep(1.0)
        raise RuntimeError(f"A tela da turma '{subject_name}' nao carregou a tempo.")

    def _open_docente_classes_page(self) -> None:
        self._trace("navegando para o menu Turmas > Turmas")
        clicked_menu = self._click_element_by_text(["Turmas"])
        if clicked_menu:
            time.sleep(1.0)
            if self._click_element_by_text(["Turmas"]):
                time.sleep(1.5)
                page_text = self.driver.find_element("tag name", "body").text or ""
                if "periodo letivo" in self._normalize_portal_label(page_text):
                    return
                self._trace("submenu Turmas nao levou direto ao catalogo; aplicando fallback por URL")
        self.driver.get(self.DOCENTE_CLASSES_URL)

    def _login_docente_portal(self, username: str, password: str) -> dict[str, Any]:
        try:
            self._trace(f"abrindo portal docente para autenticar o professor {username}")
            self.driver.get(self.DOCENTE_LOGIN_URL)
            time.sleep(2.0)

            username_input = None
            password_input = None
            for element in self._find_visible_inputs():
                input_type = (element.get_attribute("type") or "text").lower()
                if input_type == "password" and not password_input:
                    password_input = element
                elif input_type in {"text", "email", "search"} and not username_input:
                    username_input = element

            if not username_input or not password_input:
                raise RuntimeError("Nao foi possivel localizar os campos de login do portal docente.")

            username_input.clear()
            username_input.send_keys(username)
            password_input.clear()
            password_input.send_keys(password)

            login_button = None
            for button in self.driver.find_elements("css selector", "button, input[type='submit'], a"):
                try:
                    label = " ".join(
                        [
                            button.text or "",
                            button.get_attribute("value") or "",
                            button.get_attribute("title") or "",
                        ]
                    ).strip().lower()
                    if "entrar" in label:
                        login_button = button
                        break
                except Exception:
                    continue

            if not login_button:
                raise RuntimeError("Nao foi possivel localizar o botao Entrar do portal docente.")

            self._trace("submetendo login do portal docente")
            login_button.click()

            if not self._wait_for_text("USUARIO:", timeout_seconds=70):
                page_text = self.driver.find_element("tag name", "body").text or ""
                normalized_page_text = self._normalize_portal_label(page_text)
                raise RuntimeError(
                    "Falha ao autenticar no portal docente. Verifique o login e a senha informados."
                    if "por favor identifique-se" in normalized_page_text
                    else "Falha ao autenticar no portal docente."
                )

            raw_text = self.driver.find_element("tag name", "body").text or ""
            professor_name = self._extract_professor_name_from_text(raw_text) or username
            self._trace(f"login confirmado no portal docente; professor identificado como {professor_name}")
            self._create_authenticated_http_session()
            return {"success": True, "professor_name": professor_name}
        except Exception as exc:
            logger.error("Erro no login docente Lyceum: %s", exc)
            return {"success": False, "error": str(exc)}

    def _scrape_docente_classes_catalog(self) -> list[dict[str, Any]]:
        self._open_docente_classes_page()
        html = self._wait_for_catalog_html(timeout_seconds=240)
        if not html:
            raise RuntimeError("A listagem de turmas do professor nao carregou a tempo.")

        classes_payload = self._parse_docente_catalog_html(html)
        self._trace(f"catalogo de turmas carregado com {len(classes_payload)} turma(s)")
        return classes_payload

    def _scrape_docente_class_detail(self, class_payload: dict[str, Any]) -> dict[str, Any]:
        detail_url = class_payload.get("detail_url")
        opened_via_catalog_click = False
        subject_name = class_payload.get("subject_name") or "turma"
        html = ""

        if class_payload.get("catalog_click_target_id"):
            opened_via_catalog_click = self._open_docente_class_from_catalog(class_payload)
            if opened_via_catalog_click:
                html = self._wait_for_class_detail_html(subject_name, timeout_seconds=240)
        elif detail_url:
            self._trace(f"abrindo turma '{subject_name}'")
            html = self._fetch_html_with_fallback(
                detail_url,
                expected_markers=["Selecionar outra turma"],
                timeout_seconds=240,
            )
            if not html or "selecionar outra turma" not in self._normalize_portal_label(html):
                html = self._wait_for_class_detail_html(subject_name, timeout_seconds=240)
        else:
            return class_payload

        detail_data = self._parse_docente_class_detail_html(html)
        fields = detail_data.get("fields") or {}

        class_payload["academic_course_name"] = fields.get("curso") or class_payload.get("academic_course_name")
        class_payload["shift_label"] = fields.get("turno") or class_payload.get("shift_label")
        class_payload["room_label"] = fields.get("sala") or class_payload.get("room_label")
        class_payload["unit_name"] = fields.get("unidade_responsavel") or class_payload.get("unit_name")
        class_payload["physical_unit_name"] = fields.get("unidade_fisica") or class_payload.get("physical_unit_name")
        class_payload["workload_label"] = fields.get("carga_horaria") or class_payload.get("workload_label")
        class_payload["class_status"] = fields.get("situacao") or class_payload.get("class_status")
        class_payload["period_label"] = fields.get("periodo_letivo") or class_payload.get("period_label")
        class_payload["class_code"] = fields.get("turma") or class_payload.get("class_code")

        parsed_enrolled_count = self._parse_optional_int(fields.get("matriculados"))
        if parsed_enrolled_count is not None:
            class_payload["enrolled_count"] = parsed_enrolled_count

        students: list[dict[str, Any]] = []
        for row in detail_data.get("students") or []:
            students.append(
                {
                    "student_name": " ".join(str(row.get("aluno") or "").split()),
                    "student_code": str(row.get("codigo") or "").strip() or None,
                    "status_label": str(row.get("situacao") or "").strip() or None,
                    "academic_course_name": str(
                        row.get("curso") or class_payload.get("academic_course_name") or ""
                    ).strip() or None,
                    "va1": self._parse_optional_float(row.get("va1")),
                    "va2": self._parse_optional_float(row.get("va2")),
                    "va3": self._parse_optional_float(row.get("va3")),
                    "attendance_percentage": self._parse_optional_float(row.get("frequencia_percentual")),
                }
            )

        class_payload["students"] = [student for student in students if student.get("student_name")]
        self._trace(
            f"turma '{subject_name}' extraida com {len(class_payload['students'])} aluno(s)"
        )
        if opened_via_catalog_click:
            self._return_to_docente_catalog()
        return class_payload

    def scrape_professor_portal(self, username: str, password: str) -> dict[str, Any]:
        self._trace_steps = []
        result = {
            "success": False,
            "professor_name": None,
            "classes": [],
            "errors": [],
            "steps": self._trace_steps,
        }

        try:
            self._init_driver()
            login_result = self._login_docente_portal(username, password)
            if not login_result.get("success"):
                result["errors"].append(login_result.get("error") or "Falha de autenticacao no portal docente.")
                return result

            result["professor_name"] = login_result.get("professor_name") or username
            classes_payload = self._scrape_docente_classes_catalog()
            detailed_classes = []

            for class_payload in classes_payload:
                try:
                    detailed_classes.append(self._scrape_docente_class_detail(class_payload))
                except Exception as exc:
                    logger.error("Erro ao extrair turma %s: %s", class_payload.get("subject_name"), exc)
                    result["errors"].append(f"Turma '{class_payload.get('subject_name')}': {exc}")

            result["classes"] = detailed_classes
            result["success"] = True
            self._trace(
                f"scraping docente finalizado; {len(detailed_classes)} turma(s) consolidada(s)"
            )
            return result
        except Exception as exc:
            logger.error("Erro no scraper docente Lyceum: %s", exc, exc_info=True)
            result["errors"].append(str(exc))
            return result
        finally:
            self._close_driver()

    def _get_password_attempts(self, cpf: str, custom_password: Optional[str] = None) -> List[str]:
        cpf_digits = "".join(char for char in cpf if char.isdigit())
        attempts: list[str] = []

        if custom_password:
            attempts.append(custom_password)
        if settings.ALLOW_LYCEUM_CPF_PASSWORD_FALLBACK and len(cpf_digits) >= 9:
            attempts.extend(
                [
                    cpf_digits[:6],
                    cpf_digits[-6:],
                    cpf_digits,
                ]
            )

        unique_attempts = []
        for attempt in attempts:
            cleaned = str(attempt or "").strip()
            if cleaned and cleaned not in unique_attempts:
                unique_attempts.append(cleaned)
        return unique_attempts

    def save_grades(self, student_id: int, grades_data: List[Dict[str, Any]], db: Session):
        from app.models.scraped_data import ScrapedGrade

        db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).delete()
        for grade in grades_data:
            db.add(
                ScrapedGrade(
                    student_id=student_id,
                    disciplina=clean_subject_name(grade.get("disciplina", "")),
                    va1=grade.get("va1", 0.0),
                    va2=grade.get("va2", 0.0),
                    va3=grade.get("va3", 0.0),
                    media=grade.get("media", 0.0),
                    situacao=grade.get("situacao", "Cursando"),
                    avaliacoes=json.dumps(grade.get("avaliacoes", [])) if grade.get("avaliacoes") else None,
                )
            )
        db.commit()

    def save_attendance(self, student_id: int, attendance_data: List[Dict[str, Any]], db: Session):
        from app.models.scraped_data import ScrapedAttendance

        db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student_id).delete()
        normalized_attendance = normalize_attendance_records(attendance_data)
        for attendance, attendance_payload in zip(attendance_data, normalized_attendance):
            db.add(
                ScrapedAttendance(
                    student_id=student_id,
                    disciplina=clean_subject_name(attendance.get("disciplina", "")),
                    total_faltas=attendance_payload["total_faltas"],
                    total_aulas=attendance_payload["total_aulas"],
                    percentual_presenca=attendance_payload["percentual_presenca"] or 100.0,
                )
            )
        db.commit()

    def save_subjects(self, student_id: int, subjects_data: List[Dict[str, Any]], db: Session):
        from app.models.course import Course
        from app.models.scraped_data import ScrapedSubject
        from app.models.student import Student

        student = db.query(Student).filter(Student.id == student_id).first()
        department = student.course_name if student and student.course_name else "Geral"

        db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student_id).delete()
        catalog_courses = db.query(Course).all()
        course_by_key = {
            normalize_subject_key(course.name): course
            for course in catalog_courses
            if course.name and normalize_subject_key(course.name)
        }
        seen_subject_keys = set()

        for subject in subjects_data:
            name = clean_subject_name(subject.get("disciplina", ""))
            subject_key = normalize_subject_key(name)
            if not name or not subject_key or subject_key in seen_subject_keys:
                continue

            seen_subject_keys.add(subject_key)
            db.add(
                ScrapedSubject(
                    student_id=student_id,
                    disciplina=name,
                    situacao=subject.get("situacao", "Matriculado"),
                    periodo=subject.get("periodo"),
                    docente=subject.get("docente"),
                    data_inicial=subject.get("data_inicial"),
                )
            )

            existing_course = course_by_key.get(subject_key)
            if existing_course:
                if existing_course.name != name:
                    existing_course.name = name
                continue

            name_hash = hashlib.md5(name.encode()).hexdigest()[:6].upper()
            new_course = Course(
                name=name,
                code=f"SUBJ-{name_hash}",
                credits=4,
                semester="2026.1",
                department=department,
            )
            db.add(new_course)
            course_by_key[subject_key] = new_course

        db.commit()

    def save_schedule(self, student_id: int, schedule_data: List[Dict[str, Any]], db: Session):
        from app.models.scraped_data import ScrapedSchedule

        db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student_id).delete()
        for item in schedule_data:
            db.add(
                ScrapedSchedule(
                    student_id=student_id,
                    dia_semana=item.get("dia_semana", 0),
                    dia_nome=item.get("dia_nome"),
                    disciplina=clean_subject_name(item.get("disciplina", "")),
                    horario_inicio=item.get("horario_inicio"),
                    horario_fim=item.get("horario_fim"),
                    local=item.get("local"),
                    professor=item.get("professor"),
                )
            )
        db.commit()

    def _run_mock_scrape(self, student_id: int, db: Session) -> Dict[str, Any]:
        from app.models.course import Course
        from app.models.scraped_data import ScrapedAttendance, ScrapedGrade, ScrapedSchedule, ScrapedSubject
        from app.models.student import Student

        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return {
                "success": False,
                "grades_count": 0,
                "attendance_count": 0,
                "subjects_count": 0,
                "schedule_count": 0,
                "errors": ["Aluno nao encontrado no banco de dados"],
            }

        courses = db.query(Course).all()
        student_courses = []
        if student.course_name:
            student_courses = [
                course
                for course in courses
                if course.department == student.course_name
                or student.course_name.lower() in (course.department or "").lower()
            ]

        if not student_courses:
            student_courses = random.sample(courses, min(5, len(courses))) if courses else []

        if not student_courses:
            for name in ["Programacao I", "Banco de Dados", "Estrutura de Dados", "Calculo I", "Engenharia de Software"]:
                name_hash = hashlib.md5(name.encode()).hexdigest()[:6].upper()
                new_course = Course(
                    name=name,
                    code=f"SUBJ-{name_hash}",
                    credits=4,
                    semester="2026.1",
                    department=student.course_name or "Geral",
                )
                db.add(new_course)
                db.flush()
                student_courses.append(new_course)

        db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student_id).delete(synchronize_session=False)
        db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).delete(synchronize_session=False)
        db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student_id).delete(synchronize_session=False)
        db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student_id).delete(synchronize_session=False)
        db.flush()

        subjects_data = []
        grades_data = []
        attendance_data = []
        schedule_data = []
        profile = random.choice(["excelente", "bom", "medio", "em_risco"])

        for index, course in enumerate(student_courses[:6]):
            subjects_data.append(
                {
                    "disciplina": course.name,
                    "situacao": "Matriculado",
                    "periodo": f"{student.current_period or 1}o periodo",
                    "docente": f"Prof. Dr. {student.course_name or 'Institucional'}",
                    "data_inicial": "2026-02-10",
                }
            )

            if profile == "excelente":
                va1 = round(random.uniform(8.5, 10.0), 1)
                va2 = round(random.uniform(8.0, 9.8), 1)
                va3 = round(random.uniform(9.0, 10.0), 1)
            elif profile == "bom":
                va1 = round(random.uniform(7.0, 8.5), 1)
                va2 = round(random.uniform(6.5, 8.0), 1)
                va3 = round(random.uniform(7.5, 9.0), 1)
            elif profile == "medio":
                va1 = round(random.uniform(5.5, 7.5), 1)
                va2 = round(random.uniform(5.0, 7.0), 1)
                va3 = round(random.uniform(6.0, 8.0), 1)
            else:
                va1 = round(random.uniform(2.5, 5.5), 1)
                va2 = round(random.uniform(3.0, 5.0), 1)
                va3 = round(random.uniform(2.0, 6.0), 1)

            media = round((va1 + va2 + va3) / 3, 1)
            grades_data.append(
                {
                    "disciplina": course.name,
                    "va1": va1,
                    "va2": va2,
                    "va3": va3,
                    "media": media,
                    "situacao": "Aprovado" if media >= 6.0 else "Reprovado" if media < 4.0 else "Em recuperacao",
                }
            )

            if profile == "excelente":
                total_faltas = random.randint(0, 2)
            elif profile == "bom":
                total_faltas = random.randint(1, 4)
            elif profile == "medio":
                total_faltas = random.randint(2, 6)
            else:
                total_faltas = random.randint(8, 14)

            total_aulas = 32
            attendance_rate = round(((total_aulas - total_faltas) / total_aulas) * 100, 1)
            attendance_data.append(
                {
                    "disciplina": course.name,
                    "total_faltas": total_faltas,
                    "total_aulas": resolve_total_classes(total_aulas, total_faltas, attendance_rate),
                    "percentual_presenca": attendance_rate,
                }
            )

            dias = ["Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"]
            schedule_data.append(
                {
                    "dia_semana": (index % 5) + 1,
                    "dia_nome": dias[index % 5],
                    "disciplina": course.name,
                    "horario_inicio": "19:00",
                    "horario_fim": "22:15",
                    "local": f"Predio {random.randint(1, 3)}, Sala {random.randint(101, 308)}",
                    "professor": f"Prof. Dr. {student.course_name or 'Institucional'}",
                }
            )

        self.save_subjects(student_id, subjects_data, db)
        self.save_grades(student_id, grades_data, db)
        self.save_attendance(student_id, attendance_data, db)
        self.save_schedule(student_id, schedule_data, db)

        return {
            "success": True,
            "grades_count": len(grades_data),
            "attendance_count": len(attendance_data),
            "subjects_count": len(subjects_data),
            "schedule_count": len(schedule_data),
            "errors": [],
            "simulated": True,
        }

    def run_full_scrape(
        self,
        student_id: int,
        registration_number: str,
        cpf: str,
        custom_password: Optional[str],
        db: Session,
    ) -> Dict[str, Any]:
        logger.info(
            "Fluxo legado de scraping de aluno acionado para matricula=%s. "
            "Executando modo de compatibilidade controlado.",
            registration_number,
        )
        return self._run_mock_scrape(student_id, db)

    @staticmethod
    def _parse_float(text: str) -> float:
        if text is None:
            return 0.0
        cleaned = "".join(ch for ch in str(text).strip() if ch.isdigit() or ch in ",.-")
        cleaned = cleaned.replace(",", ".")
        if cleaned in {"", "-", ".", "-."}:
            return 0.0
        try:
            return float(cleaned)
        except (ValueError, AttributeError):
            return 0.0

    @staticmethod
    def _parse_int(text: str) -> int:
        try:
            return int(str(text).strip())
        except (ValueError, AttributeError):
            return 0

    @classmethod
    def _parse_optional_float(cls, text: Any) -> float | None:
        if text is None:
            return None
        raw = str(text).strip()
        if not raw:
            return None
        return cls._parse_float(raw)

    @classmethod
    def _parse_optional_int(cls, text: Any) -> int | None:
        if text is None:
            return None
        raw = str(text).strip()
        if not raw:
            return None
        return cls._parse_int(raw)


scraper_service = LyceumScraperService()
