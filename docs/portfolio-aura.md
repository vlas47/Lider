# АУРА — portfolio card

Added to the homepage project carousel on 2026-09-13 at the owner's request.

- Public link: https://aur-a.ru/
- Title: АУРА
- Category: Рекламное агентство
- Preview: `static/img/portfolio-aura-20260913.png`
- Preview source: existing project screenshot
  `C:\Python\1obr\KPI-центр\logo-preview\aura-home-02-ad-agency-logo — копия.png`.
  Copied without visual alterations; not a newly captured production screenshot.
- During implementation the source domain returned HTTP 502 both in the browser
  and in a direct request. Repairing the Aura server is outside this change.

The existing six project cards, carousel behavior and service catalogue are unchanged.

Validation: 21 Django tests and production frontend build pass; homepage config
resolves the real PNG, carousel contains seven distinct projects, and the new
link uses HTTPS with `target="_blank"` and `rel="noopener noreferrer"`.
