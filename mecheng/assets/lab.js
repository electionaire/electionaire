/* 4MC10 exam trainer: shared helpers (question registry, header, maths, past-exam widget, canvas tools). */
(function () {
  'use strict';

  // One entry per exam slot. "covers" lists the exact past problems each page trains.
  const QS = [
    { title: 'Linear systems', sub: 'Condition number, number of solutions, forward and backward substitution', covers: 'Problem 1 · Nov 2025 · Feb 2025 · Nov 2024', kind: 'Multiple choice · 3 pts', skills: ['cond(A) from eigenvalues or singular values', 'One, none or infinitely many solutions', 'Forward and backward substitution'] },
    { title: 'Stability', sub: 'Stable ODE systems and stability regions of time integrators', covers: 'Nov 2025 P3 · Feb 2025 P2 · Nov 2024 P2', kind: 'Multiple choice · 3 pts', skills: ['Eigenvalues of the system matrix', 'Stable, asymptotically stable, unstable', 'Is hλ inside the stability region?'] },
    { title: 'Time integration in code', sub: 'Explicit or implicit, and which initial-value problem a script solves', covers: 'Feb 2025 P3 · Nov 2024 P3', kind: 'Multiple choice · 3 pts', skills: ['Explicit or implicit from one line of code', 'Rewrite as a difference quotient', 'Read the IVP and initial condition'] },
    { title: 'Big-O and order of accuracy', sub: 'Landau symbols, observed order from data, k + p = q', covers: 'Nov 2025 P2, P4 · Feb 2025 P4 · Nov 2024 P4', kind: 'Multiple choice · 3 pts', skills: ['O and o as limits of ratios', 'Logarithms against powers', 'Order from error tables, k + p = q'] },
    { title: 'Strong, weighted and weak forms', sub: 'Recognise each formulation and check solutions of boundary-value problems', covers: 'Nov 2025 P5 · Feb 2025 P5 · Nov 2024 P10a', kind: 'Multiple choice · 3 pts', skills: ['Strong, weighted residuals, weak, discrete', 'Fingerprint of each formulation', 'Check a candidate BVP solution'] },
    { title: 'Elements and shape functions', sub: 'Lagrange and serendipity families, node counts, which node a shape function belongs to', covers: 'Nov 2025 P7 · Feb 2025 P6 · Nov 2024 P5, P6', kind: 'Multiple choice · 3 pts', skills: ['Lagrange and serendipity node counts', 'Find the node of a shape function', 'Jacobian of a bilinear element'] },
    { title: 'Gauss quadrature', sub: 'Points, weights and exactness in 1D and 2D', covers: 'Nov 2025 P6 · Feb 2025 P7 · Nov 2024 P7', kind: 'Multiple choice · 3 pts', skills: ['Gauss points and weights', 'Exact up to degree 2s − 1', 'Tensor-product rules in 2D'] },
    { title: 'Scalar and vector problems', sub: 'Product rules, contractions and reading finite element code', covers: 'Problem 8 · Nov 2025 · Feb 2025 · Nov 2024', kind: 'Multiple choice · 3 pts', skills: ['Scalar or vector unknown', 'Index notation for product rules', 'Where the normal vector appears'] },
    { title: 'Finite differences', sub: 'Consistency, order of accuracy and Richardson extrapolation', covers: 'Problem 9 · Nov 2025 · Feb 2025 · Nov 2024', kind: 'Open question · 38 pts', skills: ['Taylor-expand and cancel the giants', 'Order of accuracy', 'Richardson extrapolation both ways'] },
    { title: 'Finite elements', sub: 'Boundary conditions, weak form and isoparametric elements', covers: 'Problem 10 · Nov 2025 · Feb 2025 · Nov 2024', kind: 'Open question · 38 pts', skills: ['Essential and natural boundary conditions', 'Derive the weak form step by step', 'Isoparametric map, Jacobian, gradients'] },
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function math(el) {
    if (!el || !window.renderMathInElement) return;
    window.renderMathInElement(el, {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false, strict: false,
    });
  }

  function fmt(v, d = 3) {
    if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (Math.abs(v) < 1e-12) return '0';
    const r = Math.round(v * 10 ** d) / 10 ** d;
    return String(r).replace('-', '−');
  }
  function sci(v, d = 2) {
    if (!isFinite(v)) return '∞';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e5) return fmt(v, a < 1 ? 4 : d);
    const e = Math.floor(Math.log10(a));
    return (v < 0 ? '−' : '') + (a / 10 ** e).toFixed(d) + '×10' + sup(e);
  }
  const sup = e => String(e).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

  // Rational display: 0.6 -> 3/5, with a TeX version.
  function frac(x, maxDen = 96) {
    if (!isFinite(x)) return { txt: x > 0 ? '∞' : '−∞', tex: x > 0 ? '\\infty' : '-\\infty', ok: false };
    if (Math.abs(x) < 1e-10) return { txt: '0', tex: '0', ok: true, num: 0, den: 1 };
    for (let q = 1; q <= maxDen; q++) {
      const p = Math.round(x * q);
      if (Math.abs(x * q - p) < 1e-7 * Math.max(1, Math.abs(p))) {
        const a = Math.abs(p), s = p < 0 ? '-' : '';
        return { ok: true, num: p, den: q, txt: (q === 1 ? String(p) : p + '/' + q).replace('-', '−'), tex: q === 1 ? String(p) : `${s}\\tfrac{${a}}{${q}}` };
      }
    }
    const r = fmt(x, 3);
    return { ok: false, txt: r, tex: r.replace('−', '-') };
  }
  // Linear combination in TeX: [{c, u:'L', b:'\\vec e_1'}] -> "\tfrac{1}{2}\,L\,\vec e_1 + ..."
  function lin(terms, zero = '0') {
    let out = '';
    for (const t of terms) {
      if (Math.abs(t.c) < 1e-10) continue;
      const neg = t.c < 0, a = Math.abs(t.c);
      const one = Math.abs(a - 1) < 1e-10 && (t.u || t.b);
      const mag = one ? '' : frac(a).tex;
      let body = mag;
      if (t.u) body += (body ? '\\,' : '') + t.u;
      if (t.b) body += (body ? '\\,' : '') + t.b;
      out += out ? (neg ? ' - ' : ' + ') + body : (neg ? '-' : '') + body;
    }
    return out || zero;
  }

  function header(n, views) {
    const q = QS[n - 1], prev = QS[n - 2], next = QS[n];
    const top = $('#top');
    top.innerHTML = `
      <a class="qid" href="../" title="All questions">Q${n}</a>
      <div class="ttl"><h1>${q.title}</h1><p>${q.sub}</p></div>
      ${views ? '<div class="views" role="tablist" aria-label="Sections"></div>' : ''}
      <div class="right"><span class="covers">${q.kind} · ${q.covers}</span>
        <nav class="qnav" aria-label="Questions">${prev ? `<a href="../q${n - 1}/">← Q${n - 1}</a>` : ''}<a href="../">All questions</a>${next ? `<a href="../q${n + 1}/">Q${n + 1} →</a>` : ''}</nav>
      </div>`;
    document.title = `Q${n} · ${q.title} · 4MC10`;
    math(document.querySelector('main'));
    return views ? setupViews(top.querySelector('.views'), views) : null;
  }

  function setupViews(bar, views) {
    const secs = {};
    document.querySelectorAll('.view[data-view]').forEach(s => { secs[s.dataset.view] = s; });
    const listeners = [];
    const btns = views.map(v => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = v.label; b.dataset.v = v.id;
      b.addEventListener('click', () => show(v.id, true));
      bar.appendChild(b);
      return b;
    });
    let current = null;
    function show(id, push) {
      if (!secs[id]) id = views[0].id;
      current = id;
      for (const k in secs) secs[k].hidden = k !== id;
      btns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === id)));
      if (push) history.replaceState(null, '', '#' + id);
      listeners.forEach(f => f(id));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    show((location.hash || '').slice(1).split(':')[0] || views[0].id, false);
    return { show, on: f => listeners.push(f), get current() { return current; } };
  }

  // Segmented control: options [{v, label}], returns setter.
  function seg(el, options, value, onChange) {
    el.classList.add('seg');
    el.innerHTML = options.map(o => `<button type="button" data-v="${o.v}">${o.label}</button>`).join('');
    const set = v => {
      value = v;
      el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    };
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { set(b.dataset.v); onChange(b.dataset.v); }));
    set(value);
    return set;
  }

  // Past-exam widget. Items: {label, type:'mc'|'open', q, opts, answer, sol:[...], load} or {type:'open', intro, parts:[{id, pts, q, sol, load}]}
  function exam(el, items) {
    el.innerHTML = '<div class="ex-tabs" role="tablist" aria-label="Past exams"></div><div class="ex-body"></div>';
    const tabs = el.querySelector('.ex-tabs'), body = el.querySelector('.ex-body');
    const btns = items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = it.label;
      b.addEventListener('click', () => show(i));
      tabs.appendChild(b);
      return b;
    });
    const solList = s => `<div class="sol" hidden><ol>${s.map(x => `<li>${x}</li>`).join('')}</ol></div>`;
    function mcHTML(it) {
      return `<p class="ex-meta">${it.meta || 'Multiple choice · +3 right · −1 wrong'}</p>
        <div class="ex-q">${it.q}</div>
        <div class="opts">${it.opts.map((o, k) => `<button type="button" class="opt" data-k="${k}"><span class="l">${'abcd'[k]}</span><span>${o}</span></button>`).join('')}</div>
        <p class="ex-verdict" aria-live="polite"></p>
        <div class="ex-actions"><button type="button" class="js-sol">Show solution</button>${it.load ? '<button type="button" class="js-load">Load in the lab</button>' : ''}</div>
        ${solList(it.sol)}`;
    }
    function openHTML(it) {
      return `${it.intro ? `<div class="ex-q intro">${it.intro}</div>` : ''}<div class="ex-actions"><button type="button" class="js-all">Show all solutions</button></div><div class="parts">${it.parts.map((p, k) => `
        <div class="part"><div class="part-h"><span class="pid">${p.id}</span><span class="pts">${p.pts} pts</span></div>
          <div class="ex-q">${p.q}</div>
          <div class="ex-actions"><button type="button" class="js-sol" data-k="${k}">Show solution</button>${p.load ? `<button type="button" class="js-load" data-k="${k}">Load in the lab</button>` : ''}</div>
          ${solList(p.sol)}</div>`).join('')}</div>`;
    }
    function show(i) {
      btns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
      const it = items[i];
      body.innerHTML = it.type === 'open' ? openHTML(it) : mcHTML(it);
      body.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
        const k = +b.dataset.k, ok = k === it.answer;
        b.classList.add(ok ? 'right' : 'wrong');
        const v = body.querySelector('.ex-verdict');
        v.textContent = ok ? `Correct, it is ${'abcd'[k]}. That earns 3 points.` : `Not ${'abcd'[k]}. In the exam this costs 1 point. Try again or open the solution.`;
        v.className = 'ex-verdict ' + (ok ? 'ok' : 'bad');
        if (ok) toggle(body.querySelector('.sol'), body.querySelector('.js-sol'), true);
      }));
      body.querySelectorAll('.js-sol').forEach(b => b.addEventListener('click', () => {
        const sol = it.type === 'open' ? b.closest('.part').querySelector('.sol') : body.querySelector('.sol');
        toggle(sol, b, sol.hidden);
        if (it.type !== 'open' && !sol.hidden) body.querySelectorAll('.opt')[it.answer].classList.add('right');
      }));
      const all = body.querySelector('.js-all');
      if (all) all.addEventListener('click', () => {
        const open = all.textContent.startsWith('Show');
        body.querySelectorAll('.part').forEach(pt => toggle(pt.querySelector('.sol'), pt.querySelector('.js-sol'), open));
        all.textContent = open ? 'Hide all solutions' : 'Show all solutions';
      });
      body.querySelectorAll('.js-load').forEach(b => b.addEventListener('click', () => {
        const f = it.type === 'open' ? it.parts[+b.dataset.k].load : it.load;
        if (f) f();
      }));
      math(body);
    }
    function toggle(sol, btn, open) { sol.hidden = !open; if (btn) btn.textContent = open ? 'Hide solution' : 'Show solution'; }
    show(0);
    return { show };
  }

  // Canvas with device-pixel-ratio scaling; returns context and CSS size.
  function canvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    return { g, W, H, dpr };
  }
  // Re-run fn when an element resizes, the window resizes, or fonts finish loading.
  function watch(el, fn) {
    let raf = 0;
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fn()); };
    if ('ResizeObserver' in window && el) new ResizeObserver(run).observe(el);
    window.addEventListener('resize', run);
    if (document.fonts) document.fonts.ready.then(run);
    return run;
  }
  // Pointer dragging on a canvas: hit(x, y) -> id or null; move(id, x, y).
  function drag(cv, o) {
    let id = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => {
      const [x, y] = pos(e); id = o.hit(x, y);
      if (id != null) { cv.setPointerCapture(e.pointerId); e.preventDefault(); o.move(id, x, y); }
    });
    cv.addEventListener('pointermove', e => {
      const [x, y] = pos(e);
      if (id != null) o.move(id, x, y);
      else cv.style.cursor = o.hit(x, y) != null ? 'grab' : '';
    });
    const up = () => { if (id != null && o.end) o.end(id); id = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }
  // Marching squares: zero contour of f on [x0,x1]x[y0,y1]; returns segments [ax, ay, bx, by].
  function contour(f, x0, x1, y0, y1, nx, ny) {
    const V = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = f(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny);
    const segs = [], X = i => x0 + (x1 - x0) * i / nx, Y = j => y0 + (y1 - y0) * j / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = V[j * (nx + 1) + i], b = V[j * (nx + 1) + i + 1], c = V[(j + 1) * (nx + 1) + i + 1], d = V[(j + 1) * (nx + 1) + i];
      const pts = [];
      const edge = (va, vb, ax, ay, bx, by) => {
        if ((va > 0) !== (vb > 0)) { const t = va / (va - vb); pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]); }
      };
      edge(a, b, X(i), Y(j), X(i + 1), Y(j));
      edge(b, c, X(i + 1), Y(j), X(i + 1), Y(j + 1));
      edge(c, d, X(i + 1), Y(j + 1), X(i), Y(j + 1));
      edge(d, a, X(i), Y(j + 1), X(i), Y(j));
      for (let k = 0; k + 1 < pts.length; k += 2) segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
    }
    return segs;
  }
  const M = String.raw;

  window.Lab = { QS, $, tok, math, fmt, sci, sup, frac, lin, header, seg, exam, canvas, watch, drag, contour, M };
})();
