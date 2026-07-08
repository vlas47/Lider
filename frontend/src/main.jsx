import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, ArrowRight, ExternalLink, LogIn, Phone } from "lucide-react";
import "./styles.css";

const fallbackConfig = {
  images: {
    founder: "/static/img/founder-photo.png",
    nextGen: "/static/img/next-gen-photo.jpg",
    portfolioDomkapsul: "/static/img/portfolio-domkapsul.jpg",
    portfolioFullbox: "/static/img/portfolio-fullbox.jpg",
    portfolioAshtanga: "/static/img/portfolio-ashtanga-yoga.jpg",
    portfolioSoyz: "/static/img/portfolio-soyz-zastroi.jpg",
  },
  urls: {
    contact: "#contact",
    phone: "tel:+79180916494",
    industrial: "/industrial-digitization/",
    cabinet: "/service/login/",
  },
  cabinetLabel: "Вход в кабинет",
};

function readConfig() {
  const configNode = document.getElementById("lapin-home-config");

  if (!configNode) {
    return fallbackConfig;
  }

  try {
    const parsed = JSON.parse(configNode.textContent || "{}");

    return {
      ...fallbackConfig,
      ...parsed,
      images: { ...fallbackConfig.images, ...(parsed.images || {}) },
      urls: { ...fallbackConfig.urls, ...(parsed.urls || {}) },
    };
  } catch {
    return fallbackConfig;
  }
}

const processItems = [
  {
    number: "01",
    title: "Разбираемся в процессе",
    text: "Смотрим роли, заявки, данные, статусы, ограничения и точки, где бизнес теряет время.",
  },
  {
    number: "02",
    title: "Проектируем систему",
    text: "Собираем структуру экранов, модель данных, права доступа и понятный первый релиз.",
  },
  {
    number: "03",
    title: "Запускаем и развиваем",
    text: "Делаем backend, frontend, кабинет, отчеты, интеграции и новые версии после запуска.",
  },
];

const services = [
  {
    number: "01",
    title: "CRM и учет заявок",
    text: "Воронки, статусы, роли, задачи, уведомления, история клиентов и управленческие отчеты.",
  },
  {
    number: "02",
    title: "WMS и фулфилмент",
    text: "Складские процессы, приемка, отгрузка, остатки, сборка заказов и интеграции с маркетплейсами.",
  },
  {
    number: "03",
    title: "Личные кабинеты",
    text: "Кабинеты клиентов, партнеров и сотрудников с заказами, документами, оплатами и историей.",
  },
  {
    number: "04",
    title: "Интернет-магазины",
    text: "Каталоги, карточки товаров, корзина, оплаты, доставка, админка и обмены с учетными системами.",
  },
  {
    number: "05",
    title: "Интеграции",
    text: "Связка сайта, склада, 1С, платежей, доставки, телефонии, почты и внешних API.",
  },
  {
    number: "06",
    title: "Оцифровка и OCR",
    text: "Загрузка документов, распознавание, проверка, электронный архив и поиск по данным.",
  },
];

const projects = [
  {
    title: "ФуллБокс",
    type: "Фулфилмент",
    text: "Сайт фулфилмент-оператора для селлеров маркетплейсов.",
    url: "https://fullbox.ru/",
    domain: "fullbox.ru",
    image: "portfolioFullbox",
  },
  {
    title: "Дом Капсул",
    type: "Производство",
    text: "Сайт производителя капсульной мебели с каталогом и карточками моделей.",
    url: "https://domkapsul.ru/",
    domain: "domkapsul.ru",
    image: "portfolioDomkapsul",
  },
  {
    title: "Союз Застройщиков",
    type: "Недвижимость",
    text: "Сайт компании по подбору новостроек с презентацией услуг и объектов.",
    url: "https://soyz-zastroi.ru/",
    domain: "soyz-zastroi.ru",
    image: "portfolioSoyz",
  },
  {
    title: "Аштанга йога",
    type: "Услуги",
    text: "Сайт школы с расписанием, ценами, правилами и записью на практику.",
    url: "https://ashtanga-yoga.guru/",
    domain: "ashtanga-yoga.guru",
    image: "portfolioAshtanga",
  },
];

