import json
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from .quick_replies import build_suggested_quick_reply


POSITIVE_RULES = [
    (("crm", "срм", "воронк", "заявк", "клиент", "менеджер"), 18, "CRM и учет заявок"),
    (("веб-разработка", "веб разработка", "сделать сайт", "создание сайта", "разработка сайта", "несколько сайтов", "сайт или несколько сайтов"), 32, "профильная веб-разработка"),
    (("wms", "склад", "остат", "приемк", "отгруз", "фулфилмент", "маркетплейс"), 20, "склад, WMS или фулфилмент"),
    (("личный кабинет", "кабинет", "портал", "b2b", "партнер"), 16, "личный кабинет или B2B-портал"),
    (("интернет-магазин", "магазин", "каталог", "корзин", "оплат", "доставк"), 14, "интернет-магазин"),
    (("b2c", "карточка товара", "корзина", "процесс покупки", "оформление заказа"), 12, "полный e-commerce сценарий"),
    (("лендинг", "визитк", "одностранич", "корпоративный сайт"), 14, "маленькая быстрая сайт-задача"),
    (("сайт компании", "корпоративный сайт", "информационная страница"), 10, "сайт компании"),
    (("figma", "фигм", "auto layout", "дизайн-токен", "готовые дизайны", "десктопной и мобильной"), 8, "готовые макеты в Figma"),
    (("интеграц", "api", "1с", "amo", "битрикс", "мой склад", "юкасса", "сдэк"), 18, "интеграции"),
    (("django", "react", "python", "backend", "frontend", "админк"), 12, "подходящий стек"),
    (("автоматизац", "процесс", "регламент", "отчет", "дашборд"), 14, "автоматизация процесса"),
    (("ocr", "распознаван", "оцифров", "документ", "архив"), 16, "оцифровка или OCR"),
]

NEGATIVE_RULES = [
    (("курсов", "диплом", "лабораторн", "реферат"), 22, "учебная работа"),
    (("за отзыв", "бесплатно"), 18, "нет оплаты"),
    (("проектирование мебели", "чертеж мебели", "чертежи мебели", "раскрой мебели", "дизайн мебели", "3d модель мебели", "3д модель мебели"), 24, "проектирование мебели"),
    (("wordpress", "tilda", "wix"), 8, "конструктор вместо системы"),
]


def create_profi_lead_from_text(raw_text: str, source_url: str = "", client_hint: str = ""):
    from leads.services import create_profi_lead_from_text as create_shared_profi_lead

    return create_shared_profi_lead(raw_text, source_url=source_url, client_hint=client_hint)


