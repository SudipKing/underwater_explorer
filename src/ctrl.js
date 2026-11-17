// CTRL: physics, controls, procedural audio, HUD. Exposes QL, paused, cam, ctrlInit, ctrlStep.
// Everything else is block-scoped so it cannot collide with other modules' globals.
let QL = 1, paused = true, ctrlInit, ctrlStep;
const cam = { p: [0, 0, 0], v: [0, 0, 0], yaw: 0, pitch: 0, sub: 1 };
{
  const { sin, cos, min, max, abs, hypot, exp, ceil, random: rnd } = Math,
    K = {}, E = {}, p = cam.p, v = cam.v, fnd = [], R = .6, G = 9.8,
    clamp = (x, a, b) => min(b, max(a, x)),
    k = (...a) => a.some(c => K[c]) | 0,
    on = (o, e, f) => o.addEventListener(e, f);
  let cv, ya = 0, pi = 0, yv = 0, mute = 0, und = 1, fl = 0, fv = 0, ha = 1, pt = 0, fps = 60, lt = 0, tt = 0, nf = 0, bc = 0, tx0, ty0,
    ac, nb, mg, uw, aw, dl, dgn, ngn, wg, wf, sg, pg, pn, os, po;

  // ---------- audio ----------
  const st = (q, x, c) => q.setTargetAtTime(x, ac.currentTime, c || .1),
    gn = (g, to) => { let n = ac.createGain(); n.gain.value = g; n.connect(to); return n },
    bq = (ty, f, q, to) => { let n = ac.createBiquadFilter(); n.type = ty; n.frequency.value = f; n.Q.value = q; n.connect(to); return n },
    osc = (ty, f, to, w) => { let o = ac.createOscillator(); o.type = ty; o.frequency.value = f; o.connect(to); o.start(w || 0); return o },
    nz = (to, w, d) => { let s = ac.createBufferSource(); s.buffer = nb; s.loop = true; s.connect(to); s.start(w || 0, rnd()); d && s.stop(w + d); return s },
    env = (g, x, w, d) => { g.setValueAtTime(0, w); g.linearRampToValueAtTime(x, w + .008); g.exponentialRampToValueAtTime(1e-4, w + d) },
    // sine blip with exponential pitch glide f->f2 and decay d
    bl = (f, f2, d, x, w, to) => {
      let g = gn(0, to), o = osc('sine', f, g, w);
      o.frequency.setValueAtTime(f, w); o.frequency.exponentialRampToValueAtTime(f2, w + d);
      env(g.gain, x, w, d); o.stop(w + d + .05)
    },
    // bubble
    bb = (d, x) => { if (ac) { let f = 400 + rnd() * 1400; bl(f, f * (1.4 + rnd()), .05 + rnd() * .09, x, ac.currentTime + d, uw) } },
    // splash: s = vertical speed, o = 1 breaching out / 0 diving in. Also crossfades the underwater/air buses.
    spl = (s, o) => {
      if (ac) {
        let T = ac.currentTime, d = o ? .35 : .7, g = gn(0, mg), f = bq('bandpass', 9, .8, g);
        f.frequency.setValueAtTime(o ? 500 : 2600, T); f.frequency.exponentialRampToValueAtTime(o ? 3200 : 260, T + d);
        env(g.gain, min(1, .05 + s * .16), T, d); nz(f, T, d);
        st(uw.gain, 1 - o, .03); st(aw.gain, o, .03);
        if (!o) for (T = 5 + s * 2; T-- > 0;)bb(.08 + rnd() * .7, .03 + rnd() * .05)
      }
    },
    vol = () => ac && st(mg.gain, mute ? 0 : paused ? .2 : .8, .05),
    au = () => {
      if (ac) return ac.resume();
      let A = window.AudioContext || window.webkitAudioContext, d, i;
      if (!A) return;
      ac = new A; nb = ac.createBuffer(1, i = 2 * ac.sampleRate, ac.sampleRate);
      for (d = nb.getChannelData(0); i--;)d[i] = rnd() * 2 - 1;
      mg = gn(0, ac.destination); uw = gn(und, mg); aw = gn(1 - und, mg);
      dl = bq('lowpass', 500, .7, uw); dgn = gn(.08, dl);
      os = [55, 55.7, 82.9].map((f, i) => osc(i & 1 ? 'triangle' : 'sine', f, dgn));
      ngn = gn(1, dl); wg = gn(0, mg); wf = bq('bandpass', 400, .8, wg); sg = gn(.15, aw);
      d = nz(bq('lowpass', 160, .5, ngn)); d.connect(wf); d.connect(bq('bandpass', 800, .4, sg));
      pn = ac.createStereoPanner ? ac.createStereoPanner() : gn(1, uw); pn.connect(uw);
      pg = gn(0, pn); po = [1, 1.503].map(m => osc('triangle', 440 * m, pg))
    },

    // ---------- state / menu ----------
    sv = () => { try { localStorage.ul = QL + '' + mute } catch (e) { } },
    sq = q => { QL = q; [0, 1, 2].map(i => E['q' + i].className = i == q ? 'a' : ''); sv() },
    sm = m => { mute = m; E.mu.textContent = 'Sound: ' + (m ? 'off' : 'on'); vol(); sv() },
    lk = () => { try { cv.requestPointerLock()?.catch(e => 0) } catch (e) { } },
    ps = () => {
      paused = true; E.mn.style.display = ''; E.kc.style.opacity = 1; pt = 0; for (let i in K) K[i] = 0; vol();
      document.exitPointerLock?.()
    },
    rs = () => { paused = false; E.mn.style.display = 'none'; E.go.textContent = 'RESUME'; document.activeElement?.blur(); au(); vol(); lk() },
    // HUD text (10 Hz)
    hu = t => {
      let d = p[1] - waveH(p[0], p[2], t), a = (ya * 57.2958 % 360 + 360) % 360;
      E.dv.textContent = d > 0 ? 'SURFACE +' + d.toFixed(1) + ' m' : (-d).toFixed(1) + ' m';
      E.dm.style.top = clamp(-d / .7, 0, 100) + '%';
      E.hv.textContent = 'N NE E SE S SW W NW'.split(' ')[a / 45 + .5 & 7] + ' ' + (a | 0) + '\xb0';
      E.fp.textContent = (fps + .5 | 0) + ' fps'
    };

  ctrlInit = c => {
    cv = c;
    'fl dv dm hv fp ts kc mn q0 q1 q2 mu go mk'.split(' ').map(i => E[i] = document.getElementById(i));
    for (let i = 3; i--;)p[i] = SPAWN[i];
    cam.yaw = ya = SPAWN[3] || 0;
    cam.sub = und = p[1] < waveH(p[0], p[2], 0) | 0;
    try { let s = localStorage.ul; if (s) QL = +s[0] % 3 || 0, mute = +s[1] ? 1 : 0 } catch (e) { }
    sq(QL); sm(mute); E.mk.innerHTML = E.kc.innerHTML; hu(0);
    on(window, 'keydown', e => {
      let c = e.code;
      /Arrow|Space/.test(c) && e.preventDefault();
      if (e.repeat) return;
      K[c] = 1;
      c == 'Escape' ? ps() : c == 'Enter' && paused ? rs() : c == 'KeyM' ? sm(1 - mute) : /Digit[123]/.test(c) && sq(c[5] - 1)
    });
    on(window, 'keyup', e => K[e.code] = 0);
    on(window, 'blur', e => { for (let i in K) K[i] = 0 });
    on(window, 'mousemove', e => {
      if (!paused && (document.pointerLockElement == cv || e.buttons & 1))
        ya += e.movementX * .0022, pi = clamp(pi - e.movementY * .0022, -1.535, 1.535)
    });
    on(document, 'pointerlockchange', e => document.pointerLockElement == cv || paused || ps());
    on(document, 'visibilitychange', e => document.hidden && ps());
    on(cv, 'click', e => paused || lk());
    // touch: one finger drag = look, two fingers = swim forward
    on(cv, 'touchstart', e => tx0 = 1 / 0);
    on(cv, 'touchmove', e => {
      let a = e.touches[0], x = a.clientX, y = a.clientY;
      if (tx0 < 1 / 0) ya += (x - tx0) * .005, pi = clamp(pi - (y - ty0) * .005, -1.535, 1.535);
      tx0 = x; ty0 = y; K.KeyW = e.touches.length > 1
    });
    on(cv, 'touchend', e => { tx0 = 1 / 0; K.KeyW = 0 });
    [0, 1, 2].map(i => on(E['q' + i], 'click', e => sq(i)));
    on(E.mu, 'click', e => sm(1 - mute));
    on(E.go, 'click', rs)
  };

  ctrlStep = (dt, t) => {
    let T = performance.now(), i, j;
    fps += (1e3 / max(T - lt, 1) - fps) * .05; lt = T;
    if (paused) return;
    let cy = cos(ya), sy = sin(ya), cp = cos(pi), f = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), s = k('KeyD') - k('KeyA'),
      tx = f * sy * cp + s * cy, ty = f * sin(pi) + k('Space', 'KeyE') - k('ShiftLeft', 'ShiftRight', 'KeyQ'), tz = s * sy - f * cy * cp,
      tm = min(1, hypot(tx, ty, tz)), A = 14.4 / max(1, hypot(tx, ty, tz)),
      n = clamp(ceil(hypot(...v) * dt / .25), 1, 8), h = dt / n, wh, hd, d, imp = 0, spd, bd = 1e9, bi = 0;
    yv += ((k('ArrowRight') - k('ArrowLeft')) * 1.9 - yv) * min(1, dt * 7); ya += yv * dt;
    tx *= A; ty *= A; tz *= A;
    for (i = n; i--;) {
      wh = waveH(p[0], p[2], t); hd = (waveH(p[0], p[2], t + .03) - wh) / .03; d = p[1] - wh; spd = hypot(...v);
      let ax = tx, ay = ty + .1 * sin(t * .4), az = tz, rv = v[1] - hd, fast = abs(rv) > 2.5, dv = ty < -4.3,
        air = d > .5 || d > 0 && fast, dr = 1 + (1.2 + .2 * spd) * (air ? .08 : 1) * h;
      // surface crossing (either direction)
      j = d < 0 | 0;
      if (j != und) und = j, fv = min(.8, .15 + abs(rv) * .1), spl(abs(rv), 1 - j);
      // fl: "floater" latch - set at the surface, cleared by diving on purpose
      fl = d > 0 ? 1 : dv || d < -2 || d < -.25 && tm && ty <= 0 ? 0 : fl;
      if (!dv && (d > -.25 || fl)) {
        // swimmer: ballistic when moving fast vertically (breach / splashdown), else spring-damper to 0.35 m above the wave
        ay = fast || d > .7 ? d > 0 ? -G : 0 : max(-G, min(12, 30 * (.35 - d)) - 8 * rv);
        if (air) ax *= .2, az *= .2
      } else if (d > .35) ay -= G;
      v[0] = (v[0] + ax * h) / dr; v[1] = (v[1] + ay * h) / dr; v[2] = (v[2] + az * h) / dr;
      for (j = 3; j--;)p[j] += v[j] * h;
      // sphere vs SDF: push out along gradient, kill inward velocity
      for (j = 4; j--;) {
        let q = sdf(...p);
        if (!(q < R)) break;
        let g = [0, 1, 2].map(a => { let c = p[a], r; p[a] = c + .05; r = sdf(...p); p[a] = c - .05; r -= sdf(...p); p[a] = c; return r }),
          l = hypot(...g), vn;
        g = l > 1e-6 ? g.map(x => x / l) : [0, 1, 0];
        vn = v[0] * g[0] + v[1] * g[1] + v[2] * g[2]; q = R - q + .001;
        g.map((x, a) => { p[a] += x * q; if (vn < 0) v[a] -= x * vn });
        imp = max(imp, -vn)
      }
    }
    if (!isFinite(p[0] + p[1] + p[2] + v[0] + v[1] + v[2])) for (j = 3; j--;)p[j] = SPAWN[j], v[j] = 0;
    cam.sub += (und - cam.sub) * min(1, dt * 10);
    cam.yaw = ya + .006 * sin(t * .53); cam.pitch = pi + .008 * sin(t * .71);
    if (fv) E.fl.style.opacity = fv = fv < .01 ? 0 : fv * exp(-dt * 5);
    spd = hypot(...v);
    // landmarks: discovery + nearest
    LM.map((l, i) => {
      let q = hypot(l[0] - p[0], l[1] - p[1], l[2] - p[2]), m = 165 / max(l[3], l[4], l[5], .01);
      if (q < bd) bd = q, bi = i;
      if (q < 14 && !fnd[i]) {
        fnd[i] = 1; tt = 4;
        E.ts.textContent = 'Discovered: ' + l[6] + ' \xb7 ' + ++nf + '/' + LM.length;
        E.ts.style.color = `rgb(${l[3] * m + 90},${l[4] * m + 90},${l[5] * m + 90})`;
        E.ts.style.opacity = 1;
        ac && bl(i = 660 + i * 82, i, 1.2, .07, ac.currentTime, mg)
      }
    });
    // bumps + bubbles
    bc -= dt;
    if (imp > 1.2 && bc < 0) {
      bc = .3; ac && bl(95, 38, .3, min(.7, imp * .13), ac.currentTime, mg);
      for (j = 3; j--;)bb(rnd() * .2, .04)
    }
    und && rnd() < dt * (.15 + spd * .5 + tm * .8) && bb(0, .02 + rnd() * .03);
    if (ac) {
      d = max(0, -p[1]); j = LM[bi];
      st(dl.frequency, 110 + 700 * exp(-d / 30));
      os.map(o => st(o.detune, -d * 7));
      st(dgn.gain, (.07 + d * .002) * (1 + .3 * sin(t * .6)));
      st(ngn.gain, 1 + d * .03);
      st(wg.gain, min(.3, tm * .08 + spd * .02)); st(wf.frequency, 300 + spd * 90);
      st(sg.gain, .13 + .07 * sin(t * .8) + .04 * sin(t * 2.3));
      if (j) {
        st(pg.gain, max(0, 1 - bd / 45) ** 2 * .05 * (.7 + .3 * sin(t * 5)));
        po.map((o, a) => st(o.frequency, 330 * (1 + bi / 8) * (a ? 1.503 : 1), .5));
        pn.pan && st(pn.pan, clamp(((j[0] - p[0]) * cy + (j[2] - p[2]) * sy) / max(bd, 1), -1, 1))
      }
    }
    if ((ha += dt) > .1) {
      ha = 0; hu(t);
      if ((pt += .1) > 8) E.kc.style.opacity = .3;
      if (tt > 0 && (tt -= .1) <= 0) E.ts.style.opacity = 0
    }
  }
}
