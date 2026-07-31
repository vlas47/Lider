from .models import Lead
from .scoring import (
    analyze_profi_text,
    build_external_draft,
    build_local_draft,
    build_max_message,
    build_openai_analysis,
    post_json,
    send_max_event,
    send_max_text,
)


def create_lead_from_text(
    source: str,
    raw_text: str,
    source_url: str = "",
    client_hint: str = "",
    source_id: str | None = None,
    category: str = "",
    published_hint: str = "",
):
    if source not in {Lead.SOURCE_PROFI, Lead.SOURCE_FREELANCE}:
        raise ValueError(f"Unsupported lead source: {source}")

    analysis = analyze_profi_text(raw_text)
    analysis = build_openai_analysis(raw_text, analysis) or analysis
    external_draft = build_external_draft(raw_text, analysis)
    draft_reply = analysis.get("draft_reply", "") or external_draft or build_local_draft(
        raw_text,
        analysis.get("reasons", []),
        analysis.get("score", 0),
    )
    return Lead.objects.create(
        source=source,
        source_id=source_id or None,
        title=analysis["title"],
        source_url=source_url.strip(),
        raw_text=raw_text.strip(),
        client_hint=client_hint.strip(),
        category=category.strip(),
        published_hint=published_hint.strip(),
        budget_hint=analysis["budget_hint"],
        score=analysis["score"],
        verdict=analysis["verdict"],
        ai_notes="\n".join(analysis["reasons"]),
        draft_reply=draft_reply,
        status=analysis["status"],
    )


def create_profi_lead_from_text(raw_text: str, source_url: str = "", client_hint: str = ""):
    return create_lead_from_text(
        Lead.SOURCE_PROFI,
        raw_text,
        source_url=source_url,
        client_hint=client_hint,
    )


def create_freelance_lead_from_text(
    raw_text: str,
    source_url: str = "",
    client_hint: str = "",
    source_id: str | None = None,
    category: str = "",
    published_hint: str = "",
):
    return create_lead_from_text(
        Lead.SOURCE_FREELANCE,
        raw_text,
        source_url=source_url,
        client_hint=client_hint,
        source_id=source_id,
        category=category,
        published_hint=published_hint,
    )
