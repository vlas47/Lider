import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { api, endpoint, setCsrfToken } from "./api";
import "./styles.css";


const PLATFORMS = {
  profi: {
    key: "profi",
    label: "Profi.ru",
    eyebrow: "Profi Radar",
    defaultUrl: "https://profi.ru/backoffice/n.php",
    apiBase: "profi/api/server/",
    accent: "mint",
  },
  freelance: {
    key: "freelance",
    label: "Freelance.ru",
    eyebrow: "Freelance Radar",
    defaultUrl: "https://freelance.ru/task?q=&c%5B%5D=4&a=1&v=1",
    apiBase: "freelance/api/server/",
    accent: "amber",
  },
};


const QUICK_REPLY_TOPICS = [
  {
    id: "ecommerce",
    label: "Интернет-магазин",
    keywords: ["интернет-магазин", "интернет магазин", "e-commerce", "ecommerce", "каталог товаров", "корзин", "оплат через сайт"],
    reply: [
      "Здравствуйте! Занимаюсь разработкой интернет-магазинов и e-commerce систем: каталог, корзина, оплата, доставка, личный кабинет и интеграции с 1С/CRM.",
      "По вашей задаче могу предложить структуру решения и разбить запуск на понятные этапы. Подскажите: есть ли готовый дизайн и каталог товаров, какие способы оплаты и доставки нужны, требуется ли обмен с 1С или маркетплейсами?",
      "После уточнений дам оценку сроков и стоимости.",
    ].join("\n\n"),
  },
  {
    id: "crm",
    label: "CRM и кабинеты",
    keywords: ["crm", "срм", "личный кабинет", "кабинет пользователя", "воронк", "учет заявок", "учёт заявок", "бизнес-процесс"],
    reply: [
      "Здравствуйте! Проектирую и разрабатываю CRM и личные кабинеты: роли пользователей, статусы заявок, воронки, документы, уведомления и отчёты.",
      "Готов разобрать ваш процесс и предложить понятную первую версию системы. Уточните, пожалуйста: кто будет работать в системе, как сейчас проходит заявка и с какими сервисами нужна интеграция?",
      "После короткого уточнения подготовлю структуру, этапы и оценку разработки.",
    ].join("\n\n"),
  },
  {
    id: "wms",
    label: "WMS и склад",
    keywords: ["wms", "склад", "остатк", "ячейк", "приемк", "приёмк", "сборк заказ", "отгруз", "маркировк"],
    reply: [
      "Здравствуйте! Разрабатываю складские системы и WMS: приёмка, ячейки, остатки, сборка, отгрузка, маркировка и контроль операций.",
      "Могу разложить задачу по процессам и предложить поэтапный запуск. Подскажите: сколько складов и пользователей, какое оборудование используется, где сейчас ведётся учёт и нужна ли связь с 1С или маркетплейсами?",
      "По ответам подготовлю архитектуру первой версии и оценку.",
    ].join("\n\n"),
  },
  {
    id: "web-app",
    label: "Веб-сервис и MVP",
    keywords: ["веб-сервис", "веб сервис", "веб-прилож", "saas", "онлайн-сервис", "онлайн сервис", "mvp", "сервисная платформа"],
    reply: [
      "Здравствуйте! Разрабатываю веб-сервисы и MVP: личные кабинеты, роли и права, подписки, платежи, уведомления, административные панели и API.",
      "Могу помочь превратить идею в понятную первую версию без лишней сложности. Подскажите: кто основные пользователи, какую ключевую задачу решает сервис, какие функции обязательны для запуска и нужны ли платежи или внешние интеграции?",
      "После уточнений предложу состав MVP, архитектуру, этапы и оценку.",
    ].join("\n\n"),
  },
  {
    id: "automation",
    label: "Автоматизация и парсеры",
    keywords: ["автоматизац", "парсер", "парсинг", "сбор данных", "обработка данных", "скрипт", "выгрузк", "загрузк данных"],
    reply: [
      "Здравствуйте! Автоматизирую повторяющиеся операции и разрабатываю парсеры: сбор, очистка, сопоставление, обработка и выгрузка данных по расписанию.",
      "Готов предложить надёжный сценарий с журналом ошибок и контролем результата. Уточните, пожалуйста: откуда нужно получать данные, в каком объёме и формате, куда передавать результат, как часто запускать обработку и требуется ли авторизация на источнике?",
      "По этим данным оценю способ реализации, срок и стоимость.",
    ].join("\n\n"),
  },
  {
    id: "bots",
    label: "Telegram и MAX-боты",
    keywords: ["telegram", "телеграм", "чат-бот", "чат бот", "max-бот", "max бот", "бот для", "бот в", "создать бота", "разработать бота"],
    reply: [
      "Здравствуйте! Разрабатываю Telegram- и MAX-ботов для заявок, уведомлений, поддержки, внутренних процессов и работы с личным кабинетом.",
      "Могу реализовать сценарии, роли, кнопки, оплату и интеграцию с CRM или вашей системой. Подскажите: что должен уметь бот, кто им будет пользоваться, где хранятся данные и нужна ли веб-админка для управления?",
      "После уточнений предложу логику диалогов, этапы и оценку разработки.",
    ].join("\n\n"),
  },
  {
    id: "integrations",
    label: "Интеграции и API",
    keywords: ["api", "апи", "интеграц", "webhook", "вебхук", "1с", "обмен данными", "платежн"],
    reply: [
      "Здравствуйте! Занимаюсь интеграциями через API: 1С, CRM, платежи, доставка, маркетплейсы, внешние сервисы и боты.",
      "Готов изучить текущую схему и предложить надёжный обмен данными. Уточните, пожалуйста: какие системы нужно связать, есть ли документация и тестовый доступ, обмен односторонний или двусторонний, требуется ли работа в реальном времени?",
      "После этого обозначу способ реализации, сроки и стоимость.",
    ].join("\n\n"),
  },
  {
    id: "landing",
    label: "Лендинг",
    keywords: ["лендинг", "landing", "одностранич", "посадочная страниц", "промо-страниц", "форма заявк"],
    reply: [
      "Здравствуйте! Разрабатываю лендинги под конкретную услугу или продукт: продуманная структура, адаптивный дизайн, формы заявок, аналитика и базовая SEO-настройка.",
      "Могу собрать страницу под ключ и помочь выстроить блоки так, чтобы посетителю было понятно предложение и следующий шаг. Подскажите: есть ли готовые тексты и фирменный стиль, какое целевое действие нужно, куда передавать заявки и есть ли примеры сайтов, которые вам нравятся?",
      "После уточнений предложу структуру лендинга, срок и стоимость.",
    ].join("\n\n"),
  },
  {
    id: "corporate",
    label: "Корпоративный сайт",
    keywords: ["корпоративный сайт", "сайт компании", "сайт организации", "многостранич", "страница услуг", "раздел услуг"],
    reply: [
      "Здравствуйте! Разрабатываю корпоративные сайты для компаний: услуги, кейсы, информация о компании, формы обращений, удобное управление контентом, аналитика и базовая SEO-подготовка.",
      "Готов продумать структуру и запустить проект по этапам. Подскажите: какие разделы нужны, готовы ли тексты и фотографии, требуется ли уникальный дизайн, мультиязычность, личный кабинет или интеграция с CRM?",
      "По ответам подготовлю карту страниц, план работ и оценку.",
    ].join("\n\n"),
  },
  {
    id: "site-work",
    label: "Доработка сайта",
    keywords: ["доработ", "исправ", "аудит", "ошибк", "вирус", "тильд", "tilda", "wordpress", "вордпресс", "битрикс", "ускор", "редизайн"],
    reply: [
      "Здравствуйте! Могу подключиться к доработке существующего сайта: провести аудит, исправить ошибки, улучшить структуру, скорость и пользовательские сценарии. Работаю с самописными проектами, WordPress, Битрикс и Tilda.",
      "Чтобы точно оценить задачу, пришлите ссылку на сайт, его технологию, список приоритетных изменений и желаемый срок. Если есть доступ к коду или тестовой среде — это ускорит диагностику.",
      "После первичного просмотра предложу план работ и оценку.",
    ].join("\n\n"),
  },
];