const testimonials = [
  {
    role: "Собственник производства",
    text: "Быстро разобрались в логике заявок и сделали интерфейс, которым реально удобно пользоваться каждый день.",
  },
  {
    role: "Руководитель склада",
    text: "После запуска стало проще видеть остатки, статусы и узкие места без постоянных переписок в чатах.",
  },
  {
    role: "Коммерческий директор",
    text: "Получили не просто сайт, а рабочий инструмент: заявки, роли, отчеты и понятный путь развития.",
  },
  {
    role: "Операционный менеджер",
    text: "Сначала навели порядок в процессе, потом уже собрали систему. Поэтому результат попал в задачу.",
  },
  {
    role: "Основатель сервиса",
    text: "Понравилось, что технические решения объяснялись языком бизнеса, без лишней магии и тумана.",
  },
  {
    role: "Руководитель отдела продаж",
    text: "CRM стала прозрачнее: видно историю клиента, ответственных и следующий шаг по каждой заявке.",
  },
  {
    role: "Владелец интернет-магазина",
    text: "Сайт и учетные системы наконец начали работать вместе, а не жить отдельными островами.",
  },
  {
    role: "Директор по развитию",
    text: "Первый релиз запустили без раздутого бюджета, а дальше спокойно добавляли нужные функции.",
  },
  {
    role: "Проектный менеджер",
    text: "Было ощущение партнерства: слышали ограничения бизнеса и сразу предлагали практичный вариант.",
  },
  {
    role: "Руководитель документооборота",
    text: "Оцифровка и поиск по документам сняли ручную рутину, которая раньше съедала часы команды.",
  },
];

const stack = ["React", "Django", "FastAPI", "PostgreSQL", "Redis", "REST API", "1С", "OCR", "Docker"];
const scrambleChars = "01<>/[]{}#$%&*@!?ЖЙЯФλΞΔ";
const holdRhythm = [3600, 4700, 3100, 4200, 5400, 3900];
const buildRhythm = [720, 1040, 860, 1210, 930, 1120];

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function rhythmJitter(seed, index, cycle, range) {
  return (seed * 97 + index * 383 + cycle * 211) % range;
}

function getLineHoldMs(seed, index, cycle) {
  const base = holdRhythm[(seed + index + cycle) % holdRhythm.length];
  return base + rhythmJitter(seed, index, cycle, 1200) - 420;
}

function getBuildDurationMs(seed, index, cycle) {
  const base = buildRhythm[(seed + index * 2 + cycle) % buildRhythm.length];
  return base + rhythmJitter(seed, index, cycle, 360);
}

function getScatterDurationMs(seed, index, cycle) {
  return 340 + rhythmJitter(seed, index, cycle, 280);
}

function SectionTitle({ kicker, title, text }) {
  return (
    <div className="ls-section-title ls-reveal">
      <p>{kicker}</p>
      <h2>{title}</h2>
      {text ? <span>{text}</span> : null}
    </div>
  );
}

function useScrollReveal() {
  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll(".ls-reveal"));

    if (!revealItems.length) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -9% 0px",
        threshold: 0.12,
      },
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);
}

function getScrambledText(text, progress, tick, seed) {
  const letters = Array.from(text);

  return letters
    .map((letter, index) => {
      if (letter === " ") {
        return " ";
      }

      const revealAt = (index + 1) / letters.length;
      const jitter = (((seed + index * 13) % 9) - 4) * 0.018;

      if (progress >= revealAt + jitter) {
        return letter;
      }

      return scrambleChars[(index * 7 + tick * 3 + seed + letters.length) % scrambleChars.length];
    })
    .join("");
}

function ScrambleText({ className, text, delay = 0, duration = 860, seed = 0, direction = "in" }) {
  const [output, setOutput] = useState("");
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    let frameId = 0;
    let timerId = 0;

    setOutput("");
    setIsSettled(false);

    timerId = window.setTimeout(() => {
      const startedAt = window.performance.now();
      let maxProgress = 0;

      const run = (now) => {
        const elapsed = now - startedAt;
        const rawProgress = clamp01(elapsed / duration);
        const pace = Math.pow(rawProgress, 0.72 + ((seed % 5) * 0.07));
        const pulse =
          Math.sin(elapsed / (74 + (seed % 37))) * 0.028 +
          Math.sin(elapsed / (151 + (seed % 53))) * 0.035;
        const progress = clamp01(Math.max(maxProgress, pace + pulse));
        const frameSpeed = 28 + ((Math.floor(elapsed / 170) + seed) % 7) * 11;
        const tick = Math.floor((now + seed * 19) / frameSpeed);

        maxProgress = progress;

        if (direction === "out") {
          setOutput(rawProgress >= 1 ? "" : getScrambledText(text, 1 - rawProgress, tick, seed));
        } else {
          setOutput(rawProgress >= 1 ? text : getScrambledText(text, progress, tick, seed));
        }

        if (rawProgress < 1) {
          frameId = window.requestAnimationFrame(run);
        } else {
          setIsSettled(direction === "in");
        }
      };

      frameId = window.requestAnimationFrame(run);
    }, delay * 1000);

    return () => {
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(frameId);
    };
  }, [delay, direction, duration, seed, text]);

  return (
    <span className={`${className}${isSettled ? " is-settled" : " is-scrambling"}`}>
      {output}
    </span>
  );
}

