# Sand car transformation

Public route: https://liderscan.ru/demo/motion/sand/

This is an explicitly labelled demonstration concept. The car is the detailed
BMW M4 Competition M Package by SRT Perfomance, distributed under CC BY 4.0.
The credited 3.9 MB web derivative retains its embedded author/license metadata;
the full provenance, checksum and modifications are in `sand/assets/CREDITS.txt`.
The page visibly credits the artist and links to that file. This is an independent
animation demonstration, not an official BMW commission or endorsement.

The loaded model has 179,033 triangles. It is normalized to the stage, given
graphite metallic paint and studio materials, and its optional livery overlay is
omitted at runtime. Its mesh surfaces supply the animated sand samples. Three.js
0.186.1, GLTFLoader and the Meshopt decoder are bundled locally with their MIT
notice; fonts reuse the existing licensed Motion assets. No CDN or analytics is used.

## Experience

One deterministic 24-second timeline controls the full sequence:

1. The intact car drives to the left stopping point.
2. A granular front-to-rear dissolve removes the real model while surface samples
   follow falling paths into a three-dimensional pile.
3. The pile holds, then its grains move in a low wave to the right stopping point.
4. The grains rise and reconstruct the sampled car while the solid model reappears.
5. The restored car drives forward and holds its final pose for inspection.

Desktop uses 145,000 GPU-animated sand grains; mobile uses 52,000, a lower pixel
ratio and a 30 fps limit. Scene meshes and shadow depth materials use the same
dissolve, so an invisible intact car is not left casting a shadow. Particle
shadows are represented with a separate soft contact shadow.

Playback runs once after loading. Replay, pause, named phases and a keyboard-
accessible timeline allow inspecting any instant. Dragging the scene changes the
camera angle. Reduced-motion visitors start paused; hidden tabs suspend playback.
Unsupported or lost WebGL contexts show a clear explanation.

## Source and deployment

Source: `demos/motion/sand/`. The original Signal demo remains at its existing URL
and links to this additional experiment in its header. The existing atomic Motion
release helper includes this subdirectory in the same independently deployed
static release. A nested Nginx location permits local blob texture URLs and the
bundled WebAssembly decoder only for this scene. The original Signal page keeps
its previous policy. No application service is added.

Local preview: `python -m http.server 8847 --bind 127.0.0.1 --directory demos/motion`

Checks: JavaScript syntax, browser scene readiness, model/dissolve/pile/rebuild/
departure, timeline controls, camera drag, 390 px responsive layout, and public
asset checksums after deployment. Required repository CI runs before merge.