function suggestedQuickReply(lead) {
  const sourceText = `${lead.title || ""} ${lead.raw_text || ""}`.toLowerCase();
  const priority = ["bots", "ecommerce", "corporate", "landing", "wms", "crm", "integrations", "web-app", "automation", "site-work"];
  return priority
    .map((topicId) => QUICK_REPLY_TOPICS.find((topic) => topic.id === topicId))
    .find((topic) => topic?.keywords.some((keyword) => sourceText.includes(keyword)))
    || QUICK_REPLY_TOPICS.find((topic) => topic.id === "site-work");
}


function contextualQuickReply(topic, lead) {
  const sourceText = `${lead.title || ""} ${lead.raw_text || ""}`.toLowerCase();

  if (topic.id === "ecommerce" && /крипт|crypto|usdt|биткоин|ethereum/.test(sourceText)) {
    return [
      "Здравствуйте! Готов разработать современный интернет-магазин с каталогом, корзиной, личным кабинетом, административной панелью и оплатой криптовалютой.",
      "Для точной оценки уточните, пожалуйста: какие криптовалюты и сети нужно поддержать, оплата будет через готовый платёжный сервис или напрямую на кошелёк, требуется ли автоматическое подтверждение платежа, готовы ли дизайн и каталог товаров?",
      "После уточнений предложу архитектуру, этапы разработки, сроки и стоимость.",
    ].join("\n\n");
  }

  if (topic.id === "corporate" && /lpmotor|lp motor|lpmot|\blp\b/.test(sourceText)) {
    const contentNote = /контент есть|контент готов|готов(?:ы|ый) контент/.test(sourceText)
      ? " Вижу, что контент уже подготовлен."
      : "";
    return [
      `Здравствуйте! Готов разработать корпоративный сайт в LPmotor: продумать структуру, оформить услуги и преимущества компании, настроить виджеты, формы обращений и адаптивную версию.${contentNote}`,
      "Уточните, пожалуйста: какие разделы должны быть на сайте, есть ли фирменный стиль и примеры по дизайну, какие виджеты и интеграции нужны, требуется ли подключение CRM и аналитики?",
      "После уточнений подготовлю структуру страниц, план работ, сроки и стоимость.",
    ].join("\n\n");
  }

  if (topic.id === "bots" && /крипт|crypto|usdt|финансов/.test(sourceText)) {
    return [
      "Здравствуйте! Готов разработать Telegram-бота для финансовых операций с криптовалютой: интерактивное меню, каталог, пользовательские сценарии, уведомления и административное управление.",
      "Для оценки уточните, пожалуйста: какие именно операции должен выполнять бот, с какими сетями или сервисами нужна интеграция, требуется ли авторизация пользователей, хранение балансов и ручная модерация операций?",
      "После изучения ТЗ предложу безопасную архитектуру, этапы, сроки и стоимость.",
    ].join("\n\n");
  }

  return topic.reply;
}