def build_openai_analysis(raw_text: str, fallback: dict) -> dict:
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        return {}

    prompt = {
        "company": "Lapin Systems",
        "positioning": (
            "Business web systems: CRM, WMS, fulfillment, B2B portals, personal accounts, "
            "integrations, marketplaces, OCR and process automation."
        ),
        "scoring": {
            "high": "business automation, CRM, WMS, logistics, integrations, e-commerce, business workflows",
            "medium": "site or cabinet tasks that can grow into a business system",
            "low": "games, furniture design, student work, vague one-off help, tasks with no payment",
            "budget_policy": "Budget amounts on Profi can be random. Keep budget_hint for reference only; do not increase or decrease score by budget.",
        },
        "fallback_score": fallback.get("score", 0),
        "fallback_reasons": fallback.get("reasons", []),
        "lead_text": raw_text.strip()[:4500],
    }
    system = (
        "You are a lead qualification assistant for a Russian web-systems developer. "
        "Return only valid JSON. Fields: title, budget_hint, score, verdict, status, reasons, draft_reply. "
        "score must be 0-100. status must be review when score >= 38, otherwise skipped. "
        "Do not score by budget amount because clients often write arbitrary budgets; budget_hint is informational only. "
        "reasons must be a short Russian array. draft_reply must be in Russian, warm, concrete, first person "
        "from Vladimir, max 900 characters, no promises of automatic sending, and ask 1-2 useful clarifying questions."
    )
    payload = {
        "model": getattr(settings, "OPENAI_MODEL", "gpt-4.1-mini"),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "temperature": 0.2,
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        response = post_json(
            f"{getattr(settings, 'OPENAI_API_BASE', 'https://api.openai.com/v1').rstrip('/')}/chat/completions",
            payload,
            headers=headers,
            timeout=25,
        )
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError):
        return {}

    content = (
        response.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    if not content:
        return {}

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {}

    fallback_score = int(fallback.get("score", 0) or 0)
    score = int(data.get("score", fallback_score))
    score = max(score, fallback_score)
    score = max(0, min(100, score))
    fallback_reasons = [str(reason) for reason in fallback.get("reasons", [])]
    reasons = data.get("reasons", fallback_reasons)
    if not isinstance(reasons, list):
        reasons = [str(reasons)]
    reasons = fallback_reasons + [
        str(reason)
        for reason in reasons
        if str(reason) not in fallback_reasons
    ]
    status = "review" if score >= 38 else "skipped"
    verdict = str(data.get("verdict") or ("Можно брать" if score >= 38 else "Скорее мимо"))
    return {
        "title": str(data.get("title") or fallback.get("title") or extract_title(raw_text))[:220],
        "budget_hint": str(data.get("budget_hint") or fallback.get("budget_hint") or "")[:120],
        "score": score,
        "verdict": verdict[:120],
        "status": status,
        "reasons": [str(reason)[:180] for reason in reasons[:6]],
        "draft_reply": str(data.get("draft_reply") or "")[:1200],
    }


def analyze_profi_text(raw_text: str) -> dict:
    text = raw_text.strip()
    lowered = text.lower()
    score = 8
    reasons = []

    for tokens, value, reason in POSITIVE_RULES:
        if any(token in lowered for token in tokens):
            score += value
            reasons.append(reason)

    for tokens, value, reason in NEGATIVE_RULES:
        if any(token in lowered for token in tokens):
            score -= value
            reasons.append(f"минус: {reason}")

    if len(text) > 450:
        score += 8
        reasons.append("задача описана подробно")

    budget_hint = extract_budget_hint(text)

    score = max(0, min(100, score))
    if score >= 62:
        verdict = "Горячая заявка"
        status = "review"
    elif score >= 38:
        verdict = "Можно брать"
        status = "review"
    else:
        verdict = "Скорее мимо"
        status = "skipped"

    if not reasons:
        reasons.append("мало явных сигналов, нужна ручная проверка")

    return {
        "title": extract_title(text),
        "budget_hint": budget_hint,
        "score": score,
        "verdict": verdict,
        "status": status,
        "reasons": reasons,
        "draft_reply": build_local_draft(text, reasons, score),
    }


def extract_title(text: str) -> str:
    for line in text.splitlines():
        clean = line.strip(" -:;\t")
        if clean:
            return clean[:220]
    return "Заявка Profi.ru"


def extract_budget_hint(text: str) -> str:
    match = re.search(r"(?:от|до|бюджет|стоимость)?\s*(\d[\d\s]{2,})\s*(?:руб|₽|р\.?)", text, re.IGNORECASE)
    if not match:
        return ""
    amount = re.sub(r"\s+", " ", match.group(0)).strip()
    return amount[:120]


def build_local_draft(text: str, reasons: list[str], score: int) -> str:
    angle = "вижу задачу по автоматизации бизнес-процесса"
    if reasons:
        angle = reasons[0].replace("минус: ", "")

    return (
        "Здравствуйте. Я Владимир, занимаюсь разработкой веб-систем для бизнеса: CRM, WMS, "
        "личные кабинеты, интеграции, интернет-магазины и сервисные платформы.\n\n"
        f"По описанию {angle}. Могу быстро разобрать процесс, предложить структуру экранов, "
        "модель данных и понятный первый этап разработки.\n\n"
        "Чтобы оценить сроки и стоимость, уточните, пожалуйста: какие роли пользователей будут в системе, "
        "какие данные уже есть и с какими сервисами нужна интеграция?\n\n"
        f"Предварительная оценка интереса заявки: {score}/100."
    )


def build_external_draft(raw_text: str, analysis: dict) -> str:
    endpoint = settings.AI_DRAFT_ENDPOINT
    if not endpoint:
        return ""

    payload = {
        "task": "draft_profi_reply",
        "language": "ru",
        "rules": [
            "Не обещать невозможное.",
            "Не отправлять отклик самостоятельно.",
            "Ответ должен быть коротким, человеческим и конкретным.",
            "Позиционирование: разработка CRM, WMS, кабинетов, интеграций и веб-систем для бизнеса.",
        ],
        "lead": {
            "text": raw_text.strip(),
            "score": analysis["score"],
            "verdict": analysis["verdict"],
            "reasons": analysis["reasons"],
        },
    }
    headers = {"Content-Type": "application/json"}
    if settings.AI_DRAFT_API_KEY:
        headers["Authorization"] = f"Bearer {settings.AI_DRAFT_API_KEY}"

    try:
        response = post_json(endpoint, payload, headers=headers)
    except (urllib.error.URLError, TimeoutError, ValueError):
        return ""

    if isinstance(response, dict):
        for key in ("draft_reply", "reply", "text", "content"):
            value = response.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        choices = response.get("choices")
        if isinstance(choices, list) and choices:
            message = choices[0].get("message", {})
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
    return ""


def send_max_event(lead) -> str:
    result = send_max_text(build_max_message(lead))
    if result == "Отправлено в MAX":
        lead.status = lead.STATUS_SENT_TO_MAX
        lead.max_status = "Отправлено в MAX"
        lead.save(update_fields=["status", "max_status", "updated_at"])
    return result


def send_max_text(text: str, recipient_id: str = "", recipient_kind: str = "") -> str:
    if not settings.MAX_BOT_TOKEN:
        return "MAX не настроен: нет MAX_BOT_TOKEN."
    resolved_recipient_id = recipient_id or settings.MAX_RECIPIENT_ID
    if not resolved_recipient_id:
        return "MAX не настроен: нет MAX_RECIPIENT_ID."

    resolved_kind = recipient_kind or settings.MAX_RECIPIENT_KIND
    resolved_kind = resolved_kind if resolved_kind in {"chat_id", "user_id"} else "chat_id"
    params = urllib.parse.urlencode({resolved_kind: resolved_recipient_id})
    url = f"{settings.MAX_API_BASE.rstrip('/')}/messages?{params}"
    payload = {"text": text[:3900]}
    headers = {
        "Authorization": settings.MAX_BOT_TOKEN,
        "Content-Type": "application/json",
    }

    try:
        post_json(url, payload, headers=headers, cafile=settings.MAX_CA_BUNDLE)
    except urllib.error.HTTPError as error:
        return f"MAX ошибка HTTP {error.code}."
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        return f"MAX не отправлен: {error}."

    return "Отправлено в MAX"


def build_max_message(lead) -> str:
    quick_reply = build_suggested_quick_reply(lead)
    source_label = lead.get_source_display() if hasattr(lead, "get_source_display") else "Profi.ru"
    lines = [
        f"Новая заявка {source_label}",
        f"{lead.verdict}: {lead.score}/100",
        "",
        lead.title,
    ]
    if lead.source_url:
        lines.extend(["", lead.source_url])
    if lead.ai_notes:
        lines.extend(["", "Почему интересно:", lead.ai_notes])
    lines.extend(["", f"Быстрый ответ · {quick_reply['label']}:", quick_reply["reply"]])
    return "\n".join(lines)


def post_json(url: str, payload: dict, headers: dict | None = None, cafile: str = "", timeout: int = 8) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers or {}, method="POST")
    context = ssl.create_default_context(cafile=cafile) if cafile else None
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        body = response.read().decode("utf-8")
    return json.loads(body) if body else {}
