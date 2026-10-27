# Motion demo: Форма впечатления

- Public URL: https://liderscan.ru/demo/motion/
- Portfolio: first card in the homepage's «Работы, которые можно открыть» carousel.
- Explicitly labelled «Демонстрационный концепт» on both surfaces.
- Canonical source: `demos/motion/` (buildless HTML, CSS, native WebGL JavaScript).
- No external runtime dependencies, trackers, forms or third-party requests.
- Local Manrope and Unbounded fonts include their SIL Open Font licenses.

## Experience

Three scene modes: ray-marched sculpture, GPU particles and an impulse variation.
The laboratory includes a ping-pong wave surface, texture-based WebGL typography,
scroll stretch, intensity control, pause, and optional synthesized stereo audio.
Audio starts only after a click. `prefers-reduced-motion` starts with motion paused.
Graphics stop drawing when paused and pause off screen. Mobile uses fewer particles
and a lower pixel ratio. A CSS fallback remains when WebGL is unavailable.

## Publication

Source is tracked with the corporate website. Demo releases are deployed separately
to `/srv/liderscan-demos/motion/releases/<release>/`, with an atomic `current` symlink.
The existing Nginx HTTPS server includes `/etc/nginx/snippets/liderscan-demo-motion.conf`
copied from `deploy/nginx-motion-demo.conf`. Validate with `nginx -t` before reload.
Keep a backup of the existing Nginx server configuration before adding this include.

The normal `lider-deploy.service` publishes the portfolio React bundle and preview.
Its Git clean excludes existing production data, and the demo releases live outside
the corporate application checkout. Update the demo release explicitly after editing
its source; publishing the portfolio alone does not update `/demo/motion/`.

The local deployment helper uses the existing owner-approved SSH connection without
printing or copying its credentials:

`python deploy/publish-motion-demo.py --ssh-helper C:/Python/Lider/tools/lider_ssh.py --result C:/Python/Lider/output/motion-demo-20261027/deployment.json`

It verifies each uploaded file by checksum, backs up the relevant Nginx and public
corporate source files, checks Nginx, activates the release atomically and verifies
the public HTML. Older releases are retained for rollback.

## Local preview

`python -m http.server 8846 --bind 127.0.0.1 --directory demos/motion`

## Validation

- JavaScript syntax (`node --check demos/motion/app.js`).
- Browser: all three WebGL canvases report ready, scene controls, pause, sound,
  intensity, navigation, desktop and 390 px mobile layout.
- Existing React build and Django `check` / `test pages` before deployment.
- Public page, assets, CSP compatibility and portfolio link after publication.
