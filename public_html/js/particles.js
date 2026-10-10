/*
 * Hero particle engine.
 * Stipples a grayscale "particle map" (images/hero-particles.png) into evenly spaced dots,
 * draws them with WebGL, and dissolves them into drifting smoke as the hero scrolls away.
 * Every particle's position is a pure function of (home, seed, progress, time),
 * so the whole simulation runs in the vertex shader with no per-frame CPU work.
 */
(function () {
  var hero = document.querySelector('.hero');
  var canvas = hero && hero.querySelector('.hero-canvas');
  var slot = hero && hero.querySelector('.hero-figure');
  if (!canvas || !slot) return;

  var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 760px)').matches;
  // Distance between neighbouring particles, in CSS px. Larger = fewer, more distinct dots.
  var SPACING = small ? 2.1 : 2.3;
  var MAP_SRC = canvas.getAttribute('data-map') || 'images/hero-particles.png';

  var VERT = [
    'attribute vec2 aHome;',      // 0..1 within the figure box, y down
    'attribute vec4 aSeed;',      // r1, r2, r3, brightness
    'uniform vec4 uRect;',        // figure box in device px: x, y, w, h
    'uniform vec2 uRes;',
    'uniform float uP;',          // dissolve progress 0..1
    'uniform float uTime;',
    'uniform float uSize;',
    'uniform float uMotion;',
    'varying float vAlpha;',
    'varying float vWarm;',
    'void main() {',
    '  float r1 = aSeed.x, r2 = aSeed.y, r3 = aSeed.z, b = aSeed.w;',
    '  float s = uRect.w;',
    '  vec2 home = uRect.xy + aHome * uRect.zw;',
    // Dissolve order: the body goes first, the face lingers longest.
    '  float d = 0.62 * (0.5 * r1 + 0.5 * (1.0 - aHome.y));',
    '  float t = clamp((uP - d) / 0.38, 0.0, 1.0);',
    '  float e = t * t * (3.0 - 2.0 * t);',
    // Smoke-like flow field plus outward spread and a rising drift.
    '  vec2 q = home / s;',
    '  float tm = uTime * uMotion;',
    '  vec2 flow = vec2(',
    '    sin(q.y * 6.0 + tm * 0.35 + r2 * 6.283) + 0.5 * sin(q.y * 13.0 - tm * 0.5 + r3 * 6.283),',
    '    cos(q.x * 5.0 + tm * 0.30 + r3 * 6.283) + 0.5 * cos(q.x * 11.0 + tm * 0.45 + r1 * 6.283));',
    '  vec2 c = uRect.xy + vec2(0.5, 0.4) * uRect.zw;',
    '  vec2 outward = normalize(home - c + 0.001);',
    '  vec2 disp = flow * 0.22 + outward * (0.18 + 0.35 * r2) + vec2(0.0, -0.45) * (0.4 + r3);',
    '  vec2 pos = home + disp * s * e * (0.5 + r1) * uMotion;',
    // Idle hover: each particle floats on its own slow, small loop (about 1-2 CSS px),
    // mixing two speeds so the motion never looks mechanical.
    '  vec2 hover = vec2(',
    '    sin(tm * (0.5 + 0.4 * r3) + r1 * 40.0) + 0.4 * sin(tm * 1.3 + r2 * 23.0),',
    '    cos(tm * (0.45 + 0.4 * r1) + r2 * 40.0) + 0.4 * cos(tm * 1.1 + r3 * 31.0));',
    '  pos += hover * 0.45 * uSize * uMotion;',
    '  vec2 clip = pos / uRes * 2.0 - 1.0;',
    '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
    '  gl_PointSize = max(uSize * (0.4 + 0.5 * sqrt(b)) * (0.85 + 0.2 * r3) * (1.0 + 0.6 * e), 1.5);',
    '  float twinkle = 0.88 + 0.12 * sin(uTime * 1.7 + r3 * 60.0);',
    '  vAlpha = (0.45 + 0.55 * b) * pow(1.0 - e, 1.6) * twinkle;',
    '  vWarm = r2;',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying float vAlpha;',
    'varying float vWarm;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float r = length(c);',
    '  if (r > 0.5) discard;',
    '  float a = vAlpha * smoothstep(0.5, 0.32, r);',
    // Site text colour, with a few particles tinted toward the gold accent.
    '  vec3 col = mix(vec3(0.93, 0.91, 0.87), vec3(0.79, 0.71, 0.54), step(0.9, vWarm));',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    if (window.console) console.warn('Hero particles disabled:', err);
    return;
  }
  gl.useProgram(prog);

  var U = {};
  ['uRect', 'uRes', 'uP', 'uTime', 'uSize', 'uMotion'].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  // Stipple the map on a jittered grid: one candidate dot per cell, kept with a
  // probability that rises with brightness. Even spacing (no clumps) is what makes
  // it read as separate particles rather than photo grain.
  function sample(img, cell) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var px = ctx.getImageData(0, 0, w, h).data;

    var cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    var home = new Float32Array(cols * rows * 2);
    var seed = new Float32Array(cols * rows * 4);
    var n = 0;
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var x = (gx + 0.5 + (Math.random() - 0.5) * 0.7) * cell;
        var y = (gy + 0.5 + (Math.random() - 0.5) * 0.7) * cell;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        var v = px[((y | 0) * w + (x | 0)) * 4] / 255;
        if (v < 0.02 || Math.random() > Math.min(1, Math.pow(v / 0.55, 1.4))) continue;
        home[n * 2] = x / w;
        home[n * 2 + 1] = y / h;
        seed[n * 4] = Math.random();
        seed[n * 4 + 1] = Math.random();
        seed[n * 4 + 2] = Math.random();
        seed[n * 4 + 3] = v;
        n++;
      }
    }
    return { home: home, seed: seed, count: n, aspect: w / h, cell: cell, mapH: h };
  }

  // Figure box (CSS px, relative to the canvas): fit inside the slot, anchored to the
  // bottom like a bust cut by the frame.
  function fit(aspect) {
    var cr = canvas.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    var h = sr.height, w = h * aspect;
    if (w > sr.width) { w = sr.width; h = w / aspect; }
    return { x: sr.left - cr.left + (sr.width - w) / 2, y: sr.top - cr.top + (sr.height - h), w: w, h: h };
  }

  function attrib(name, data, size) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  var data, dpr = 1, rect = [0, 0, 0, 0];
  // target: raw scroll position through the hero (0..1).
  // shown: what is drawn. It chases target with a critically damped spring and a
  // speed cap, so a big flick plays out at a steady pace and small scrolls glide
  // instead of stepping.
  var target = 0, shown = 0, vel = 0, last = 0;
  var SPRING = 4.5;      // higher = follows the scroll more tightly
  var MAX_SPEED = 0.9;   // max progress per second (full dissolve takes >= ~1.1s)
  var start = 0, running = false, visible = true;
  var INTRO_MS = reduceMotion ? 1 : 2600;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    var f = fit(data.aspect);
    rect = [f.x * dpr, f.y * dpr, f.w * dpr, f.h * dpr];

    gl.uniform4f(U.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    // uSize = dot spacing in device px; it scales with the figure on resize.
    gl.uniform1f(U.uSize, data.cell * rect[3] / data.mapH);
  }

  function readScroll() {
    var r = hero.getBoundingClientRect();
    var travel = Math.max(r.height - window.innerHeight, 1);
    target = Math.min(Math.max(-r.top / travel, 0), 1);
  }

  function follow(dt) {
    if (reduceMotion) { shown = target; vel = 0; return; }
    var acc = SPRING * SPRING * (target - shown) - 2 * SPRING * vel;
    vel += acc * dt;
    vel = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vel));
    shown += vel * dt;
    if (Math.abs(target - shown) < 1e-4 && Math.abs(vel) < 1e-3) { shown = target; vel = 0; }
    shown = Math.min(Math.max(shown, 0), 1);
  }

  function frame(now) {
    if (!running) return;
    var intro = Math.min((now - start) / INTRO_MS, 1);
    var introP = 1 - (1 - Math.pow(1 - intro, 3)); // ease-out: smoke condenses into the figure
    var dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    follow(dt);
    hero.style.setProperty('--p', shown.toFixed(4));
    var p = Math.max(shown, introP);

    gl.uniform1f(U.uP, p);
    gl.uniform1f(U.uTime, now / 1000);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, data.count);

    // Sleep once the figure is fully gone or off screen; scroll wakes it again.
    var settled = shown === target && vel === 0;
    if ((shown >= 1 && settled && intro >= 1) || !visible) { running = false; last = 0; return; }
    requestAnimationFrame(frame);
  }

  function wake() {
    if (running || !data) return;
    running = true;
    requestAnimationFrame(frame);
  }

  var img = new Image();
  img.onload = function () {
    var root = document.documentElement;
    root.classList.add('has-particles'); // the slot only has a size in particle layout
    try {
      var cellMap = SPACING * img.naturalHeight / Math.max(fit(img.naturalWidth / img.naturalHeight).h, 1);
      data = sample(img, Math.max(cellMap, 1.5));
    } catch (err) {
      root.classList.remove('has-particles');
      if (window.console) console.warn('Hero particles disabled:', err);
      return;
    }

    attrib('aHome', data.home, 2);
    attrib('aSeed', data.seed, 4);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform1f(U.uMotion, reduceMotion ? 0 : 1);

    layout();
    readScroll();
    shown = target; // reloading mid-page starts where the reader already is
    start = performance.now();
    wake();

    window.addEventListener('scroll', function () { readScroll(); wake(); }, { passive: true });
    window.addEventListener('resize', function () { layout(); readScroll(); wake(); });
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) wake();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting && !document.hidden;
        if (visible) wake();
      }).observe(hero);
    }
  };
  img.src = MAP_SRC;
})();
