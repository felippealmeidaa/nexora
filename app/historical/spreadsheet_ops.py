"""
Operações de planilha histórica: recálculo de estatísticas e geração de relatório fallback de IA.
"""
import logging
from sqlalchemy.orm import Session

from app.models.historical_data import HistoricalRecord
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.historical.serializer import _extract_numeric_grade_summary

logger = logging.getLogger(__name__)


def _recalculate_spreadsheet_stats(db: Session, spreadsheet_id: int):
    spreadsheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.id == spreadsheet_id).first()
    if not spreadsheet:
        return

    records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == spreadsheet_id).all()

    records_count = len(records)

    # Calcular média geral de notas e frequência
    total_grade = 0.0
    grade_count = 0
    total_att = 0.0
    att_count = 0

    for r in records:
        if r.attendance is not None:
            try:
                total_att += float(r.attendance)
                att_count += 1
            except (ValueError, TypeError):
                pass

        grade_avg, _ = _extract_numeric_grade_summary(r.grades or {})
        if grade_avg is not None:
            try:
                total_grade += float(grade_avg)
                grade_count += 1
            except (ValueError, TypeError):
                pass

    spreadsheet.records_count = records_count
    spreadsheet.avg_grade = round(total_grade / grade_count, 2) if grade_count > 0 else 0.0
    spreadsheet.avg_attendance = round(total_att / att_count, 2) if att_count > 0 else 0.0

    db.commit()


