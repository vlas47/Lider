# Globe Translate — portfolio card

Added to the homepage "Наши работы" carousel on 2026-09-21 at the owner's request.

- Title: Globe Translate
- Category: Бюро переводов
- Public link: https://globetranslate.ru/
- Description: Сайт бюро переводов с каталогом услуг, переводом документов и онлайн-заявкой.
- Preview: `static/img/portfolio-globetranslate-20260921.jpg` — real viewport screenshot
  captured from the public homepage through the browser on 2026-09-21, unmodified.

The other seven projects, service catalogue and carousel behavior are preserved.
Homepage bundle cache version is bumped to `20260921-globetranslate`.

Validation: 22 Django tests, Django system check and production React build pass.
Browser checks at 360, 390, 768 and 1280 px found eight distinct projects,
no broken loaded previews, no page-level horizontal overflow or overflowing
card text. The new card was also visually inspected in the actual carousel.
