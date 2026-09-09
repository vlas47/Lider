# Website services redesign — 2026-09-09

## Scope and reference

The source is the Aura website section, `https://aur-a.ru/catalog/websites/`,
from the KPI-центр project. Preserved: eight service types, preview navigation,
catalogue → service → enquiry flow, hero image, description, included work and
an enquiry form. The new art direction follows the owner's additional request:
asymmetric portrait/landscape cards, warm light surfaces, people and business
scenarios instead of cropped screenshots of existing portfolio sites.

The images are AI-generated conceptual illustrations, not claims about
actual customers or completed projects. At the owner's request, six service
images feature the owner and/or his son using their homepage portraits as
identity references. Eleven team scenes were produced in total, with varied
customers and contexts. The personal-site scene uses the corrected version
in which the owner looks at the laptop, not the customer.

Prompts and original output paths are in `website-images.json` and
`website-team-images.json`. Team production assets are
`static/img/team-scenes/*-v3.webp` (80–115 kB each); two catalogue/product
illustrations remain from `static/img/services/websites/*-v2.webp`.
The optional `scripts/prepare_website_images.py` helper requires Pillow.

## Local browser checks

- Visually inspected the complete desktop page for each of the eight services
  at 1180 px; every service hero at 390 px; the complete support form and
  confirmation on mobile; catalogues at 360, 390, 768 and 1180 px.
- Inspected tablet corporate and web-service pages, including the longest
  heading, images, form and related-service previews.
- Ran DOM checks across catalogue + eight services at 360, 390, 768, 1180,
  1440 and 1920 px: **54 states, no horizontal overflow, overflowing checked
  headings/paragraphs/labels/card text, broken loaded images or duplicate h1**.
- Fixed an initially detected corporate-card text overflow at 360 px.
- Checked homepage preview menu, mobile opening, nested Sites menu, Escape
  closing and focus return; four featured images and all eight links present.
- Clicked a catalogue card and the enquiry anchor; checked native required
  fields. Submitted a clearly marked local QA enquiry and verified one saved
  database record and the real confirmation screen. No customer notifications
  or production enquiries were sent.
- Browser error log: empty on the inspected local service page.
- Repeated all 54 DOM states after integrating the final team photos: zero
  detected overflow or broken loaded images. Rechecked the corrected portrait
  in the real service hero and verified the library PNG matches its source hash.

## Automated and deployment checks

- Django page/form tests cover all eight routes, correct images, real storage,
  duplicate protection, one-time confirmation, invalid fields, consent,
  honeypot, CSRF, attachment signatures, upload size and private downloads.
- React production build and npm high-severity audit passed (0 vulnerabilities).
- Django checks and migration drift check passed; `git diff --check` clean.
- Nginx route-specific 12 MiB request limit accommodates the advertised 10 MiB
  attachment and multipart overhead. Config tested before reload; original
  vhost backup retained as `cloud-site.before-websites-20260909`.

## Operational behavior

Enquiries appear in Django admin → **Заявки на сайты**. No email delivery is
configured or claimed. Uploaded briefs are outside public static/media paths,
downloaded only through the permission-checked admin view. Back up both the
Postgres database and `private_uploads/`.

The check is browser-based responsive QA, not a claim that every physical
device/browser combination has been tested.
