# Underwater Labyrinth — module contract

Final product: ONE self-contained `index.html` (< 60 KB, target ~45 KB), vanilla JS + WebGL2 + GLSL ES 3.00,
no external assets/libraries/textures/fonts. A build step concatenates these files into one classic `<script>`
in this order: `src/geo.js`, `src/atmo.js`, `src/life.js`, `src/ctrl.js`, `src/main.js`. `src/ui.html` goes in `<body>` before it.
All top-level names are therefore shared globals. **Read `src/main.js` first** — it is the host and is authoritative.

## Rendering architecture
1. **Scene pass** — fullscreen raymarch of the SDF world (rock, ruins, sand, water surface, sky) into a
   reduced-resolution RGBA16F target. Output `o = vec4(linearHDRcolor, t)`; `t` = distance along the ray to the first
   OPAQUE SOLID hit (terrain), or `ZF` if none. The water surface is not a solid.
2. **Post pass** — fullscreen to the canvas: upsamples, tonemaps, screen-space underwater effects, and writes
   `gl_FragDepth = dep(t*dot(rd,uM[2]))` so rasterized life depth-tests against the raymarched world.
3. **Life pass** — instanced rasterized kelp/jellyfish/fish/particles with depth test (LEQUAL) on the canvas.

## World conventions
- Metres, +Y up. Mean water surface at y = 0. Labyrinth roughly inside |x|,|z| < 120, y from -70 to -4; open seabed beyond, forever.
- Camera: `cam = {p:[x,y,z], yaw, pitch}` (owned by ctrl.js). yaw=0,pitch=0 looks down -Z; forward =
  (sin yaw·cos pitch, sin pitch, -cos yaw·cos pitch).
- Quality: global `QL` = 0 (Low) | 1 (Medium) | 2 (High), owned by ctrl.js. Shaders get `#define Q <QL>` (use `#if Q==0` etc. or
  arithmetic on Q for step counts); scene/post programs are recompiled automatically when QL changes. JS reads `QL` directly.
- Global `paused` (boolean, owned by ctrl.js).

## GLSL available to every shader (declared by the host header — do NOT redeclare)
`uniform float uT` (seconds), `uniform vec2 uR` (current target size px), `uniform vec3 uP` (camera pos),
`uniform mat3 uM` (columns right, up, forward), `uniform sampler2D uS`;
consts `F` (tan half-fov), `ZN`, `ZF`, `SUN` (unit vector toward the sun);
`h1(float)`, `h2(vec2)`, `h3(vec3)` hashes → [0,1); `n3(vec3)` value noise; `fbm(vec3)` 4 octaves (~0..1);
`mat2 rot(float)`; `vec3 ray(vec2 uv01)` world ray dir; `vec4 proj(vec3 world)` clip-space position;
`float dep(float viewZ)` → depth-buffer value.
Fragment stage has `out vec4 o;`. Fullscreen passes also get `in vec2 v;` (0..1 uv).
The header + GEO + ATMO are prepended to BOTH vertex and fragment stages of every program made with `P(vs,fs)`,
so GEO and ATMO must compile in a vertex shader too (no dFdx/fwidth/discard/gl_FragCoord, no `o`).

## Module deliverables

### src/geo.js (Geometry & Labyrinth)
- `const GEO = /*glsl*/\`...\`` defining:
  - `float map(vec3 p)` — signed distance to solid (positive in open water/air). Should be a reasonably Lipschitz SDF.
  - `vec3 glow(vec3 p)` — CHEAP coloured light at p from bioluminescent grotto/landmark lights (HDR, 0 far away). Called many times per pixel.
  - `void surf(vec3 p, vec3 n, out vec3 alb, out vec3 emi)` — albedo and emissive (bioluminescent veins, glowing moss, runes…) at a surface point.
- `function sdf(x,y,z)` — JS mirror of `map` for collision/placement. Must match the GLSL to within ~0.3 m. To make that possible,
  build the large-scale shape ONLY from analytic math (sin/cos warps, smooth min/max, primitives, domain repetition); hash-based noise
  may only add sub-0.3 m surface detail in GLSL and is omitted from the mirror.