function currentRoute() {
  const value = window.location.hash.replace(/^#\/?/, "");
  return value === "profi" || value === "freelance" ? value : "dashboard";
}


function go(route) {
  window.location.hash = route === "dashboard" ? "/" : `/${route}`;
}


function useFrontendVersionWatcher() {
  useEffect(() => {
    const activeScript = [...document.scripts].find((script) => /\/assets\/index-[^/]+\.js$/.test(script.src));
    if (!activeScript) return undefined;

    const activeAsset = new URL(activeScript.src).pathname;
    let checking = false;
    let stopped = false;

    async function checkVersion() {
      if (checking || stopped) return;
      checking = true;
      try {
        const indexUrl = new URL(window.location.href);
        indexUrl.hash = "";
        indexUrl.search = `?app-check=${Date.now()}`;
        const response = await fetch(indexUrl, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) return;
        const html = await response.text();
        const match = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i);
        if (!match) return;
        const nextAsset = new URL(match[1], indexUrl).pathname;
        if (nextAsset === activeAsset) return;

        const reloadUrl = new URL(window.location.href);
        reloadUrl.searchParams.set("app-version", nextAsset.split("/").pop());
        window.location.replace(reloadUrl.toString());
      } catch {
        // Потеря сети не должна мешать работе радара; повторим проверку позже.
      } finally {
        checking = false;
      }
    }

    const interval = window.setInterval(checkVersion, 45000);
    window.addEventListener("focus", checkVersion);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkVersion);
    };
  }, []);
}


