"""
Servicos para persistencia e leitura dos dados em tempo real do portal docente.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from collections import defaultdict
from types import SimpleNamespace

from sqlalchemy.orm import Session

from app.models.coordinator import Coordinator
from app.models.live_data import ProfessorLiveClass, ProfessorLiveStudent
from app.models.user import User, UserRole
from app.services.cache_service import cache_service
from app.services.historical_analysis_service import HistoricalAnalysisService


class LiveDataService:
    SUMMARY_CACHE_NAMESPACE = "live-summary"
    CATALOG_CACHE_NAMESPACE = "live-catalog"
    COURSES_CACHE_NAMESPACE = "live-courses"
    PROFESSORS_CACHE_NAMESPACE = "live-professors"
    ANALYSIS_CACHE_NAMESPACE = "live-analysis-workspace"
    CACHE_TTL_SHORT = 120
    CACHE_TTL_MEDIUM = 300
    CACHE_TTL_LONG = 600

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _normalize_name(value: str | None) -> str | None:
        cleaned = " ".join(str(value or "").split()).strip()
        return cleaned or None

    @classmethod
    def _normalize_token(cls, value: str | None) -> str:
        return (cls._normalize_name(value) or "").casefold()

    @staticmethod
    def _average(values: list[float | None]) -> float | None:
        numeric_values = [float(value) for value in values if value is not None]
        if not numeric_values:
            return None
        return round(sum(numeric_values) / len(numeric_values), 2)

    @staticmethod
    def _clamp(value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))

    @staticmethod
    def _student_average_grade(student: ProfessorLiveStudent) -> float | None:
        grades = [value for value in (student.va1, student.va2, student.va3) if value is not None]
        if not grades:
            return None
        return round(sum(grades) / len(grades), 2)

    @classmethod
    def _classify_risk(cls, average_grade: float | None, attendance_rate: float | None) -> tuple[float, str]:
        grade_component = 0.0
        attendance_component = 0.0

        if average_grade is not None:
            grade_component = max(0.0, min(1.0, 1 - (average_grade / 100.0)))
        if attendance_rate is not None:
            attendance_component = max(0.0, min(1.0, 1 - (attendance_rate / 100.0)))

        if average_grade is None and attendance_rate is None:
            risk_score = 0.0
        elif average_grade is None:
            risk_score = attendance_component
        elif attendance_rate is None:
            risk_score = grade_component
        else:
            risk_score = (grade_component * 0.65) + (attendance_component * 0.35)

        if risk_score >= 0.75:
            return round(risk_score, 4), "critical"
        if risk_score >= 0.5:
            return round(risk_score, 4), "high"
        if risk_score >= 0.25:
            return round(risk_score, 4), "medium"
        return round(risk_score, 4), "low"

    @classmethod
    def _serialize_student(cls, student: ProfessorLiveStudent) -> dict[str, Any]:
        average_grade = cls._student_average_grade(student)
        risk_score, risk_level = cls._classify_risk(average_grade, student.attendance_percentage)
        return {
            "id": student.id,
            "student_name": student.student_name,
            "student_code": student.student_code,
            "status_label": student.status_label,
            "academic_course_name": student.academic_course_name,
            "va1": student.va1,
            "va2": student.va2,
            "va3": student.va3,
            "average_grade": average_grade,
            "attendance_percentage": student.attendance_percentage,
            "risk_score": risk_score,
            "risk_level": risk_level,
        }

    @classmethod
    def _serialize_class(cls, live_class: ProfessorLiveClass, include_students: bool = False) -> dict[str, Any]:
        serialized_students = [cls._serialize_student(student) for student in (live_class.students or [])]
        average_grades = [student["average_grade"] for student in serialized_students if student["average_grade"] is not None]
        attendance_rates = [
            student["attendance_percentage"]
            for student in serialized_students
            if student["attendance_percentage"] is not None
        ]
        at_risk_count = sum(
            1 for student in serialized_students if student["risk_level"] in {"high", "critical"}
        )
        payload = {
            "id": live_class.id,
            "professor_user_id": live_class.professor_user_id,
            "professor_name": live_class.professor_name,
            "external_class_code": live_class.external_class_code,
            "subject_name": live_class.subject_name,
            "class_code": live_class.class_code,
            "academic_course_name": live_class.academic_course_name,
            "period_label": live_class.period_label,
            "start_date_label": live_class.start_date_label,
            "end_date_label": live_class.end_date_label,
            "lessons_planned": live_class.lessons_planned,
            "lessons_given": live_class.lessons_given,
            "vacancies": live_class.vacancies,
            "pre_enrolled": live_class.pre_enrolled,
            "enrolled_count": live_class.enrolled_count,
            "cancelled_count": live_class.cancelled_count,
            "shift_label": live_class.shift_label,
            "room_label": live_class.room_label,
            "unit_name": live_class.unit_name,
            "physical_unit_name": live_class.physical_unit_name,
            "workload_label": live_class.workload_label,
            "class_status": live_class.class_status,
            "detail_url": live_class.detail_url,
            "synced_at": live_class.synced_at,
            "students_count": len(serialized_students),
            "average_grade": round(sum(average_grades) / len(average_grades), 2) if average_grades else None,
            "average_attendance_rate": round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else None,
            "at_risk_count": at_risk_count,
        }
        if include_students:
            payload["students"] = serialized_students
        return payload

    def _matches_live_class_search(self, live_class: ProfessorLiveClass, search: str) -> bool:
        haystack = " ".join(
            str(value or "")
            for value in (
                live_class.subject_name,
                live_class.class_code,
                live_class.professor_name,
                live_class.academic_course_name,
                live_class.period_label,
            )
        ).casefold()
        if search in haystack:
            return True

        for student in live_class.students or []:
            student_haystack = " ".join(
                str(value or "")
                for value in (
                    student.student_name,
                    student.student_code,
                    student.status_label,
                    student.academic_course_name,
                )
            ).casefold()
            if search in student_haystack:
                return True

        return False

    def _find_student_in_class(
        self,
        live_class: ProfessorLiveClass,
        *,
        student_code: str | None = None,
        student_name: str | None = None,
    ) -> ProfessorLiveStudent | None:
        normalized_code = self._normalize_name(student_code)
        normalized_name = self._normalize_token(student_name)

        for student in live_class.students or []:
            if normalized_code and self._normalize_name(student.student_code) == normalized_code:
                return student
            if normalized_name and self._normalize_token(student.student_name) == normalized_name:
                return student

        if normalized_name:
            for student in live_class.students or []:
                if normalized_name in self._normalize_token(student.student_name):
                    return student

        return None

    @classmethod
    def invalidate_cache(cls) -> None:
        cache_service.clear_namespaces(
            cls.SUMMARY_CACHE_NAMESPACE,
            cls.CATALOG_CACHE_NAMESPACE,
            cls.COURSES_CACHE_NAMESPACE,
            cls.PROFESSORS_CACHE_NAMESPACE,
            cls.ANALYSIS_CACHE_NAMESPACE,
        )

    @classmethod
    def _build_scope_cache_key(cls, current_user: User | None, **parts: Any) -> str:
        payload = {
            "user_id": getattr(current_user, "id", None),
            "role": getattr(getattr(current_user, "role", None), "value", getattr(current_user, "role", None)),
            **parts,
        }
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)

    def replace_professor_snapshot(
        self,
        professor_user_id: int,
        professor_name: str,
        classes_payload: list[dict[str, Any]],
    ) -> dict[str, Any]:
        existing_classes = (
            self.db.query(ProfessorLiveClass)
            .filter(ProfessorLiveClass.professor_user_id == professor_user_id)
            .all()
        )
        for live_class in existing_classes:
            self.db.delete(live_class)
        self.db.flush()

        synced_at = datetime.utcnow()
        created_classes = 0
        created_students = 0

        for class_payload in classes_payload:
            live_class = ProfessorLiveClass(
                professor_user_id=professor_user_id,
                professor_name=professor_name,
                external_class_code=class_payload.get("external_class_code"),
                subject_name=class_payload.get("subject_name") or "Disciplina sem nome",
                class_code=class_payload.get("class_code"),
                academic_course_name=class_payload.get("academic_course_name"),
                period_label=class_payload.get("period_label"),
                start_date_label=class_payload.get("start_date_label"),
                end_date_label=class_payload.get("end_date_label"),
                lessons_planned=class_payload.get("lessons_planned"),
                lessons_given=class_payload.get("lessons_given"),
                vacancies=class_payload.get("vacancies"),
                pre_enrolled=class_payload.get("pre_enrolled"),
                enrolled_count=class_payload.get("enrolled_count"),
                cancelled_count=class_payload.get("cancelled_count"),
                shift_label=class_payload.get("shift_label"),
                room_label=class_payload.get("room_label"),
                unit_name=class_payload.get("unit_name"),
                physical_unit_name=class_payload.get("physical_unit_name"),
                workload_label=class_payload.get("workload_label"),
                class_status=class_payload.get("class_status"),
                detail_url=class_payload.get("detail_url"),
                synced_at=synced_at,
            )
            self.db.add(live_class)
            self.db.flush()
            created_classes += 1

            for student_payload in class_payload.get("students", []):
                self.db.add(
                    ProfessorLiveStudent(
                        live_class_id=live_class.id,
                        professor_user_id=professor_user_id,
                        student_name=student_payload.get("student_name") or "Aluno sem nome",
                        student_code=student_payload.get("student_code"),
                        status_label=student_payload.get("status_label"),
                        academic_course_name=student_payload.get("academic_course_name") or live_class.academic_course_name,
                        va1=student_payload.get("va1"),
                        va2=student_payload.get("va2"),
                        va3=student_payload.get("va3"),
                        attendance_percentage=student_payload.get("attendance_percentage"),
                    )
                )
                created_students += 1

        self.db.flush()
        self.invalidate_cache()
        return {
            "classes_count": created_classes,
            "students_count": created_students,
            "synced_at": synced_at,
        }

    def get_scoped_query(self, current_user: User):
        query = self.db.query(ProfessorLiveClass)

        if current_user.role == UserRole.PROFESSOR:
            return query.filter(ProfessorLiveClass.professor_user_id == current_user.id)

        if current_user.role == UserRole.COORDINATOR:
            coordinator = self.db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if not coordinator:
                return query.filter(ProfessorLiveClass.id == -1)
            course_names = coordinator.course_names or []
            if not course_names and coordinator.academic_course_name:
                course_names = [coordinator.academic_course_name]
            cleaned_courses = [str(name).strip() for name in course_names if str(name).strip()]
            if not cleaned_courses:
                return query.filter(ProfessorLiveClass.id == -1)
            return query.filter(ProfessorLiveClass.academic_course_name.in_(cleaned_courses))

        if current_user.role == UserRole.ADMIN:
            return query

        return query.filter(ProfessorLiveClass.id == -1)

    def get_scoped_classes(
        self,
        current_user: User,
        *,
        course_name: str | None = None,
        professor_user_id: int | None = None,
        search: str | None = None,
    ) -> list[ProfessorLiveClass]:
        query = self.get_scoped_query(current_user)

        normalized_course = self._normalize_name(course_name)
        if normalized_course:
            query = query.filter(ProfessorLiveClass.academic_course_name == normalized_course)

        if current_user.role == UserRole.ADMIN and professor_user_id:
            query = query.filter(ProfessorLiveClass.professor_user_id == professor_user_id)

        classes = query.order_by(
            ProfessorLiveClass.period_label.asc(),
            ProfessorLiveClass.subject_name.asc(),
            ProfessorLiveClass.class_code.asc(),
        ).all()

        normalized_search = self._normalize_token(search)
        if normalized_search:
            classes = [
                live_class
                for live_class in classes
                if self._matches_live_class_search(live_class, normalized_search)
            ]

        return classes

    def get_class_by_id(self, class_id: int, current_user: User) -> ProfessorLiveClass | None:
        for live_class in self.get_scoped_classes(current_user):
            if live_class.id == class_id:
                return live_class
        return None

    def list_available_academic_courses(self, current_user: User | None = None) -> list[str]:
        cache_key = self._build_scope_cache_key(current_user, resource="courses")
        cached = cache_service.get_json(self.COURSES_CACHE_NAMESPACE, cache_key)
        if cached is not None:
            return [str(item) for item in cached]

        query = self.db.query(ProfessorLiveClass.academic_course_name).filter(
            ProfessorLiveClass.academic_course_name.isnot(None)
        )
        if current_user is not None:
            scoped_ids = [live_class.id for live_class in self.get_scoped_classes(current_user)]
            if not scoped_ids:
                return []
            query = query.filter(ProfessorLiveClass.id.in_(scoped_ids))

        rows = query.distinct().all()
        payload = sorted({str(value).strip() for (value,) in rows if str(value or "").strip()})
        cache_service.set_json(self.COURSES_CACHE_NAMESPACE, cache_key, payload, ttl_seconds=self.CACHE_TTL_MEDIUM)
        return payload

    def list_available_professors(self, current_user: User | None = None) -> list[dict[str, Any]]:
        cache_key = self._build_scope_cache_key(current_user, resource="professors")
        cached = cache_service.get_json(self.PROFESSORS_CACHE_NAMESPACE, cache_key)
        if cached is not None:
            return cached

        classes = self.get_scoped_classes(current_user) if current_user is not None else self.db.query(ProfessorLiveClass).all()
        by_professor: dict[int, str] = {}
        for live_class in classes:
            if live_class.professor_user_id not in by_professor:
                by_professor[live_class.professor_user_id] = live_class.professor_name
        payload = [
            {"user_id": professor_user_id, "name": professor_name}
            for professor_user_id, professor_name in sorted(by_professor.items(), key=lambda item: item[1].lower())
        ]
        cache_service.set_json(self.PROFESSORS_CACHE_NAMESPACE, cache_key, payload, ttl_seconds=self.CACHE_TTL_MEDIUM)
        return payload

    def summarize_scope(
        self,
        current_user: User,
        *,
        course_name: str | None = None,
        professor_user_id: int | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        cache_key = self._build_scope_cache_key(
            current_user,
            resource="summary",
            course_name=course_name,
            professor_user_id=professor_user_id,
            search=search,
        )
        cached = cache_service.get_json(self.SUMMARY_CACHE_NAMESPACE, cache_key)
        if cached is not None:
            return cached

        classes = self.get_scoped_classes(
            current_user,
            course_name=course_name,
            professor_user_id=professor_user_id,
            search=search,
        )
        serialized_classes = [self._serialize_class(live_class, include_students=True) for live_class in classes]

        all_students: list[dict[str, Any]] = []
        for live_class in serialized_classes:
            for student in live_class.get("students", []):
                student_entry = dict(student)
                student_entry["class_id"] = live_class["id"]
                student_entry["class_code"] = live_class["class_code"]
                student_entry["subject_name"] = live_class["subject_name"]
                student_entry["professor_name"] = live_class["professor_name"]
                student_entry["professor_user_id"] = live_class["professor_user_id"]
                all_students.append(student_entry)

        total_students = len(all_students)
        risk_summary = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for student in all_students:
            risk_summary[student["risk_level"]] += 1

        grade_values = [student["average_grade"] for student in all_students if student["average_grade"] is not None]
        attendance_values = [
            student["attendance_percentage"]
            for student in all_students
            if student["attendance_percentage"] is not None
        ]
        at_risk_count = risk_summary["high"] + risk_summary["critical"]
        approved_count = sum(
            1
            for student in all_students
            if (student["average_grade"] is not None and student["average_grade"] >= 60)
            and (student["attendance_percentage"] is None or student["attendance_percentage"] >= 75)
        )
        last_synced_at = max((live_class["synced_at"] for live_class in serialized_classes), default=None)

        top_at_risk = sorted(
            all_students,
            key=lambda item: (item["risk_score"], item["average_grade"] is None, -(item["average_grade"] or 0)),
            reverse=True,
        )[:10]

        payload = {
            "kpis": {
                "total_classes": len(serialized_classes),
                "total_students": total_students,
                "total_professors": len({item["professor_user_id"] for item in serialized_classes}),
                "average_grade": round(sum(grade_values) / len(grade_values), 2) if grade_values else 0.0,
                "average_attendance_rate": round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else 0.0,
                "at_risk_count": at_risk_count,
                "pass_rate": round((approved_count / total_students) * 100, 2) if total_students else 0.0,
                "last_synced_at": last_synced_at,
            },
            "risk_summary": risk_summary,
            "top_at_risk": top_at_risk,
            "classes": serialized_classes,
            "filters": {
                "courses": self.list_available_academic_courses(current_user),
                "professors": self.list_available_professors(current_user),
            },
        }
        cache_service.set_json(self.SUMMARY_CACHE_NAMESPACE, cache_key, payload, ttl_seconds=self.CACHE_TTL_SHORT)
        return payload

    def build_course_catalog(self, current_user: User) -> list[dict[str, Any]]:
        cache_key = self._build_scope_cache_key(current_user, resource="catalog")
        cached = cache_service.get_json(self.CATALOG_CACHE_NAMESPACE, cache_key)
        if cached is not None:
            return cached

        grouped: dict[str, list[ProfessorLiveClass]] = defaultdict(list)
        for live_class in self.get_scoped_classes(current_user):
            grouped[live_class.academic_course_name or "Curso nao informado"].append(live_class)

        payload = []
        for course_name in sorted(grouped.keys(), key=lambda item: item.lower()):
            classes = grouped[course_name]
            payload.append({
                "academic_course_name": course_name,
                "classes_count": len(classes),
                "students_count": sum(len(live_class.students or []) for live_class in classes),
                "classes": [self._serialize_class(live_class, include_students=False) for live_class in classes],
            })
        cache_service.set_json(self.CATALOG_CACHE_NAMESPACE, cache_key, payload, ttl_seconds=self.CACHE_TTL_MEDIUM)
        return payload

    def build_analysis_workspace(
        self,
        current_user: User,
        *,
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
        professor_user_id: int | None = None,
        class_ids: str | None = None,
    ) -> dict[str, Any]:
        return self.get_analysis_workspace_bundle(
            current_user,
            semester=semester,
            course_name=course_name,
            subject=subject,
            professor_user_id=professor_user_id,
            class_ids=class_ids,
        )["workspace"]

    def get_analysis_workspace_bundle(
        self,
        current_user: User,
        *,
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
        professor_user_id: int | None = None,
        class_ids: str | None = None,
    ) -> dict[str, Any]:
        cache_key = self._build_scope_cache_key(
            current_user,
            resource="analysis-workspace",
            semester=semester,
            course_name=course_name,
            subject=subject,
            professor_user_id=professor_user_id,
            class_ids=class_ids,
        )
        cached = cache_service.get_json(self.ANALYSIS_CACHE_NAMESPACE, cache_key)
        if cached is not None:
            return cached

        analysis_service = HistoricalAnalysisService(self.db)
        raw_records, scope = self._build_live_analysis_records(
            current_user,
            semester=semester,
            course_name=course_name,
            subject=subject,
            professor_user_id=professor_user_id,
            class_ids=class_ids,
        )
        filters = analysis_service._build_filters(raw_records)
        available_analyses = analysis_service._build_available_analyses(current_user.role)

        empty_analysis = {
            "by_class": [],
            "between_classes": [],
            "by_semester": [],
            "high_risk_classes": [],
            "intervention_window": [],
            "discipline_bottlenecks": [],
            "discipline_risk": [],
            "intervention_priorities": [],
            "student_trends": [],
            "risk_factors": [],
            "early_alerts": [],
            "student_segments": [],
            "risk_projection": [],
            "heatmap": {
                "metrics": [],
                "classes": [],
                "cells": [],
            },
            "intervention_simulator": {
                "baseline": {},
                "scenarios": [],
            },
            "model_diagnostics": analysis_service.statistical_risk_service._fallback_context("Sem dados para modelagem."),
        }

        if not raw_records:
            workspace = {
                "scope": scope,
                "filters": filters,
                "available_analyses": available_analyses,
                "overview": {
                    "total_records": 0,
                    "total_students": 0,
                    "working_students": 0,
                    "total_classes": 0,
                    "total_semesters": 0,
                    "avg_grade": 0.0,
                    "avg_attendance": 0.0,
                    "avg_activity": 0.0,
                    "avg_risk": 0.0,
                    "critical_classes": 0,
                    "course_distribution": {},
                    "top_at_risk": [],
                    "is_projected": False,
                    "preventive_risk_count": 0,
                    "model_diagnostics": analysis_service.statistical_risk_service._fallback_context("Sem dados para modelagem."),
                },
                "analysis_data": empty_analysis,
            }
            payload = {
                "workspace": workspace,
                "prepared_records": [],
            }
            cache_service.set_json(self.ANALYSIS_CACHE_NAMESPACE, cache_key, payload, ttl_seconds=self.CACHE_TTL_SHORT)
            return payload

        prepared_records = analysis_service._prepare_records(raw_records)
        raw_records_by_id = {record.id: record for record in raw_records}
        for prepared in prepared_records:
            source = raw_records_by_id.get(prepared.get("id"))
            if not source:
                continue

            subject_label = source.subject or "Turma sem disciplina"
            class_code = self._normalize_name(getattr(source, "class_code", None))
            class_suffix = f" - {class_code}" if class_code else ""
            live_class_id = getattr(source, "live_class_id", None)

            prepared["registration_number"] = getattr(source, "registration_number", None)
            prepared["subject"] = subject_label
            prepared["course_name"] = source.course_name or "Curso nao informado"
            prepared["semester"] = source.semester or "Periodo atual"
            prepared["class_label"] = f"{subject_label}{class_suffix}"
            prepared["class_key"] = f"live-class::{live_class_id}" if live_class_id is not None else f"live-class::{prepared['class_label']}::{prepared['semester']}"
            prepared["live_class_id"] = live_class_id
            prepared["professor_name"] = getattr(source, "professor_name", None)
            prepared["is_completed"] = True
            prepared["data_source"] = "live"

        historical_records, _ = analysis_service.get_scoped_records(
            current_user=current_user,
            semester=None,
            course_name=course_name,
            subject=subject,
            spreadsheet_id=None,
        )
        historical_prepared = analysis_service._prepare_records(historical_records)
        for prepared in historical_prepared:
            prepared["data_source"] = "historical"

        combined_records = prepared_records + historical_prepared
        combined_records = analysis_service._enrich_prepared_records(combined_records)
        combined_records, model_diagnostics = analysis_service.statistical_risk_service.analyze(combined_records)
        prepared_records = [record for record in combined_records if record.get("data_source") == "live"]
        class_groups = analysis_service._group_by_class(prepared_records)
        semester_groups = analysis_service._group_by_semester(prepared_records)
        subject_groups = analysis_service._group_by_subject(prepared_records)
        overview = analysis_service._build_overview(prepared_records, class_groups, model_diagnostics)
        overview["historical_training_records"] = len(historical_prepared)
        overview["training_strategy"] = (
            "As previsoes em tempo real consideram os padroes atuais do Lyceum combinados "
            "com a base historica de planilhas disponivel para reforcar reconhecimento de risco e comportamento."
        )

        workspace = {
            "scope": scope,
            "filters": filters,
            "available_analyses": available_analyses,
            "overview": overview,
            "analysis_data": {
                "by_class": class_groups,
                "between_classes": analysis_service._build_between_classes(class_groups, overview),
                "by_semester": semester_groups,
                "high_risk_classes": analysis_service._build_high_risk_classes(class_groups),
                "intervention_window": analysis_service._build_intervention_window(prepared_records),
                "discipline_bottlenecks": analysis_service._build_bottlenecks(subject_groups, current_user.role),
                "discipline_risk": analysis_service._build_discipline_risk(prepared_records),
                "intervention_priorities": analysis_service._build_interventions(class_groups, current_user.role),
                "student_trends": analysis_service._build_student_trends(prepared_records),
                "risk_factors": analysis_service._build_risk_factors(prepared_records, model_diagnostics),
                "early_alerts": analysis_service._build_early_alerts(prepared_records),
                "student_segments": analysis_service._build_student_segments(prepared_records),
                "risk_projection": analysis_service._build_risk_projection(prepared_records),
                "heatmap": analysis_service._build_heatmap(class_groups),
                "intervention_simulator": analysis_service._build_intervention_simulator(prepared_records, overview),
                "model_diagnostics": model_diagnostics,
            },
        }
        payload = {
            "workspace": workspace,
            "prepared_records": prepared_records,
        }
        cache_service.set_json(self.ANALYSIS_CACHE_NAMESPACE, cache_key, payload, ttl_seconds=self.CACHE_TTL_SHORT)
        return payload

    def build_student_analysis(
        self,
        current_user: User,
        *,
        class_id: int,
        student_code: str | None = None,
        student_name: str | None = None,
    ) -> dict[str, Any] | None:
        live_class = self.get_class_by_id(class_id, current_user)
        if not live_class:
            return None

        target_student = self._find_student_in_class(
            live_class,
            student_code=student_code,
            student_name=student_name,
        )
        if not target_student:
            return None

        analysis_service = HistoricalAnalysisService(self.db)
        bundle = self.get_analysis_workspace_bundle(
            current_user=current_user,
            semester=live_class.period_label,
            course_name=live_class.academic_course_name,
            subject=live_class.subject_name,
            professor_user_id=live_class.professor_user_id if current_user.role == UserRole.ADMIN else None,
        )
        live_rows = bundle["prepared_records"]
        class_rows = [row for row in live_rows if row.get("live_class_id") == live_class.id]

        normalized_name = self._normalize_token(target_student.student_name)
        normalized_code = self._normalize_name(target_student.student_code)
        student_rows = [
            row
            for row in class_rows
            if (
                normalized_code and self._normalize_name(row.get("registration_number")) == normalized_code
            ) or self._normalize_token(row.get("student_name")) == normalized_name
        ]
        target_row = student_rows[0] if student_rows else None

        historical_records, _ = analysis_service.get_scoped_records(
            current_user=current_user,
            course_name=live_class.academic_course_name,
            subject=live_class.subject_name,
            spreadsheet_id=None,
        )
        historical_prepared = analysis_service._prepare_records(historical_records)
        historical_prepared = analysis_service._enrich_prepared_records(historical_prepared)
        historical_prepared, _ = analysis_service.statistical_risk_service.analyze(historical_prepared)
        historical_student_rows = [
            row
            for row in historical_prepared
            if self._normalize_token(row.get("student_name")) == normalized_name
        ]

        combined_student_rows = historical_student_rows + student_rows
        trend_payload = None
        if combined_student_rows:
            trend_rows = analysis_service._build_student_trends(combined_student_rows)
            trend_payload = trend_rows[0] if trend_rows else None

        projection_rows = analysis_service._build_risk_projection(student_rows or combined_student_rows)
        projection_payload = projection_rows[0] if projection_rows else None

        intervention_rows = analysis_service._build_intervention_window(student_rows or combined_student_rows)
        intervention_payload = intervention_rows[0] if intervention_rows else None

        raw_grades = [target_student.va1, target_student.va2, target_student.va3]
        current_average = self._student_average_grade(target_student)
        current_attendance = round(float(target_student.attendance_percentage or 0.0), 2)

        class_average_grade = self._average([self._student_average_grade(student) for student in live_class.students or []])
        class_average_attendance = self._average([
            student.attendance_percentage for student in (live_class.students or [])
        ])
        historical_student_average = self._average([
            float(row.get("grade_average") or 0.0) * 10 for row in historical_student_rows
        ])
        historical_student_attendance = self._average([
            float(row.get("attendance") or 0.0) for row in historical_student_rows
        ])
        historical_peer_average = self._average([
            float(row.get("grade_average") or 0.0) * 10 for row in historical_prepared
        ])

        known_grades = [float(value) for value in raw_grades if value is not None]
        base_candidates = [
            current_average,
            class_average_grade,
            historical_student_average,
            historical_peer_average,
        ]
        weighted_components = [
            value * weight
            for value, weight in (
                (current_average, 0.42),
                (class_average_grade, 0.2),
                (historical_student_average, 0.23),
                (historical_peer_average, 0.15),
            )
            if value is not None
        ]
        baseline_grade = (
            round(sum(weighted_components) / max(0.01, sum(
                weight
                for value, weight in (
                    (current_average, 0.42),
                    (class_average_grade, 0.2),
                    (historical_student_average, 0.23),
                    (historical_peer_average, 0.15),
                )
                if value is not None
            )), 2)
            if weighted_components else self._average(base_candidates) or 60.0
        )

        current_risk_score = float((target_row or {}).get("risk_score") or 0.0)
        attendance_factor = 0.92 + (self._clamp(current_attendance, 0.0, 100.0) / 100.0) * 0.16
        risk_penalty = 1 - min(0.18, current_risk_score * 0.16)
        projected_next_grade = round(self._clamp(baseline_grade * attendance_factor * risk_penalty, 0.0, 100.0), 1)

        projected_grades = [float(value) if value is not None else projected_next_grade for value in raw_grades]
        projected_average = round(sum(projected_grades) / len(projected_grades), 2) if projected_grades else projected_next_grade

        attendance_benchmark = self._average([historical_student_attendance, class_average_attendance, current_attendance]) or current_attendance
        projected_attendance = round(
            self._clamp((current_attendance * 0.72) + (attendance_benchmark * 0.28), 0.0, 100.0),
            1,
        )

        breakdown = dict((target_row or {}).get("risk_breakdown") or {})
        breakdown_total = sum(float(value or 0.0) for value in breakdown.values())
        factor_labels = {
            "nota": "Notas",
            "primeira_avaliacao": "Primeira avaliacao",
            "presenca": "Presenca",
            "queda_presenca": "Queda de presenca",
            "atividade": "Atividade",
            "oscilacao": "Oscilacao",
            "aprovacao": "Aprovacao",
            "historico": "Historico",
            "carga": "Carga",
            "dificuldade_disciplina": "Dificuldade da disciplina",
            "trabalho": "Trabalho",
        }
        risk_factors = [
            {
                "key": key,
                "label": factor_labels.get(key, key),
                "value": round(float(value or 0.0), 4),
                "percent": round((float(value or 0.0) / breakdown_total) * 100, 1) if breakdown_total else 0.0,
            }
            for key, value in sorted(breakdown.items(), key=lambda item: item[1], reverse=True)
            if float(value or 0.0) > 0
        ]

        class_students_ranked = sorted(
            class_rows,
            key=lambda row: float(row.get("risk_score") or 0.0),
            reverse=True,
        )
        class_rank = None
        if target_row and class_students_ranked:
            for index, row in enumerate(class_students_ranked, start=1):
                same_code = normalized_code and self._normalize_name(row.get("registration_number")) == normalized_code
                same_name = self._normalize_token(row.get("student_name")) == normalized_name
                if same_code or same_name:
                    class_rank = index
                    break

        trend_points = []
        for point in (trend_payload or {}).get("trend") or []:
            trend_points.append({
                "label": point.get("semester"),
                "risk": round(float(point.get("avg_risk") or 0.0) * 100, 1),
                "grade": round(float(point.get("avg_grade") or 0.0), 2),
                "attendance": round(float(point.get("avg_attendance") or 0.0), 1),
            })
        if not trend_points:
            trend_points = [
                {
                    "label": live_class.period_label or "Periodo atual",
                    "risk": round(current_risk_score * 100, 1),
                    "grade": round(float((target_row or {}).get("grade_average") or 0.0), 2),
                    "attendance": current_attendance,
                }
            ]

        recommendations = []
        if projection_payload and projection_payload.get("recommended_action"):
            recommendations.append(projection_payload["recommended_action"])
        if intervention_payload and intervention_payload.get("recommendation"):
            recommendations.append(intervention_payload["recommendation"])

        driver_recommendations = {
            "presenca": "Atuar em presenca e busca ativa pode reduzir o risco com mais velocidade.",
            "nota": "Vale priorizar recuperacao em nota e reforco nas proximas avaliacoes.",
            "atividade": "Reforcar entregas e engajamento nas atividades tende a melhorar a previsao.",
            "historico": "O historico pede acompanhamento mais frequente e plano individualizado.",
        }
        for factor in risk_factors[:3]:
            recommendation = driver_recommendations.get(factor["key"])
            if recommendation and recommendation not in recommendations:
                recommendations.append(recommendation)

        if not recommendations:
            recommendations.append("Manter acompanhamento leve e feedback continuo para preservar o ritmo atual.")

        known_count = len(known_grades)
        summary = (
            f"Analise individual baseada na turma atual do Lyceum, no risco estatistico do recorte e em {len(historical_prepared)} registros historicos de planilhas."
            if known_count <= 1 else
            f"O aluno possui media atual de {current_average:.1f} e frequencia de {current_attendance:.1f}%. "
            f"A leitura combina o desempenho atual com padroes historicos para estimar fechamento em {projected_average:.1f}."
        )

        risk_level = (target_row or {}).get("risk_level") or self._classify_risk(current_average, current_attendance)[1]
        risk_labels = {
            "low": "Baixo",
            "medium": "Medio",
            "high": "Alto",
            "critical": "Critico",
        }

        return {
            "student": {
                "name": target_student.student_name,
                "code": target_student.student_code,
                "status": target_student.status_label,
                "course_name": target_student.academic_course_name or live_class.academic_course_name or "Curso nao informado",
            },
            "classroom": {
                "id": live_class.id,
                "subject_name": live_class.subject_name,
                "class_code": live_class.class_code,
                "period_label": live_class.period_label,
                "students_count": len(live_class.students or []),
                "professor_name": live_class.professor_name,
            },
            "summary": {
                "text": summary,
                "risk_score": round(current_risk_score, 4),
                "risk_score_percent": round(current_risk_score * 100, 1),
                "risk_level": risk_level,
                "risk_level_label": risk_labels.get(risk_level, "Monitorar"),
                "class_rank": class_rank,
                "historical_matches": len(historical_student_rows),
                "historical_training_records": len(historical_prepared),
            },
            "metrics": {
                "current_average": current_average,
                "current_attendance": current_attendance,
                "class_average_grade": class_average_grade,
                "class_average_attendance": class_average_attendance,
                "grade_average_10": round(float((target_row or {}).get("grade_average") or 0.0), 2),
                "attendance_analytics": round(float((target_row or {}).get("attendance") or current_attendance), 2),
            },
            "projection": {
                "projected_next_grade": projected_next_grade,
                "projected_average": projected_average,
                "projected_attendance": projected_attendance,
                "recommended_action": projection_payload.get("recommended_action") if projection_payload else None,
                "mitigated_risk_percent": round(float(projection_payload.get("mitigated_risk") or current_risk_score) * 100, 1) if projection_payload else round(current_risk_score * 100, 1),
            },
            "benchmarks": {
                "historical_student_average": historical_student_average,
                "historical_student_attendance": historical_student_attendance,
                "historical_peer_average": historical_peer_average,
                "discipline_difficulty": round(float((target_row or {}).get("discipline_difficulty") or 0.0) * 100, 1),
            },
            "risk_factors": risk_factors,
            "recommendations": recommendations[:4],
            "grade_chart": [
                {"label": "VA1", "actual": target_student.va1, "projected": target_student.va1 if target_student.va1 is not None else projected_next_grade},
                {"label": "VA2", "actual": target_student.va2, "projected": target_student.va2 if target_student.va2 is not None else projected_next_grade},
                {"label": "VA3", "actual": target_student.va3, "projected": target_student.va3 if target_student.va3 is not None else projected_next_grade},
            ],
            "attendance_chart": [
                {"label": "Atual", "value": current_attendance},
                {"label": "Projetada", "value": projected_attendance},
                {"label": "Turma", "value": class_average_attendance or current_attendance},
            ],
            "trend_chart": trend_points,
        }

    def _build_live_analysis_records(
        self,
        current_user: User,
        *,
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
        professor_user_id: int | None = None,
        class_ids: str | None = None,
    ) -> tuple[list[SimpleNamespace], dict[str, Any]]:
        classes = self.get_scoped_classes(
            current_user,
            course_name=course_name,
            professor_user_id=professor_user_id,
        )
        allowed_class_ids = {
            int(value)
            for value in str(class_ids or "").split(",")
            if str(value).strip().isdigit()
        }
        if allowed_class_ids:
            classes = [live_class for live_class in classes if live_class.id in allowed_class_ids]

        normalized_semester = self._normalize_name(semester)
        normalized_subject = self._normalize_name(subject)
        if normalized_semester:
            classes = [
                live_class for live_class in classes
                if self._normalize_name(live_class.period_label) == normalized_semester
            ]
        if normalized_subject:
            classes = [
                live_class for live_class in classes
                if normalized_subject in (self._normalize_name(live_class.subject_name) or "")
            ]

        scope = {
            "role": current_user.role.value.lower(),
            "label": "Modo em tempo real",
            "description": "Análises construídas a partir dos dados atuais do Lyceum com reforço de padrões históricos das planilhas.",
            "can_upload": False,
            "access_level": "live_data",
            "course_name": self.list_available_academic_courses(current_user),
        }

        if current_user.role == UserRole.PROFESSOR:
            scope.update({
                "label": "Análises do professor",
                "description": "Comparativos e riscos das turmas extraídas do portal docente em tempo real.",
                "access_level": "classroom",
            })
        elif current_user.role == UserRole.COORDINATOR:
            scope.update({
                "label": "Análises da coordenação",
                "description": "Visão ampliada dos cursos coordenados com base nos dados atuais do Lyceum.",
                "access_level": "expanded",
            })
        elif current_user.role == UserRole.ADMIN:
            scope.update({
                "label": "Análises institucionais em tempo real",
                "description": "Leitura ampliada de todos os dados docentes sincronizados com o Lyceum.",
                "access_level": "institutional",
            })

        records: list[SimpleNamespace] = []
        record_id = 1_000_000
        for live_class in classes:
            for student in live_class.students or []:
                grades = {}
                if student.va1 is not None:
                    grades["VA1"] = student.va1
                if student.va2 is not None:
                    grades["VA2"] = student.va2
                if student.va3 is not None:
                    grades["VA3"] = student.va3
                if student.status_label:
                    grades["Situacao"] = student.status_label
                if student.attendance_percentage is not None:
                    grades["Frequencia Real"] = student.attendance_percentage

                subject_name = live_class.subject_name or "Turma sem disciplina"
                class_code = live_class.class_code or "Sem codigo"
                course_label = student.academic_course_name or live_class.academic_course_name or "Curso nao informado"

                records.append(SimpleNamespace(
                    id=record_id,
                    spreadsheet_id=None,
                    semester=live_class.period_label or "Periodo atual",
                    course_name=course_label,
                    subject=subject_name,
                    period=None,
                    student_name=student.student_name,
                    grades=grades,
                    attendance=student.attendance_percentage,
                    class_code=class_code,
                    live_class_id=live_class.id,
                    registration_number=student.student_code,
                    professor_name=live_class.professor_name,
                ))
                record_id += 1

        return records, scope