- `const LM = [[x,y,z, r,g,b, 'Name'], ...]` — 5–8 landmarks (grottoes, shafts, arches) with their light colour.
- `const SPAWN = [x,y,z,yaw]` — start in open water (~y=-6) with a good view of the labyrinth entrance.

### src/atmo.js (Shaders & Atmosphere)
- `const ATMO = /*glsl*/\`...\`` defining at least:
  - `float wave(vec2 xz)` — animated water surface height (uses uT), amplitude ≲ 0.5 m.
  - `vec3 lit(vec3 p)` — light colour arriving at an underwater point: depth-attenuated sun × animated caustics + ambient + `glow(p)`. Cheap.
  - `vec3 fog(vec3 col, vec3 p)` — apply depth-based exponential water fog/absorption + in-scatter between camera `uP` and world point `p` (camera underwater).
  - `vec3 tone(vec3 c)` — HDR linear → display (tonemap + gamma).
- `const SCENE = /*glsl*/\`...void main(){...}\`` and `const POST = /*glsl*/\`...void main(){...}\`` (see architecture above).
  Must handle camera underwater (Snell's window, total internal reflection, god rays, caustics, fog) AND above water
  (procedural sky + sun, reflective/refractive animated ocean, seeing into the depths), including above-water rock.
- `function waveH(x,z,t)` — JS mirror of `wave` (exact; analytic sines only).

### src/life.js (Flora, Fauna & Animation)
- `function lifeInit()` — called once; uses globals `gl`, `P`, `U`, `sdf`, `QL`.
- `function lifeDraw(t, dt)` — called every frame after the post pass with: default framebuffer bound, viewport set,
  depth test ON (LEQUAL), depth mask ON, blend OFF. Call `U(prog)` to bind a program and set shared uniforms.
  You own your VAOs/buffers. On return: blend OFF, depthMask true, depth test ON.
  Skip drawing when the camera is above the water (`cam.p[1] > waveH(cam.p[0],cam.p[2],t)`).
- Fragment shaders must use `lit()`, `fog()`, `tone()` so life matches the raymarched scene exactly.

### src/ctrl.js + src/ui.html (Physics, Controls, Audio, HUD)
- `src/ui.html`: `<style>` + markup: `<canvas id=c>` filling the window, glassmorphic HUD, pause/quality menu.
- `let QL`, `let paused`, `const cam`, `function ctrlInit(canvas)`, `function ctrlStep(dt, t)` (called every frame, even when paused).
  Uses `sdf`, `waveH`, `LM`, `SPAWN`.

## Rules for everyone
- Write ONLY your own file(s). Do not edit main.js, CONTRACT.md or other modules. Do not open a browser or start servers
  (the integrator does all runtime testing); do run `node --check` on your JS.
- GLSL lives only in backtick template literals that start with `/*glsl*/` and contain NO `${}` interpolation and no backticks
  (the build minifies them). Use `//` or `/* */` comments freely — they are stripped.
- The JS will be minified with terser (toplevel mangling), GLSL only whitespace-stripped: keep GLSL identifiers short (1–3 chars for
  locals/helpers), avoid dead code, reuse functions. Prefix your private GLSL helper names with your module letter to avoid
  collisions: geo `g…`, atmo `a…`, life `l…`. Private JS globals may be any name not listed in this contract.
- GLSL ES 3.00 strictness: float literals need a dot (`1.` not `1`), no implicit int↔float conversion, loops need constant bounds,
  no recursion, `const` initialisers must be constant expressions. Be meticulous — you cannot compile-test.
- Stay inside your byte budget (source after comment/whitespace stripping): geo 6 KB, atmo 12 KB, life 11 KB, ctrl+ui 12 KB.
- Performance target: 120+ FPS on a desktop GPU at High, playable on integrated GPUs at Low.