function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("api/auth/login/", { method: "POST", body: JSON.stringify({ password }) });
      onLogin();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">AL</div>
        <p className="eyebrow">Личный рабочий контур</p>
        <h1>AI_Lapin</h1>
        <p className="lede">Заявки, радары и быстрый разбор проектов в одном защищённом интерфейсе.</p>
        <form onSubmit={submit}>
          <label>
            <span>Пароль доступа</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary wide" disabled={busy}>{busy ? "Проверяю…" : "Войти"}</button>
        </form>
      </section>
    </main>
  );
}


function AppHeader({ route, onLogout }) {
  return (
    <header className="app-header">
      <button className="identity" onClick={() => go("dashboard")}>
        <span className="brand-mark small">AL</span>
        <span><strong>AI_Lapin</strong><small>operations console</small></span>
      </button>
      <nav>
        <button className={route === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}>Обзор</button>
        <button className={route === "profi" ? "active" : ""} onClick={() => go("profi")}>Profi</button>
        <button className={route === "freelance" ? "active" : ""} onClick={() => go("freelance")}>Freelance</button>
      </nav>
      <button className="ghost" onClick={onLogout}>Выйти</button>
    </header>
  );
}


function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("api/dashboard/").then(setData).catch((requestError) => setError(requestError.message));
  }, []);

  const stats = data?.stats || {};
  return (
    <main className="page dashboard-page">
      <section className="hero">
        <div>
          <p className="eyebrow">Рабочий день · единый радар</p>
          <h1>Нужные проекты<br />без информационного шума.</h1>
        </div>
        <p className="hero-note">Два независимых браузерных профиля, общая модель заявок и единый скоринг в PostgreSQL.</p>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="metric-grid">
        {[
          ["Сегодня", stats.today ?? "—"],
          ["Входящие", stats.inbox ?? "—"],
          ["Проекты", stats.projects ?? "—"],
          ["Риски", stats.risks ?? "—"],
          ["Profi ≥ 38", stats.profi ?? "—"],
          ["Freelance ≥ 38", stats.freelance ?? "—"],
        ].map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>

      <section className="platform-grid">
        {Object.values(PLATFORMS).map((platform) => (
          <article className={`platform-card ${platform.accent}`} key={platform.key}>
            <div className="platform-index">0{platform.key === "profi" ? 1 : 2}</div>
            <p className="eyebrow">{platform.eyebrow}</p>
            <h2>{platform.label}</h2>
            <p>Изолированная сессия, мониторинг новых карточек, AI-оценка и черновик ответа.</p>
            <button className="primary" onClick={() => go(platform.key)}>Открыть радар <span>↗</span></button>
          </article>
        ))}
      </section>

      <section className="recent-panel">
        <div className="section-head">
          <div><p className="eyebrow">Общий поток</p><h2>Последние заявки</h2></div>
          <span className="live-dot">PostgreSQL</span>
        </div>
        <div className="lead-table">
          {(data?.recent_leads || []).map((lead) => (
            <a href={lead.source_url || undefined} target={lead.source_url ? "_blank" : undefined} rel="noreferrer" key={`${lead.source}-${lead.id}`}>
              <span className={`source-badge ${lead.source}`}>{lead.source_label}</span>
              <strong>{lead.title}</strong>
              <span>{lead.verdict || "Ручная проверка"}</span>
              <b>{lead.score}</b>
            </a>
          ))}
          {data && !data.recent_leads.length && <div className="empty-state">Новых заявок пока нет.</div>}
        </div>
      </section>
    </main>
  );
}


