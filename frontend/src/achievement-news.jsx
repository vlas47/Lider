import React from "react";
import { ArrowUpRight, Trophy, X } from "lucide-react";

export function AchievementNotice({ image, onOpen }) {
  return (
    <button
      id="team-news"
      className="ls-achievement ls-shell"
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-controls="nikita-hackathon-news"
    >
      <img src={image} alt="Никита Лапин с сертификатом за первое место" width="96" height="72" />
      <span className="ls-achievement-copy">
        <span className="ls-achievement-kicker"><Trophy size={13} aria-hidden="true" /> Победа нашей команды</span>
        <strong>Никита Лапин — 1 место на хакатоне MAX</strong>
        <span className="ls-achievement-meta">Казань · Kazan Digital Week · Приз команде 500 000 ₽</span>
      </span>
      <span className="ls-achievement-link">Читать новость <ArrowUpRight size={21} aria-hidden="true" /></span>
    </button>
  );
}

export function AchievementDialog({ dialogRef, image, originalImage }) {
  return (
    <dialog
      id="nikita-hackathon-news"
      className="ls-news-dialog"
      ref={dialogRef}
      aria-labelledby="nikita-hackathon-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <article className="ls-news-article">
        <form method="dialog" className="ls-news-close-form">
          <button type="submit" className="ls-news-close" aria-label="Закрыть новость" autoFocus>
            <X size={22} aria-hidden="true" />
          </button>
        </form>
        <figure className="ls-news-photo">
          <img
            src={image}
            alt="Никита Лапин на награждении студенческого хакатона MAX с сертификатом на 500 000 рублей за первое место"
            width="1200"
            height="900"
            loading="lazy"
          />
          <figcaption>Казань · Финал хакатона MAX · 29 октября 2026</figcaption>
        </figure>
        <div className="ls-news-body">
          <p className="ls-news-eyebrow">Событие команды <span>·</span> <time dateTime="2026-10-29">29 октября 2026</time></p>
          <h2 id="nikita-hackathon-title">Никита Лапин — победитель хакатона MAX</h2>
          <p className="ls-news-lead">
            Наш разработчик Никита Лапин стал победителем студенческого хакатона по созданию сервисов
            для MAX в составе команды. Финал прошёл 29 октября в Казани в рамках форума Kazan Digital Week.
          </p>
          <div className="ls-news-result">
            <Trophy size={25} aria-hidden="true" />
            <span><strong>1 место</strong><span>Приз команде — 500 000 ₽</span></span>
          </div>
          <p>
            Участники разрабатывали чат-ботов и мини-приложения для реальных задач.
            В финал отбирали 40 лучших проектов, а жюри оценивало техническое качество,
            пользу и потенциал внедрения решений.
          </p>
          <p>
            Хакатон организовали MAX и Минобрнауки России при поддержке VK Образования,
            РТУ МИРЭА и Kazan Digital Week.
          </p>
          <p className="ls-news-takeaway">
            Гордимся Никитой. Работа с реальными задачами, защита решений перед экспертами
            и командная разработка — опыт, который мы ценим и развиваем в своей работе.
          </p>
          <div className="ls-news-sources">
            <a href="https://new.sgu.ru/news/studentov-priglashayut-na-khakaton-po-sozdaniyu-servisov-dlya-max" target="_blank" rel="noopener noreferrer">
              О конкурсе и призах <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href={originalImage} target="_blank" rel="noopener noreferrer">
              Фото с награждения <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </article>
    </dialog>
  );
}
