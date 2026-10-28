# Dune car transformation

Public route: https://liderscan.ru/demo/motion/sand/

The scene fills the viewport, with no visible text, buttons or timeline. A BMW M4
drives over a dune, crosses a spatial boundary and gradually becomes sand. The
sand accumulates into a travelling, irregular mass larger than the car. Its lobes
shift, its surface ripples, and seven small granular vortices lift and return
grains. At the second boundary the mass shrinks while the moving car reappears.

BMW M4 Competition M Package by SRT Perfomance, CC BY 4.0, 179,033 triangles.
The credited 3.9 MB web derivative and embedded metadata are preserved unchanged.
Provenance, checksum and runtime modifications: `sand/assets/CREDITS.txt`.
Credit remains in HTML metadata, the accessible description and linked credit
file. This independent animation demo implies no BMW endorsement.
Three.js 0.186.1, GLTFLoader and Meshopt decoder are bundled with MIT notices.
No CDN, analytics, new runtime service or external asset request is used.

## Experience

One deterministic 28-second loop controls the car, heap and particles:

1. Four independent wheel assemblies roll over the dune. Rotation follows terrain
   arc length; chassis pitch/roll and suspension offsets maintain road contact.
2. Surface samples detach at the first spatial plane, including wheel rotation.
3. Sand accumulates continuously in a lobed, rippling mass, then rolls to the exit.
4. Seven small granular vortices lift grains and return them to the larger mass.
5. The heap shrinks while surface samples rejoin the moving car at the exit plane.

Desktop uses 105,000 samples per falling/rising layer, 14,000 surface-flow grains
and 28,000 vortex grains. Small screens use 38,000, 5,000 and 9,000 respectively,
a lower pixel ratio and a 30 fps limit. CPU terrain queries, the GPU surface,
normals and shadow depth share the evolving heightfield. Airborne grains are a
visual animation, not a physical granular-fluid simulation.

Click or Space pauses; arrows step one second and Shift+arrows five.
Home/End seek the ends. Drag changes the camera, the wheel zooms, double click
resets the view. Reduced-motion visitors start paused. Hidden tabs suspend
advancement. A current scene poster appears if WebGL is unavailable or lost.

## Source and deployment

Source: `demos/motion/sand/`. The original Signal demo remains at its existing URL
and links to this additional experiment in its header. The existing atomic Motion
release helper includes this subdirectory in the same independently deployed
static release. A nested Nginx location permits local blob texture URLs and the
bundled WebAssembly decoder only for this scene. The original Signal page keeps
its previous policy. No application service is added.

Local preview: `python -m http.server 8847 --bind 127.0.0.1 --directory demos/motion`

Node tests in `tests/sand-dune-motion.test.mjs` verify wheel contact, rolling
distance, spatial particle events, smooth heap transitions and its bounds/size.
They also run in required repository CI. Browser checks cover drive, accumulation,
rolling, reassembly, keyboard controls, mobile layout and console errors.
Public asset checksums are verified after the atomic static deployment.