function PhotoCard({ className, image, alt, label, lines, delay = 0, rhythmSeed = 1 }) {
  const [lineState, setLineState] = useState({ index: 0, cycle: 0, direction: "in" });
  const [showLine, setShowLine] = useState(false);

  useEffect(() => {
    const timers = [];
    let index = 0;
    let cycle = 0;

    const addTimer = (callback, timeout) => {
      const timerId = window.setTimeout(callback, timeout);
      timers.push(timerId);
    };

    setLineState({ index: 0, cycle: 0, direction: "in" });
    setShowLine(false);

    const firstLineDelay = (delay + 1.08 + (rhythmSeed % 7) * 0.06) * 1000;

    const scheduleNextLine = () => {
      const holdMs = getLineHoldMs(rhythmSeed, index, cycle);

      addTimer(() => {
        setLineState({ index, cycle, direction: "out" });

        addTimer(() => {
          index = (index + 1) % lines.length;
          cycle += 1;
          setLineState({ index, cycle, direction: "in" });
          scheduleNextLine();
        }, getScatterDurationMs(rhythmSeed, index, cycle));
      }, holdMs);
    };

    addTimer(() => {
      setShowLine(true);
      scheduleNextLine();
    }, firstLineDelay);

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [delay, lines.length, rhythmSeed]);

  const lineDuration = getBuildDurationMs(rhythmSeed, lineState.index, lineState.cycle);
  const lineText = lines[lineState.index];

  return (
    <figure className={`ls-photo ${className}`} style={{ "--photo-delay": `${delay}s` }}>
      <img src={image} alt={alt} />
      <figcaption className="ls-photo-caption">
        <ScrambleText
          className="ls-photo-label"
          text={label}
          delay={delay + 0.45 + (rhythmSeed % 5) * 0.05}
          duration={760 + (rhythmSeed % 4) * 180}
          seed={rhythmSeed}
        />
        <strong className="ls-photo-lines">
          {showLine ? (
            <ScrambleText
              key={`${className}-${lineState.index}-${lineState.cycle}-${lineState.direction}`}
              className="ls-photo-line"
              text={lineText}
              duration={lineState.direction === "out" ? getScatterDurationMs(rhythmSeed, lineState.index, lineState.cycle) : lineDuration}
              seed={rhythmSeed + lineState.index * 19 + lineState.cycle * 31}
              direction={lineState.direction}
            />
          ) : null}
        </strong>
      </figcaption>
    </figure>
  );
}

function Hero({ config }) {
  return (
    <section className="ls-hero">
      <div className="ls-hero-grid" aria-hidden="true" />
      <div className="ls-shell ls-hero-canvas">
        <PhotoCard
          className="ls-photo-founder"
          image={config.images.founder}
          alt="Опыт в бизнес-процессах"
          label="Опыт"
          lines={[
            "Бизнес-процессы",
            "Учет и заявки",
            "Склады и остатки",
            "Регламенты",
            "Ответственность",
          ]}
          delay={0.08}
          rhythmSeed={13}
        />

        <PhotoCard
          className="ls-photo-next"
          image={config.images.nextGen}
          alt="Новый взгляд на современные технологии"
          label="Новый взгляд"
          lines={[
            "Современные интерфейсы",
            "Архитектура",
            "AI и автоматизация",
            "Быстрые прототипы",
            "Чистый код",
          ]}
          delay={0.22}
          rhythmSeed={31}
        />

        <div className="ls-hero-title">
          <h1>Автоматизируем ежедневные процессы бизнеса</h1>
        </div>

        <div className="ls-hero-brief">
          <p>
            Создаем CRM, WMS, личные кабинеты, сервисные платформы, интернет-магазины и интеграции.
            Соединяем опыт в бизнес-процессах с новым взглядом на современные технологии.
          </p>
          <div className="ls-actions">
            <a className="ls-button ls-button-primary" href={config.urls.contact}>
              <ArrowRight size={18} aria-hidden="true" />
              Обсудить задачу
            </a>
            <a className="ls-button" href={config.urls.industrial}>
              <Archive size={18} aria-hidden="true" />
              Оцифровка
            </a>
            <a className="ls-button" href={config.urls.cabinet}>
              <LogIn size={18} aria-hidden="true" />
              {config.cabinetLabel}
            </a>
          </div>
        </div>
      </div>

      <div className="ls-shell ls-tags" aria-label="Направления">
        <span>CRM</span>
        <span>WMS</span>
        <span>Фулфилмент</span>
        <span>B2B-порталы</span>
        <span>Интеграции</span>
        <span>OCR</span>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="about" className="ls-section ls-shell">
      <SectionTitle
        kicker="Как работаем"
        title="От задачи до работающей системы"
        text="Сначала разбираем процесс, потом запускаем первый полезный релиз и развиваем его."
      />
      <div className="ls-grid-cards ls-grid-cards-three">
        {processItems.map((item, index) => (
          <article
            key={item.number}
            className="ls-reveal"
            style={{ "--reveal-delay": `${0.08 + index * 0.08}s` }}
          >
            <span>{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Projects({ images }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const motionRef = useRef({
    offset: 0,
    loopWidth: 0,
    lastTime: 0,
    rafId: 0,
    isDragging: false,
    pointerId: null,
    startX: 0,
    lastX: 0,
    moved: false,
    resumeAt: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const projectLoop = [...projects, ...projects];

  const applyProjectPosition = useCallback(() => {
    const state = motionRef.current;
    const track = trackRef.current;

    if (!track) {
      return;
    }

    if (state.loopWidth > 0) {
      state.offset = ((state.offset % state.loopWidth) + state.loopWidth) % state.loopWidth;
    }

    track.style.transform = `translate3d(${-state.offset}px, 0, 0)`;
  }, []);

  useEffect(() => {
    const state = motionRef.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const measure = () => {
      const track = trackRef.current;

      if (!track) {
        return;
      }

      state.loopWidth = track.scrollWidth / 2;
      applyProjectPosition();
    };

    const tick = (time) => {
      if (!state.lastTime) {
        state.lastTime = time;
      }

      const delta = Math.min(time - state.lastTime, 40);
      state.lastTime = time;

      if (
        !prefersReducedMotion.matches &&
        !state.isDragging &&
        state.pointerId === null &&
        time >= state.resumeAt &&
        state.loopWidth > 0
      ) {
        state.offset += (state.loopWidth / 38000) * delta;
      }

      applyProjectPosition();
      state.rafId = window.requestAnimationFrame(tick);
    };

    measure();
    window.addEventListener("resize", measure);
    state.rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(state.rafId);
    };
  }, [applyProjectPosition]);

  const handleProjectPointerDown = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const state = motionRef.current;

    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.lastX = event.clientX;
    state.moved = false;
    state.resumeAt = Number.POSITIVE_INFINITY;
  }, []);

  const handleProjectPointerMove = useCallback(
    (event) => {
      const state = motionRef.current;

      if (state.pointerId !== event.pointerId) {
        return;
      }

      const totalDelta = event.clientX - state.startX;

      if (!state.isDragging && Math.abs(totalDelta) < 10) {
        return;
      }

      if (!state.isDragging) {
        state.isDragging = true;
        state.moved = true;
        setIsDragging(true);
        viewportRef.current?.setPointerCapture?.(event.pointerId);
      }

      const dragDelta = event.clientX - state.lastX;
      state.lastX = event.clientX;
      state.offset -= dragDelta;

      applyProjectPosition();
      event.preventDefault();
    },
    [applyProjectPosition],
  );

  const finishProjectDrag = useCallback((event) => {
    const state = motionRef.current;
    const viewport = viewportRef.current;

    if (!state.isDragging || state.pointerId !== event.pointerId) {
      if (state.pointerId === event.pointerId) {
        state.pointerId = null;
        state.resumeAt = window.performance.now() + 250;
      }

      return;
    }

    state.isDragging = false;
    state.pointerId = null;
    state.resumeAt = window.performance.now() + 1200;
    setIsDragging(false);
    viewport?.releasePointerCapture?.(event.pointerId);
  }, []);

  const handleProjectClickCapture = useCallback((event) => {
    const state = motionRef.current;

    if (!state.moved) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => {
      state.moved = false;
    }, 0);
  }, []);

  return (
    <section id="cases" className="ls-section ls-shell">
      <SectionTitle
        kicker="Проекты"
        title="Работы, которые можно открыть"
        text="Не концепты и не красивые картинки, а реальные сайты с понятной задачей."
      />
      <div className="ls-projects-reveal ls-reveal" style={{ "--reveal-delay": "0.12s" }}>
        <div
          ref={viewportRef}
          className={`ls-projects${isDragging ? " is-dragging" : ""}`}
          aria-label="Наши работы"
          onClickCapture={handleProjectClickCapture}
          onPointerCancel={finishProjectDrag}
          onPointerDown={handleProjectPointerDown}
          onPointerMove={handleProjectPointerMove}
          onPointerUp={finishProjectDrag}
        >
          <div ref={trackRef} className="ls-project-track">
            {projectLoop.map((project, index) => (
              <article key={`${project.domain}-${index}`} className="ls-project">
                <a href={project.url} target="_blank" rel="noopener noreferrer">
                  <img src={images[project.image]} alt={`Сайт ${project.title}`} />
                  <span>
                    {project.domain}
                    <ExternalLink size={14} aria-hidden="true" />
                  </span>
                </a>
                <div>
                  <p>{project.type}</p>
                  <h3>{project.title}</h3>
                  <strong>{project.text}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const testimonialLoop = [...testimonials, ...testimonials];

  return (
    <section className="ls-section ls-shell ls-testimonials-section">
      <SectionTitle
        kicker="Отзывы"
        title="Что ценят клиенты"
        text="Коротко о том, что остается после запуска: порядок в процессах, ясные статусы и рабочая система."
      />
      <div className="ls-testimonials ls-reveal" style={{ "--reveal-delay": "0.12s" }}>
        <div className="ls-testimonial-track">
          {testimonialLoop.map((item, index) => (
            <article className="ls-testimonial" key={`${item.role}-${index}`}>
              <p>{item.text}</p>
              <span>{item.role}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="ls-section ls-shell">
      <SectionTitle
        kicker="Услуги"
        title="Системы под реальные операции"
        text="Делаем интерфейсы, где есть данные, роли, статусы, интеграции и развитие после первого релиза."
      />
      <div className="ls-grid-cards">
        {services.map((service, index) => (
          <article
            key={service.number}
            className="ls-reveal"
            style={{ "--reveal-delay": `${0.06 + index * 0.07}s` }}
          >
            <span>{service.number}</span>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section className="ls-section ls-shell">
      <SectionTitle
        kicker="Технологии"
        title="Стек для надежных бизнес-систем"
        text="Frontend, backend, базы данных, очереди, API и интеграции собираются в одну рабочую архитектуру."
      />
      <div className="ls-stack" aria-label="Технологии">
        {stack.map((item, index) => (
          <span
            key={item}
            className="ls-reveal"
            style={{ "--reveal-delay": `${0.04 + index * 0.045}s` }}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function Contact({ config }) {
  return (
    <section id="contact" className="ls-section ls-shell">
      <div className="ls-contact ls-reveal">
        <div>
          <p className="ls-kicker">Контакт</p>
          <h2>Расскажите о задаче — отвечу в тот же день</h2>
          <span>
            Опишите, что сейчас ведется вручную, где теряются данные и какие системы нужно связать.
            Вернемся с понятным первым шагом.
          </span>
        </div>
        <div className="ls-contact-actions">
          <a className="ls-button ls-button-primary" href={config.urls.phone}>
            <Phone size={18} aria-hidden="true" />
            Позвонить
          </a>
          <a className="ls-button" href={config.urls.industrial}>
            <Archive size={18} aria-hidden="true" />
            Промышленная оцифровка
          </a>
          <a className="ls-button" href={config.urls.cabinet}>
            <LogIn size={18} aria-hidden="true" />
            Вход в кабинет
          </a>
        </div>
      </div>
    </section>
  );
}

function HomeApp() {
  const config = readConfig();
  useScrollReveal();

  return (
    <div className="ls-home">
      <Hero config={config} />
      <Projects images={config.images} />
      <Testimonials />
      <Services />
      <Process />
      <Stack />
      <Contact config={config} />
      <a className="ls-floating-contact" href={config.urls.contact} aria-label="Обсудить задачу">
        Обсудить задачу
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

createRoot(document.getElementById("lapin-home-root")).render(<HomeApp />);