function LeadCard({ lead }) {
  const quickReplies = lead.quick_replies || [];
  const suggestedTopic = quickReplies.find((topic) => topic.id === lead.suggested_reply_id)
    || quickReplies.find((topic) => topic.suggested)
    || quickReplies[0]
    || { id: "", label: "", reply: "" };
  const [selectedTopicId, setSelectedTopicId] = useState(suggestedTopic.id);
  const [copied, setCopied] = useState("");
  const selectedTopic = quickReplies.find((topic) => topic.id === selectedTopicId) || suggestedTopic;
  const selectedReply = selectedTopic.reply || "";

  useEffect(() => {
    setSelectedTopicId(suggestedTopic.id);
  }, [lead.id, suggestedTopic.id]);

  async function copyText(text, kind) {
    await navigator.clipboard.writeText(text || "");
    setCopied(kind);
    setTimeout(() => setCopied(""), 1200);
  }

  return (
    <article className="lead-card">
      <div className="lead-title">
        <div><strong>{lead.title}</strong><span>{lead.verdict} · {lead.updated_at}</span></div>
        <b>{lead.score}</b>
      </div>
      {lead.ai_notes && <p className="notes">{lead.ai_notes}</p>}
      {quickReplies.length > 0 && <section className="quick-reply-box">
        <div className="quick-reply-head">
          <strong>Быстрый ответ</strong>
          <span>Рекомендовано: {suggestedTopic.label}</span>
        </div>
        <div className="quick-reply-topics" aria-label="Тема быстрого ответа">
          {quickReplies.map((topic) => (
            <button
              className={selectedTopic.id === topic.id ? "active" : ""}
              key={topic.id}
              onClick={() => setSelectedTopicId(topic.id)}
              type="button"
            >
              {topic.label}
            </button>
          ))}
        </div>
        <div className="draft quick-draft">{selectedReply}</div>
      </section>}
      {lead.draft_reply && (
        <details className="ai-draft">
          <summary>AI-черновик заявки</summary>
          <div className="draft">{lead.draft_reply}</div>
        </details>
      )}
      <div className="lead-actions">
        {lead.source_url && <a href={lead.source_url} target="_blank" rel="noreferrer">Открыть проект</a>}
        {selectedReply && (
          <button className="quick-copy" onClick={() => copyText(selectedReply, "quick")}>
            {copied === "quick" ? "Скопировано" : "Скопировать быстрый ответ"}
          </button>
        )}
        {lead.draft_reply && (
          <button onClick={() => copyText(lead.draft_reply, "ai")}>
            {copied === "ai" ? "Скопировано" : "Копировать AI-черновик"}
          </button>
        )}
      </div>
    </article>
  );
}


