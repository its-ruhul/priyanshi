/* =========================================================
   For you — app
   Everything the page shows is read from data.json.
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HEART_SVG = '<svg viewBox="-20 -16 40 38" aria-hidden="true"><use href="#heartShape"/></svg>';
  const HEART_COLORS = ['#d98a82', '#e9a99d', '#c97b74', '#f2c4b9', '#b96f6a'];

  let DATA = {};
  let gateOpen = false;

  /* ---------- small helpers ---------- */
  function get(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function fill(str) {
    if (str == null) return '';
    const names = DATA.names || {};
    return String(str)
      .replace(/\{her\}/g, names.her || '')
      .replace(/\{him\}/g, names.him || '');
  }
  function splitWords(el, text) {
    el.textContent = '';
    const words = String(text).split(/\s+/).filter(Boolean);
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--i', i);
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return words.length;
  }
  function seeded(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  /* ---------- data ---------- */
  const DEFAULTS = {
    names: { her: 'My Love', him: '' },
    nav: { home: 'Home', letter: 'Letter', memories: 'Memories' },
  };

  async function loadData() {
    let res;
    try {
      res = await fetch('data.json', { cache: 'no-cache' });
    } catch (e) {
      throw Object.assign(new Error('fetch'), { kind: 'fetch' });
    }
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { kind: 'missing' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw Object.assign(new Error(e.message), { kind: 'parse' });
    }
  }

  function showLoadError(err) {
    const box = $('#gateError');
    const title = document.createElement('strong');
    const body = document.createElement('div');
    if (err.kind === 'parse') {
      title.textContent = 'data.json has a typo.';
      body.innerHTML = 'Usually it is a missing comma, a missing quote, or an extra comma after the last item in a list. The browser says: <code></code>';
      body.querySelector('code').textContent = err.message;
    } else if (location.protocol === 'file:') {
      title.textContent = 'Open this through a web server.';
      body.innerHTML = 'The page was opened straight from a folder, so the browser won’t let it read <code>data.json</code>. Upload the folder to your hosting, or run a local server (see README.md).';
    } else {
      title.textContent = 'Couldn’t load data.json.';
      body.innerHTML = 'Make sure <code>data.json</code> sits in the same folder as <code>index.html</code>.';
    }
    box.append(title, body);
    box.hidden = false;
    $('#gateHeart').style.opacity = '.35';
    $('#gate').classList.add('is-ready');
  }

  function bindText() {
    $$('[data-bind]').forEach((el) => {
      const raw = get(DATA, el.dataset.bind);
      const text = fill(raw == null ? '' : raw);
      if (el.hasAttribute('data-split')) splitWords(el, text);
      else el.textContent = text;
    });
    const title = fill(get(DATA, 'site.title'));
    if (title) document.title = title;
  }

  /* =========================================================
     Falling petals (canvas)
     ========================================================= */
  const Petals = {
    canvas: null, ctx: null, list: [], w: 0, h: 0, dpr: 1, max: 20, density: 1,
    raf: 0, last: 0, running: false,
    colors: ['#f2c4b9', '#eab0a3', '#f7dcd3', '#e39f95', '#f5cfc4'],

    init() {
      this.canvas = $('#petals');
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      if (reduceMotion) return;
      for (let i = 0; i < this.max * 0.6; i++) this.list.push(this.make(true));
      document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
      this.start();
    },
    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.max = clamp(Math.round((this.w * this.h) / 36000), 10, 38);
    },
    setDensity(d) { this.density = d; },
    make(anywhere) {
      const r = Math.random;
      return {
        x: r() * this.w,
        y: anywhere ? r() * this.h : -20 - r() * 40,
        s: 5 + r() * 6.5,
        vy: 0.35 + r() * 0.55,
        vx: 0.12 + r() * 0.3,
        sw: r() * Math.PI * 2,
        sws: 0.008 + r() * 0.014,
        swa: 0.35 + r() * 0.7,
        rot: r() * Math.PI * 2,
        vr: (r() - 0.5) * 0.03,
        flip: r() * Math.PI * 2,
        vf: 0.015 + r() * 0.03,
        c: this.colors[(r() * this.colors.length) | 0],
        a: 0.55 + r() * 0.35,
      };
    },
    start() {
      if (this.running || reduceMotion) return;
      this.running = true;
      this.last = performance.now();
      const loop = (t) => {
        if (!this.running) return;
        this.frame(t);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },
    stop() { this.running = false; cancelAnimationFrame(this.raf); },
    frame(t) {
      const k = Math.min(3, (t - this.last) / 16.67);
      this.last = t;
      const { ctx } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      const target = Math.round(this.max * this.density);
      if (this.list.length < target && Math.random() < 0.04 * k) this.list.push(this.make(false));

      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.sw += p.sws * k;
        p.x += (p.vx + Math.sin(p.sw) * p.swa) * k;
        p.y += p.vy * k;
        p.rot += p.vr * k;
        p.flip += p.vf * k;
        if (p.y > this.h + 30 || p.x > this.w + 40) {
          if (this.list.length > target) { this.list.splice(i, 1); continue; }
          Object.assign(p, this.make(false), { x: Math.random() * this.w * 1.1 - this.w * 0.15 });
        }
        const s = p.s;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.25 + Math.abs(Math.cos(p.flip)) * 0.75);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(0, s);
        ctx.bezierCurveTo(-s * 0.95, s * 0.2, -s * 0.72, -s * 0.92, -s * 0.18, -s * 0.84);
        ctx.quadraticCurveTo(0, -s * 0.58, s * 0.18, -s * 0.84);
        ctx.bezierCurveTo(s * 0.72, -s * 0.92, s * 0.95, s * 0.2, 0, s);
        ctx.fill();
        ctx.restore();
      }
    },
  };

  /* =========================================================
     Heart particles
     ========================================================= */
  const layer = () => $('#tapLayer');

  function heartParticle(x, y, opts) {
    const el = document.createElement('span');
    el.className = 'particle' + (opts.confetti ? ' is-confetti' : '');
    el.innerHTML = HEART_SVG;
    const st = el.style;
    st.setProperty('--x', x + 'px');
    st.setProperty('--y', y + 'px');
    st.setProperty('--dx', opts.dx + 'px');
    st.setProperty('--dy', (opts.dy || 0) + 'px');
    if (opts.confetti) {
      st.setProperty('--uy', opts.uy + 'px');
      st.setProperty('--fy', opts.fy + 'px');
    }
    st.setProperty('--r', opts.r + 'deg');
    st.setProperty('--s', opts.s + 'px');
    st.setProperty('--d', opts.d + 'ms');
    st.setProperty('--c', opts.c);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    layer().appendChild(el);
  }

  function tapHearts(x, y, n = 4) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const dist = 40 + Math.random() * 50;
      heartParticle(x, y, {
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist - 20,
        r: (Math.random() - 0.5) * 60,
        s: 12 + Math.random() * 10,
        d: 800 + Math.random() * 500,
        c: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0],
      });
    }
  }

  function burst(x, y, n = 18, spread = 160) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = spread * (0.55 + Math.random() * 0.6);
      heartParticle(x, y, {
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        r: (Math.random() - 0.5) * 120,
        s: 14 + Math.random() * 16,
        d: 900 + Math.random() * 600,
        c: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0],
      });
    }
  }

  function confetti(x, y, n = 46) {
    if (reduceMotion) return;
    const h = window.innerHeight;
    for (let i = 0; i < n; i++) {
      heartParticle(x, y, {
        confetti: true,
        dx: (Math.random() - 0.5) * Math.min(window.innerWidth, 900) * 0.9,
        uy: -(160 + Math.random() * 260),
        fy: h * (0.35 + Math.random() * 0.5),
        r: (Math.random() - 0.5) * 540,
        s: 12 + Math.random() * 18,
        d: 1800 + Math.random() * 1200,
        c: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0],
      });
    }
  }

  /* =========================================================
     Toast
     ========================================================= */
  let toastTimer;
  function toast(text, ms = 2600) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-shown'), ms);
  }

  /* =========================================================
     Music
     ========================================================= */
  const Music = {
    audio: null, list: [], i: 0, playing: false, wanted: false, fails: 0, vol: 0.5, fadeTimer: 0,

    init() {
      const cfg = DATA.music || {};
      this.list = (Array.isArray(cfg.tracks) ? cfg.tracks : []).filter((t) => t && t.file);
      this.vol = clamp(Number(cfg.volume == null ? 0.5 : cfg.volume) || 0.5, 0, 1);
      if (!this.list.length) return;
      if (cfg.shuffle) {
        for (let i = this.list.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          [this.list[i], this.list[j]] = [this.list[j], this.list[i]];
        }
      }
      const a = (this.audio = new Audio());
      a.preload = 'auto';
      a.loop = this.list.length === 1;
      a.addEventListener('ended', () => this.next());
      a.addEventListener('error', () => this.onError());
      a.addEventListener('playing', () => (this.fails = 0));
      a.src = this.list[0].file;

      $('#musicBtn').addEventListener('click', () => this.toggle());
      const nextBtn = $('#musicNext');
      if (this.list.length > 1) {
        nextBtn.hidden = false;
        nextBtn.addEventListener('click', () => { this.wanted = true; this.next(true); });
      }
      $('#music').hidden = false;
    },
    reveal() {
      if (this.audio) requestAnimationFrame(() => $('#music').classList.add('is-shown'));
    },
    play(announce = true) {
      if (!this.audio) return;
      this.wanted = true;
      try { this.audio.volume = 0; } catch (e) { /* iOS ignores volume */ }
      const p = this.audio.play();
      const ok = () => {
        this.playing = true;
        this.ui();
        this.fade(this.vol);
        if (announce) this.announce();
      };
      if (p && p.then) {
        p.then(ok).catch((err) => {
          if (err && err.name === 'AbortError') return;
          this.playing = false;
          this.ui();
        });
      } else ok();
    },
    pause() {
      this.wanted = false;
      this.playing = false;
      this.ui();
      this.fade(0, () => { if (!this.wanted) this.audio.pause(); });
    },
    toggle() { (this.playing ? this.pause() : this.play()); },
    next(announce = true) {
      if (!this.audio) return;
      if (this.list.length < 2) { this.audio.currentTime = 0; if (this.wanted) this.play(false); return; }
      this.i = (this.i + 1) % this.list.length;
      this.audio.src = this.list[this.i].file;
      if (this.wanted) this.play(announce);
    },
    announce() {
      const t = this.list[this.i];
      if (t && t.title) toast('♪ ' + fill(t.title) + (t.artist ? ', ' + t.artist : ''));
    },
    onError() {
      const t = this.list[this.i];
      console.warn('[music] Could not load "' + (t && t.file) + '". Check the file name in data.json and that the file is inside the music folder.');
      this.fails++;
      if (this.fails >= this.list.length) {
        this.playing = false;
        const box = $('#music');
        box.classList.remove('is-shown');
        setTimeout(() => (box.hidden = true), 600);
        return;
      }
      this.next(false);
    },
    fade(to, done) {
      clearInterval(this.fadeTimer);
      const a = this.audio;
      const from = a.volume;
      const t0 = performance.now();
      const D = 1500;
      this.fadeTimer = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / D);
        try { a.volume = clamp(from + (to - from) * k, 0, 1); } catch (e) { /* ignore */ }
        if (k >= 1) { clearInterval(this.fadeTimer); if (done) done(); }
      }, 30);
    },
    ui() {
      const box = $('#music');
      const btn = $('#musicBtn');
      box.classList.toggle('is-playing', this.playing);
      btn.setAttribute('aria-pressed', String(this.playing));
      btn.setAttribute('aria-label', this.playing ? 'Pause music' : 'Play music');
    },
  };

  /* =========================================================
     Router (one page app so the music never stops)
     ========================================================= */
  const pages = {};
  let current = null;
  let leaveTimer = 0;

  function routeName() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return pages[h] ? h : 'home';
  }

  function show(name) {
    const next = pages[name];
    if (next === current && !leaveTimer) return;
    clearTimeout(leaveTimer);
    leaveTimer = 0;
    Object.values(pages).forEach((p) => {
      if (p !== current && p !== next) p.classList.remove('is-active', 'is-leaving', 'is-entering');
    });
    const prev = current;
    current = next;
    updateNav(name);
    Petals.setDensity(name === 'letter' ? 0.4 : 1);

    if (prev && prev !== next) {
      prev.classList.add('is-leaving');
      onLeave(prev.dataset.page);
      leaveTimer = setTimeout(() => {
        leaveTimer = 0;
        prev.classList.remove('is-active', 'is-leaving');
        enter(next, name);
      }, reduceMotion ? 0 : 330);
    } else {
      enter(next, name);
    }
  }

  function enter(page, name) {
    window.scrollTo(0, 0);
    page.classList.add('is-active', 'is-entering');
    void page.offsetWidth;
    requestAnimationFrame(() => page.classList.remove('is-entering'));
    if (name === 'home') Home.enter();
    if (name === 'letter') Letter.enter();
    if (name === 'memories') Memories.start();
  }

  function onLeave(name) {
    if (name === 'memories') Memories.stop();
  }

  function updateNav(name) {
    $$('.nav a').forEach((a) => {
      const on = a.dataset.route === name;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    moveBlob();
  }

  function moveBlob() {
    const a = $('.nav a.is-active');
    const blob = $('#navBlob');
    if (!a || !blob) return;
    blob.style.width = a.offsetWidth + 'px';
    blob.style.transform = 'translateX(' + a.offsetLeft + 'px)';
  }

  /* =========================================================
     Opening screen
     ========================================================= */
  function initGate() {
    const gate = $('#gate');
    const heart = $('#gateHeart');
    gate.classList.add('is-ready');
    heart.addEventListener('click', () => {
      if (gateOpen) return;
      gateOpen = true;
      Music.play();
      const r = heart.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 22, 190);
      heart.classList.add('is-popped');
      setTimeout(() => {
        gate.classList.add('is-open');
        document.body.classList.remove('is-locked');
        Home.fromGate = true;
        show(routeName());
        Music.reveal();
        requestAnimationFrame(moveBlob);
      }, reduceMotion ? 0 : 420);
      setTimeout(() => (gate.hidden = true), 1600);
    });
  }

  /* =========================================================
     Home
     ========================================================= */
  const Home = {
    played: false,
    fromGate: false,

    init() {
      this.drawScene();
      this.initTogether();
      this.fit();
      window.addEventListener('resize', () => this.fit());
    },

    // Frame the picture for the screen shape: on wide screens the words sit
    // beside the couple, on tall screens they sit above.
    fit() {
      const svg = $('#scene');
      const page = $('.page-home');
      const H = Math.max(1, window.innerHeight);
      const aspect = window.innerWidth / H;
      const wide = aspect >= 1.2;
      const h = wide ? 1060 : 1090;
      const w = h * aspect;
      const x0 = wide ? 815 - w * 0.38 : 840 - w / 2;
      // keep the picnic blanket just above the bottom menu
      const y0 = 962 - h * (H - 96) / H;
      svg.setAttribute('viewBox', [x0, y0, w, h].map((n) => Math.round(n)).join(' '));
      page.classList.toggle('is-wide', wide);
      page.classList.toggle('no-tree', x0 > 380);
    },

    drawScene() {
      const NS = 'http://www.w3.org/2000/svg';
      const mk = (tag, attrs) => {
        const el = document.createElementNS(NS, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        return el;
      };

      // blossoms in the tree
      const rand = seeded(11);
      const blossoms = $('#blossoms');
      const blobs = [[170, 360, 95], [300, 260, 120], [450, 270, 105], [560, 370, 80], [120, 450, 70], [420, 400, 95], [250, 420, 90]];
      const bColors = ['#fbe9e3', '#fbe9e3', '#d98b82', '#f7d0c6', '#c9766f'];
      for (let i = 0; i < 95; i++) {
        const [cx, cy, r] = blobs[(rand() * blobs.length) | 0];
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * r * 0.92;
        blossoms.appendChild(mk('circle', {
          cx: (cx + Math.cos(a) * d).toFixed(1),
          cy: (cy + Math.sin(a) * d).toFixed(1),
          r: (3 + rand() * 4.5).toFixed(1),
          fill: bColors[(rand() * bColors.length) | 0],
        }));
      }

      // flowers in the grass
      const flowers = $('#flowers');
      const fColors = ['#f7e3dc', '#e9a99d', '#fbf3ea', '#d98c82', '#f2c4b9'];
      let placed = 0;
      let guard = 0;
      while (placed < 80 && guard++ < 900) {
        const x = -400 + rand() * 2600;
        const y = 778 + rand() * 210;
        if (x > 470 && x < 1140 && y > 846 && y < 975) continue; // blanket
        if (x > 260 && x < 420 && y < 840) continue; // trunk
        const sc = 0.55 + ((y - 770) / 230) * 0.95;
        const u = mk('use', {
          href: '#flower',
          fill: fColors[(rand() * fColors.length) | 0],
          transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + sc.toFixed(2) + ')',
        });
        flowers.appendChild(u);
        placed++;
      }

      // tiny flowers on the bush
      const bush = $('#bushFlowers');
      for (let i = 0; i < 14; i++) {
        const x = 1420 + rand() * 180;
        const y = 712 + rand() * 110;
        bush.appendChild(mk('use', { href: '#flower', fill: i % 2 ? '#f7e3dc' : '#e9a99d', transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(.9)' }));
      }

      // grass tufts
      const tuft = (x, y, h, color) => {
        const b = (dx, lean, hh) =>
          'M' + (x + dx - 2.5) + ' ' + y +
          ' Q' + (x + dx + lean * 0.3) + ' ' + (y - hh * 0.55) + ' ' + (x + dx + lean) + ' ' + (y - hh) +
          ' Q' + (x + dx + lean * 0.2 + 2) + ' ' + (y - hh * 0.5) + ' ' + (x + dx + 2.5) + ' ' + y + 'Z';
        return mk('path', {
          d: b(-5, -9, h * 0.8) + b(0, 2, h) + b(5, 10, h * 0.75),
          fill: color,
        });
      };
      const back = $('#grassBack');
      const gColorsBack = ['#9aa07b', '#a5aa85', '#8f9670'];
      for (let i = 0; i < 64; i++) {
        const x = -400 + rand() * 2600;
        const y = 790 + rand() * 120;
        if (x > 470 && x < 1140 && y > 850) continue;
        back.appendChild(tuft(x, y, 14 + rand() * 12, gColorsBack[(rand() * 3) | 0]));
      }
      const front = $('#grassFront');
      const gColorsFront = ['#838c66', '#8c9570', '#7a845f', '#939b76'];
      for (let x = -420; x < 2240; x += 22 + rand() * 16) {
        const y = 975 + rand() * 30;
        const t = tuft(x, y, 24 + rand() * 22, gColorsFront[(rand() * 4) | 0]);
        t.setAttribute('class', 'tuft');
        t.style.animationDelay = (-rand() * 3.6).toFixed(2) + 's';
        t.style.animationDuration = (3 + rand() * 1.8).toFixed(2) + 's';
        front.appendChild(t);
      }
      // tufts hugging the blanket edge
      for (let x = 500; x < 1110; x += 26 + rand() * 18) {
        front.appendChild(tuft(x, 962 + rand() * 6, 14 + rand() * 10, gColorsFront[(rand() * 4) | 0]));
      }
    },

    initTogether() {
      const since = get(DATA, 'site.togetherSince');
      const el = $('#together');
      if (!since) return;
      const d = new Date(String(since) + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      const days = Math.floor((Date.now() - d.getTime()) / 864e5);
      if (days < 0) return;
      this.days = days;
      this.togetherTpl = fill(get(DATA, 'home.togetherText') || '{days} days of us');
      el.textContent = this.togetherTpl.replace('{days}', days.toLocaleString());
      el.hidden = false;
    },

    countUp() {
      if (this.days == null) return;
      const el = $('#together');
      const target = this.days;
      const t0 = performance.now();
      const D = 1600;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / D);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = this.togetherTpl.replace('{days}', Math.round(target * eased).toLocaleString());
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    enter() {
      if (this.played) return;
      this.played = true;
      const copy = $('.home-copy');
      if (reduceMotion) { copy.classList.remove('pre'); return; }
      const words = $$('.home-headline .w').length;
      const base = this.fromGate ? 0.75 : 0.2;
      const after = base + 0.35 + words * 0.095 + 0.35;
      copy.style.setProperty('--base', base + 's');
      copy.style.setProperty('--after', after + 's');
      copy.classList.remove('pre');
      copy.classList.add('play');
      setTimeout(() => this.countUp(), (after + 0.4) * 1000);
      setTimeout(() => copy.classList.remove('play'), (after + 1.6) * 1000);
    },
  };

  /* =========================================================
     Letter
     ========================================================= */
  const Letter = {
    opened: false, done: false, skipping: false,
    speed: 55,
    pending: null,

    init() {
      const L = DATA.letter || {};
      const date = L.date
        ? fill(L.date)
        : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      splitWords($('#lDate'), date);
      splitWords($('#lGreeting'), fill(L.greeting || ''));
      const body = $('#lBody');
      (Array.isArray(L.paragraphs) ? L.paragraphs : []).forEach((para) => {
        const p = document.createElement('p');
        p.className = 'block';
        splitWords(p, fill(para));
        body.appendChild(p);
      });
      splitWords($('#lClosing'), fill(L.closing || ''));
      const sig = $('#lSignature');
      splitWords(sig, fill(L.signature || ''));
      sig.appendChild($('.l-squiggle'));
      if (L.postscript) splitWords($('#lPs'), fill(L.postscript));
      else $('#lPs').remove();

      this.tear($('#paper'));

      $('#envelope').addEventListener('click', () => this.open());
      $('#paper').addEventListener('click', () => this.skip());
      Forgive.init();
    },

    tear(el) {
      const r = seeded(7);
      const pts = [];
      for (let x = 0; x <= 100; x += 2.5) pts.push(x + '% ' + (r() * 5).toFixed(1) + 'px');
      for (let y = 0; y <= 100; y += 1.5) pts.push('calc(100% - ' + (r() * 3.5).toFixed(1) + 'px) ' + y + '%');
      for (let x = 100; x >= 0; x -= 2.5) pts.push(x + '% calc(100% - ' + (r() * 6).toFixed(1) + 'px)');
      for (let y = 100; y >= 0; y -= 1.5) pts.push((r() * 3.5).toFixed(1) + 'px ' + y + '%');
      el.style.clipPath = 'polygon(' + pts.join(',') + ')';
    },

    enter() {
      if (this.opened) {
        $('#envelopeStage').hidden = true;
        $('#letterWrap').hidden = false;
      }
    },

    async open() {
      if (this.opened) return;
      this.opened = true;
      const env = $('#envelope');
      const r = env.getBoundingClientRect();
      env.classList.add('is-open');
      setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.58, 12, 120), 120);
      await wait(reduceMotion ? 0 : 1300);
      const stage = $('#envelopeStage');
      stage.classList.add('is-leaving');
      await wait(reduceMotion ? 0 : 500);
      stage.hidden = true;
      const wrap = $('#letterWrap');
      wrap.hidden = false;
      wrap.classList.add('is-entering');
      window.scrollTo(0, 0);
      void wrap.offsetWidth;
      requestAnimationFrame(() => wrap.classList.remove('is-entering'));
      await wait(reduceMotion ? 0 : 450);
      this.write();
    },

    inView(el) {
      return new Promise((resolve) => {
        if (this.skipping) return resolve();
        const io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) { io.disconnect(); this.pending = null; resolve(); }
        }, { rootMargin: '0px 0px -12% 0px' });
        io.observe(el);
        this.pending = () => { io.disconnect(); resolve(); };
      });
    },

    writeBlock(block) {
      return new Promise((resolve) => {
        if (this.skipping) return resolve();
        const n = block.querySelectorAll('.w').length;
        const speed = reduceMotion ? 0 : this.speed;
        block.style.setProperty('--speed', speed + 'ms');
        block.classList.add('is-writing');
        const finish = () => {
          clearTimeout(t);
          block.classList.remove('is-writing');
          block.classList.add('is-written');
          this.pending = null;
          resolve();
        };
        const t = setTimeout(finish, n * speed + (reduceMotion ? 0 : 380));
        this.pending = finish;
      });
    },

    async write() {
      const blocks = $$('#paper .block').filter((b) => b.textContent.trim());
      for (const b of blocks) {
        if (this.skipping) break;
        await this.inView(b);
        if (this.skipping) break;
        await this.writeBlock(b);
        if (!this.skipping) await wait(reduceMotion ? 0 : 140);
      }
      this.finish();
    },

    skip() {
      if (this.done || this.skipping || !this.opened) return;
      this.skipping = true;
      $$('#paper .block').forEach((b) => { b.classList.remove('is-writing'); b.classList.add('is-written'); });
      if (this.pending) this.pending();
    },

    finish() {
      if (this.done) return;
      this.done = true;
      $('#paper').classList.add('is-done');
      $('#skipHint').classList.add('is-hidden');
      if (get(DATA, 'forgive.enabled') === false) return;
      setTimeout(() => {
        const f = $('#forgive');
        f.hidden = false;
        void f.offsetWidth;
        f.classList.add('is-shown');
      }, reduceMotion ? 0 : 700);
    },
  };

  /* =========================================================
     "Do you forgive me?"
     ========================================================= */
  const Forgive = {
    tries: 0,

    init() {
      const yes = $('#fYes');
      const no = $('#fNo');
      this.replies = (get(DATA, 'forgive.noReplies') || []).map(fill).filter(Boolean);

      no.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.dodge(); });
      no.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { e.preventDefault(); this.dodge(); } });
      no.addEventListener('click', (e) => { e.preventDefault(); this.dodge(); });
      yes.addEventListener('click', () => this.yes());
    },

    dodge() {
      const no = $('#fNo');
      const yes = $('#fYes');
      const area = $('#forgiveBtns');
      this.tries++;
      if (this.replies.length) no.textContent = this.replies[(this.tries - 1) % this.replies.length];
      yes.style.setProperty('--grow', Math.min(1 + this.tries * 0.1, window.innerWidth < 560 ? 1.5 : 1.8).toFixed(2));

      const W = area.clientWidth;
      const H = area.clientHeight;
      const nw = no.offsetWidth;
      const nh = no.offsetHeight;
      // where "Yes" will be once it has grown (it scales from its centre)
      const g = parseFloat(yes.style.getPropertyValue('--grow')) || 1;
      const cx = yes.offsetLeft + yes.offsetWidth / 2;
      const cy = yes.offsetTop + yes.offsetHeight / 2;
      const hw = (yes.offsetWidth * g) / 2 + 14;
      const hh = (yes.offsetHeight * g) / 2 + 14;
      const yr = { l: cx - hw, r: cx + hw, t: cy - hh, b: cy + hh };
      const curX = no.offsetLeft + (parseFloat(no.style.getPropertyValue('--nx')) || 0);
      let best = null;
      for (let i = 0; i < 24; i++) {
        const x = Math.random() * Math.max(0, W - nw);
        const y = Math.random() * Math.max(0, H - nh);
        const overlaps = x < yr.r && x + nw > yr.l && y < yr.b && y + nh > yr.t;
        const far = Math.abs(x - curX) > nw * 0.6;
        if (!overlaps && far) { best = [x, y]; break; }
        if (!best && far) best = [x, y];
      }
      if (!best) best = [yr.l > W - yr.r ? 0 : W - nw, H - nh];
      no.style.setProperty('--nx', (best[0] - no.offsetLeft).toFixed(0) + 'px');
      no.style.setProperty('--ny', (best[1] - no.offsetTop).toFixed(0) + 'px');
    },

    yes() {
      const r = $('#fYes').getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 50);
      burst(r.left + r.width / 2, r.top + r.height / 2, 16, 140);
      $('#forgiveAsk').hidden = true;
      $('#forgiveDone').hidden = false;
    },
  };

  /* =========================================================
     Memories carousel
     ========================================================= */
  const Memories = {
    items: [], cards: [], cur: 0, n: 0, active: false, paused: false, lock: false, msgToken: 0,

    init() {
      const M = DATA.memories || {};
      this.items = (Array.isArray(M.items) ? M.items : []).filter((it) => it && (it.photo || it.message || it.caption));
      this.n = this.items.length;
      const dur = Math.max(2, Number(M.autoplaySeconds) || 6);
      $('.page-memories').style.setProperty('--dur', dur + 's');

      const him = fill((DATA.names || {}).him || '');
      $('#chatName').textContent = him || '♥';
      $('#chatAvatar').textContent = him ? him.trim().charAt(0).toUpperCase() : '♥';

      const stack = $('#stack');
      if (!this.n) {
        stack.innerHTML = '<div class="card" data-pos="0"><div class="ph"><div class="ph-empty">' + HEART_SVG + '<span>Photos coming soon</span></div></div><div class="cap"></div></div>';
        $('#memControls').hidden = true;
        $('#progress').hidden = true;
        $('#bubble').classList.add('is-on');
        return;
      }

      this.items.forEach((it, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('role', 'group');
        card.setAttribute('aria-roledescription', 'slide');
        card.setAttribute('aria-label', (i + 1) + ' of ' + this.n);
        const ph = document.createElement('div');
        ph.className = 'ph';
        const img = document.createElement('img');
        img.alt = fill(it.caption || '');
        img.decoding = 'async';
        img.draggable = false;
        img.dataset.src = it.photo || '';
        img.addEventListener('error', () => this.placeholder(ph, i));
        ph.appendChild(img);
        const cap = document.createElement('div');
        cap.className = 'cap';
        cap.textContent = fill(it.caption || '');
        card.append(ph, cap);
        stack.appendChild(card);
        this.cards.push(card);
        if (!it.photo) this.placeholder(ph, i);
      });

      // dots
      const dots = $('#dots');
      if (this.n <= 12) {
        this.items.forEach((_, i) => {
          const d = document.createElement('button');
          d.type = 'button';
          d.className = 'dot';
          d.setAttribute('aria-label', 'Show photo ' + (i + 1));
          d.addEventListener('click', () => this.goTo(i));
          dots.appendChild(d);
        });
      } else {
        const c = document.createElement('span');
        c.className = 'dots-count';
        dots.appendChild(c);
      }

      if (this.n < 2) {
        $('#memControls').hidden = true;
        $('#progress').hidden = true;
      }

      $('#memPrev').addEventListener('click', () => this.go(-1));
      $('#memNext').addEventListener('click', () => this.go(1));
      $('#progressBar').addEventListener('animationend', () => { if (this.active && !this.paused) this.go(1); });

      // pause while she's looking closely
      stack.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.pause(true); });
      stack.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.pause(false); });

      // swipe
      let sx = 0, sy = 0, down = false;
      stack.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; if (e.pointerType !== 'mouse') this.pause(true); });
      const up = (e) => {
        if (!down) return;
        down = false;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) this.go(dx < 0 ? 1 : -1);
        if (e.pointerType !== 'mouse') this.pause(false);
      };
      stack.addEventListener('pointerup', up);
      stack.addEventListener('pointercancel', up);

      document.addEventListener('keydown', (e) => {
        if (!this.active) return;
        if (e.key === 'ArrowRight') this.go(1);
        if (e.key === 'ArrowLeft') this.go(-1);
      });

      this.layout();
      this.showMessage(true);
    },

    placeholder(ph, i) {
      if (ph.querySelector('.ph-empty')) return;
      const box = document.createElement('div');
      box.className = 'ph-empty';
      box.innerHTML = HEART_SVG;
      const t = document.createElement('span');
      t.textContent = 'Photo ' + (i + 1);
      const s = document.createElement('small');
      s.textContent = 'add it in the photos folder';
      box.append(t, s);
      ph.appendChild(box);
    },

    load(k) {
      const card = this.cards[((k % this.n) + this.n) % this.n];
      if (!card) return;
      const img = card.querySelector('img');
      if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
    },

    pos(k) {
      const off = (k - this.cur + this.n) % this.n;
      if (off === 0) return '0';
      if (off === 1) return '1';
      if (off === 2) return '2';
      return 'hidden';
    },

    layout(skip) {
      this.cards.forEach((c, k) => { if (c !== skip) c.dataset.pos = this.pos(k); });
      [0, 1, 2, -1].forEach((o) => this.load(this.cur + o));
      const dots = $$('.dot');
      dots.forEach((d, i) => d.classList.toggle('is-active', i === this.cur));
      const count = $('.dots-count');
      if (count) count.textContent = (this.cur + 1) + ' / ' + this.n;
    },

    go(dir) {
      if (this.n < 2 || this.lock) return;
      this.lock = true;
      setTimeout(() => (this.lock = false), 380);
      const prev = this.cur;
      this.cur = (this.cur + dir + this.n) % this.n;

      if (dir > 0) {
        const leaving = this.cards[prev];
        leaving.dataset.pos = 'out';
        this.layout(leaving);
        setTimeout(() => {
          leaving.classList.add('no-anim');
          leaving.dataset.pos = this.pos(prev);
          void leaving.offsetWidth;
          leaving.classList.remove('no-anim');
        }, 760);
      } else {
        const coming = this.cards[this.cur];
        coming.classList.add('no-anim');
        coming.dataset.pos = 'out';
        void coming.offsetWidth;
        coming.classList.remove('no-anim');
        this.layout();
      }
      this.showMessage(false);
      this.restartProgress();
    },

    goTo(i) {
      if (i === this.cur) return;
      const forward = (i - this.cur + this.n) % this.n;
      if (forward === 1) return this.go(1);
      if (forward === this.n - 1) return this.go(-1);
      this.cur = i;
      this.layout();
      this.showMessage(false);
      this.restartProgress();
    },

    showMessage(first) {
      const it = this.items[this.cur] || {};
      const bubble = $('#bubble');
      const typing = $('#typing');
      const date = $('#chatDate');
      const token = ++this.msgToken;
      bubble.classList.remove('is-on');
      typing.classList.add('is-on');
      setTimeout(() => {
        if (token !== this.msgToken) return;
        bubble.textContent = fill(it.message || '');
        date.textContent = fill(it.date || '');
      }, reduceMotion ? 0 : 220);
      setTimeout(() => {
        if (token !== this.msgToken) return;
        typing.classList.remove('is-on');
        if (it.message) bubble.classList.add('is-on');
      }, reduceMotion ? 0 : (first ? 700 : 1000));
    },

    restartProgress() {
      const p = $('#progress');
      p.classList.remove('is-running');
      void p.offsetWidth;
      if (this.active && this.n > 1) p.classList.add('is-running');
    },

    pause(on) {
      this.paused = on;
      $('#progress').classList.toggle('is-paused', on);
    },

    start() {
      this.active = true;
      this.layout();
      this.restartProgress();
    },

    stop() {
      this.active = false;
      $('#progress').classList.remove('is-running');
    },
  };

  /* =========================================================
     Boot
     ========================================================= */
  async function boot() {
    $$('.page').forEach((p) => (pages[p.dataset.page] = p));
    $('.home-copy').classList.add('pre');
    Petals.init();

    try {
      const loaded = await loadData();
      DATA = Object.assign({}, DEFAULTS, loaded);
      DATA.nav = Object.assign({}, DEFAULTS.nav, loaded.nav || {});
      DATA.names = Object.assign({}, DEFAULTS.names, loaded.names || {});
    } catch (err) {
      showLoadError(err);
      return;
    }

    bindText();
    Home.init();
    Letter.init();
    Memories.init();
    Music.init();
    initGate();

    window.addEventListener('hashchange', () => { if (gateOpen) show(routeName()); });
    window.addEventListener('resize', moveBlob);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveBlob);

    document.addEventListener('pointerdown', (e) => {
      if (!gateOpen) return;
      if (e.target.closest('#fNo, .nav, .music')) return;
      tapHearts(e.clientX, e.clientY, 4);
    }, { passive: true });
  }

  boot();
})();