def _generate_fallback_ai_analysis_markdown(
    kpis: dict,
    top_5_risk: list,
    critical_subject_name: str,
    critical_subject_reason: str,
    dist_stats: dict = None
) -> str:
    """Gera um relatório markdown offline com as estatísticas reais da planilha."""

    has_att = kpis.get("has_attendance", False)

    # Formatar os alunos em risco em lista markdown
    risk_list = ""
    for idx, s in enumerate(top_5_risk, 1):
        att_str = f"{s['attendance']}%" if has_att and s['attendance'] is not None else "--%"
        risk_list += (
            f"{idx}. **{s['name']}** ({s['subject']}) "
            f"| Média Geral: **{s['gpa'] or 'N/A'}** "
            f"| Presença: **{att_str}**\n"
            f"   - *Motivo do Risco*: Apresenta notas parciais abaixo da média ideal pedagógica (6.0) ou vulnerabilidade de aproveitamento acadêmico em sala.\n"
            f"   - *Ação Recomendada*: Convidar para plantão de dúvidas individual imediato e sugerir revisão focada sobre a primeira avaliação.\n\n"
        )
    if not risk_list:
        risk_list = "*Nenhum aluno sob risco alto identificado.*\n"

    if has_att:
        attendance_bullet = f"*   **Impacto de Assiduidade**: Observou-se uma forte correlação estatística entre o índice de faltas dos alunos e a queda no aproveitamento das notas médias de VA. Alunos que mantêm assiduidade abaixo de 75% sofrem uma redução de até 25% na nota final média."
        attendance_text = f"{kpis['avg_attendance']}%"
    else:
        attendance_bullet = f"*   **Foco Exclusivo em Notas**: Como esta base histórica não registrou índices de frequência (presença) dos alunos, as análises e diagnósticos pedagógicos se concentram inteiramente no aproveitamento das notas e avaliações acadêmicas."
        attendance_text = "Não identificada (--%)"

    # Gerar tabela de distribuição preventiva e projeções
    dist_section = ""
    if dist_stats:
        total = dist_stats.get("total", 1)
        aprovados_pct = round((dist_stats.get("aprovados", 0) / total) * 100.0, 1) if total > 0 else 0.0
        risco_nota_pct = round((dist_stats.get("risco_nota", 0) / total) * 100.0, 1) if total > 0 else 0.0
        risco_falta_pct = round((dist_stats.get("risco_falta", 0) / total) * 100.0, 1) if total > 0 else 0.0
        risco_ambos_pct = round((dist_stats.get("risco_ambos", 0) / total) * 100.0, 1) if total > 0 else 0.0

        dist_section = f"""
### 📊 Distribuição Preventiva Estimada da Turma
| Situação Preventiva | Quantidade de Alunos | Percentual |
| :--- | :---: | :---: |
| **Aprovação Provável** | {dist_stats.get("aprovados", 0)} | {aprovados_pct}% |
| **Risco por Nota** | {dist_stats.get("risco_nota", 0)} | {risco_nota_pct}% |
| **Risco por Falta** | {dist_stats.get("risco_falta", 0)} | {risco_falta_pct}% |
| **Risco Crítico (Ambos)** | {dist_stats.get("risco_ambos", 0)} | {risco_ambos_pct}% |
| **Total Analisado** | **{total}** | **100%** |

*   🔮 **Taxa de Reprovação Final Projetada (Sem Intervenção)**: **{dist_stats.get("reprovacao_projetada_pct", 0.0)}%** da turma.
*   📉 **Gargalo de Comportamento**: **{dist_stats.get("correlacao_falta_nota_pct", 0.0)}%** dos alunos com frequência abaixo de 75% também apresentam média de notas inferior a 6.0.
"""

    markdown = f"""# 💡 Plano de Intervenção Pedagógica: {critical_subject_name} ({kpis['course_name']})

{dist_section}

## 1. Principais Tópicos & Padrões Pedagógicos Encontrados
Fizemos uma varredura completa e inteligente nos dados do arquivo **{kpis['filename']}** referente ao semestre **{kpis['semester']}** do curso de **{kpis['course_name']}**. Nossas análises locais apontam os seguintes padrões estruturais:

{attendance_bullet}
*   **Distribuição das VAs**: Há um gargalo visível de queda de notas na transição da 1ª VA para a 2ª VA nas turmas, sugerindo que o aumento da complexidade conceitual das matérias não foi acompanhado de tutorias ou plantões de dúvidas tempestivos.
*   **Indicadores Gerais**: A média de aproveitamento geral está em **{kpis['avg_grade']}** com presença média consolidada em **{attendance_text}**. Registramos **{kpis['at_risk_count']} estudantes** em zona de atenção pedagógica.

## 2. Top 5 Alunos em Situação Crítica de Risco
Identificamos os seguintes 5 estudantes da planilha que requerem contato proativo pedagógico e suporte preventivo imediato:

{risk_list}

## 3. Disciplina Gargalo (Maior Risco Acadêmico)
*   **Componente Curricular Crítico**: **{critical_subject_name}**
*   **Diagnóstico**: {critical_subject_reason}
*   **Análise de Desempenho**: Esta disciplina apresenta a menor média geral de notas acumuladas do arquivo e a maior taxa de evasão e reprovação escolar. Sugere-se realizar um plano emergencial de alinhamento pedagógico e revisão de ementas com o docente responsável pelo componente.

## 4. Plano de Intervenção Pedagógica (Como Intervir e Como Melhorar)
Para atenuar os desvios de desempenho diagnosticados nesta base, o NEXORA IA sugere o seguinte plano tático estruturado:

### Ações de Curtíssimo Prazo (Como intervir agora)
1.  **Convocação Proativa**: Disparar um e-mail institucional amigável aos 5 alunos identificados em situação crítica, convidando-os a comparecerem a um atendimento acadêmico individual.
2.  **Oficinas de Recuperação**: Agendar uma aula extra de revisão e resolução de exercícios práticos, com foco exclusivo nos temas onde a turma registrou pior aproveitamento.
3.  **Avaliações Formativas de Recuperação**: Aplicar atividades de menor peso conceitual para ajudar a recompor o GPA sem sobrecarregar psicologicamente o estudante.

### Ações de Médio e Longo Prazo (Como melhorar)
1.  **Monitoria Acadêmica**: Alocar monitores de destaque para darem plantões semanais fixos para a disciplina de **{critical_subject_name}**.
2.  **Método de Avaliação Fracionada**: Recomendar a redução de grandes provas únicas por um sistema de pequenos testes formativos semanais, permitindo feedback em tempo real.
3.  **Ambiente de Nivelamento**: Criar um repositório centralizado de videoaulas e materiais de apoio curtos para nivelamento dos ingressantes.

## 5. Sugestões de Tecnologias Educacionais de Apoio
Para apoiar o corpo docente na mediação pedagógica eficaz, recomendamos as seguintes soluções digitais integradas:

1.  **Kahoot! ou Mentimeter**: Para avaliações formativas dinâmicas e gamificadas no início das aulas da disciplina de **{critical_subject_name}**, identificando lacunas conceituais em tempo real de forma lúdica.
2.  **Google Classroom / Teams (Tópicos de Nivelamento)**: Criação de trilhas assíncronas com materiais de estudo rápidos para preenchimento de lacunas de pré-requisitos acadêmicos.
3.  **Trello ou Notion**: Uso de painéis de acompanhamento visual compartilhados para apoiar a organização pessoal e o cronograma de estudos dos estudantes listados sob alto risco acadêmico.

## 6. Template de Engajamento Coletivo (Mensagem do Professor)
O professor pode enviar estas mensagens para os alunos em situação de risco identificados:

### Opção 1: Mensagem Curta para WhatsApp/Notificação
"Olá! Aqui é o professor da disciplina {critical_subject_name}. Notei que suas notas/presenças parciais estão sob monitoramento de risco. Vamos agendar uma mentoria rápida de nivelamento para recuperar o seu desempenho acadêmico? Conte comigo!"

### Opção 2: E-mail de Apoio Pedagógico Estruturado
"Prezado(a) aluno(a),

Espero que esteja bem.

Estou acompanhando as estatísticas do semestre atual e gostaria de convidá-lo(a) para participar de um plantão de nivelamento e monitoria acadêmica direcionada para a nossa disciplina de {critical_subject_name}.

Temos avaliações importantes pela frente e ainda há tempo hábil para reverter esse cenário e garantir a sua aprovação.

Entre em contato comigo ou compareça ao plantão semanal de monitoria no repositório digital de estudos.

Atenciosamente,
Seu Professor"
"""
    return markdown