function PlatformRadar({ platform }) {
  const [data, setData] = useState({ status: {}, leads: [] });
  const [targetUrl, setTargetUrl] = useState(platform.defaultUrl);
  const [input, setInput] = useState("");
  const [threshold, setThreshold] = useState(51);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [screenTick, setScreenTick] = useState(Date.now());

  const serverUrl = platform.apiBase;
  const screenshotUrl = useMemo(
    () => `${endpoint(`${serverUrl}screenshot.png`)}?t=${screenTick}`,
    [screenTick, serverUrl],
  );

  const refreshState = useCallback(async () => {
    try {
      const payload = await api(serverUrl);
      setData(payload);
      if (payload.status?.url) setTargetUrl(payload.status.url);
      setError(payload.status?.last_error || "");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [serverUrl]);

  useEffect(() => {
    setData({ status: {}, leads: [] });
    setTargetUrl(platform.defaultUrl);
    refreshState();
  }, [platform.defaultUrl, refreshState]);

  useEffect(() => {
    const stateTimer = setInterval(refreshState, 3000);
    const screenTimer = setInterval(() => {
      if (data.status?.started) setScreenTick(Date.now());
    }, 1600);
    return () => {
      clearInterval(stateTimer);
      clearInterval(screenTimer);
    };
  }, [data.status?.started, refreshState]);

  async function command(action, payload = {}) {
    setBusy(action);
    setError("");
    try {
      const result = await api(serverUrl, {
        method: "POST",
        body: JSON.stringify({ action, ...payload }),
      });
      setData((current) => ({
        status: result.status || current.status,
        leads: result.leads || current.leads,
      }));
      if (result.status?.url) setTargetUrl(result.status.url);
      setScreenTick(Date.now());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  }

  function clickScreen(event) {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const rect = image.getBoundingClientRect();
    command("click", {
      x: (event.clientX - rect.left) * (image.naturalWidth / rect.width),
      y: (event.clientY - rect.top) * (image.naturalHeight / rect.height),
    });
  }

  const status = data.status || {};
  return (
    <main className={`page radar-page ${platform.accent}`}>
      <section className="radar-heading">
        <div><p className="eyebrow">{platform.eyebrow}</p><h1>{platform.label}</h1></div>
        <div className="status-stack">
          <span className={status.started ? "online" : "offline"}>{status.started ? "browser on" : "browser off"}</span>
          <span className={status.monitor_active ? "online" : "offline"}>{status.monitor_active ? "monitor on" : "monitor off"}</span>
        </div>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="radar-layout">
        <div className="browser-column">
          <form className="address-bar" onSubmit={(event) => { event.preventDefault(); command("goto", { url: targetUrl }); }}>
            <button type="button" onClick={() => command("back")}>←</button>
            <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} aria-label="Адрес" />
            <button type="button" onClick={() => command("reload")}>↻</button>
            <button className="primary" disabled={Boolean(busy)}>Открыть</button>
            {status.started && <button type="button" onClick={() => command("stop")}>Стоп</button>}
          </form>
          <div className="phone-frame">
            <div className="phone-speaker" />
            {status.started ? (
              <img src={screenshotUrl} alt={`${platform.label} в серверном браузере`} onClick={clickScreen} onWheel={(event) => { event.preventDefault(); command("scroll", { delta_y: event.deltaY }); }} />
            ) : (
              <div className="phone-empty">
                <span>Серверный браузер остановлен</span>
                <button className="primary" onClick={() => command("start")}>Запустить</button>
              </div>
            )}
          </div>
            <form className="remote-input" onSubmit={(event) => { event.preventDefault(); if (input) { command("type", { text: input }); setInput(""); } }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Текст для активного поля браузера" />
            <button type="button" onClick={() => command("press", { key: "Backspace" })}>⌫</button>
            <button type="button" onClick={() => command("press", { key: "Enter" })}>Enter</button>
            <button className="primary">Ввести</button>
          </form>
        </div>

        <div className="agent-column">
          <section className="control-panel">
            <div className="section-head"><div><p className="eyebrow">Наблюдение</p><h2>Автоскан</h2></div><span>{status.next_scan_at ? `следующий ${status.next_scan_at}` : "ожидает"}</span></div>
            <div className="scan-controls">
              <label><span>Порог</span><input type="number" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
              <button className="primary" onClick={() => command("monitor_start")}>Старт</button>
              <button onClick={() => command("monitor_stop")}>Стоп</button>
              <button onClick={() => command("scan", { refresh: true, force: true, threshold })}>Скан сейчас</button>
            </div>
            <p className="scan-summary">{status.last_scan_summary || "После запуска радар запомнит верхние карточки и будет искать изменения."}</p>
            <div className="event-list">
              {(status.events || []).map((event, index) => <div className={`event ${event.kind || ""}`} key={`${event.created_at}-${index}`}><time>{event.created_at}</time><span>{event.message}</span></div>)}
            </div>
          </section>

          <section className="leads-panel">
            <div className="section-head"><div><p className="eyebrow">Результат</p><h2>Последние заявки</h2></div><b>{data.leads?.length || 0}</b></div>
            <div className="lead-list">
              {(data.leads || []).map((lead) => <LeadCard lead={lead} key={lead.id} />)}
              {!data.leads?.length && <div className="empty-state">Запусти браузер и сделай первый скан.</div>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}


function App() {
  useFrontendVersionWatcher();
  const [authenticated, setAuthenticated] = useState(null);
  const [route, setRoute] = useState(currentRoute());

  const refreshAuth = useCallback(async () => {
    try {
      const payload = await api("api/auth/status/");
      setCsrfToken(payload.csrf_token);
      setAuthenticated(payload.authenticated);
    } catch {
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
    const updateRoute = () => setRoute(currentRoute());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, [refreshAuth]);

  async function logout() {
    await api("api/auth/logout/", { method: "POST", body: "{}" });
    setAuthenticated(false);
  }

  if (authenticated === null) return <main className="loading">AI_Lapin</main>;
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  return (
    <div className="app-shell">
      <AppHeader route={route} onLogout={logout} />
      {route === "dashboard" ? <Dashboard /> : <PlatformRadar platform={PLATFORMS[route]} />}
    </div>
  );
}


createRoot(document.getElementById("root")).render(<App />);
