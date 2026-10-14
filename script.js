(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- мобильное меню ---------- */
  const top = document.querySelector('.top'), burger = top.querySelector('.burger');
  const setMenu = open => { top.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
  burger.addEventListener('click', () => setMenu(!top.classList.contains('open')));
  top.querySelectorAll('.mnav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- reveal + counters ---------- */
  const fmt = n => n.toLocaleString('ru-RU');
  const count = el => {
    const to = +el.dataset.count, suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = fmt(to) + suf; return; }
    const t0 = performance.now(), dur = 1400;
    const tick = t => {
      const k = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))) + suf;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.querySelectorAll('[data-count]').forEach(count);
    io.unobserve(e.target);
  }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- hero: lidar scene ---------- */
  const cv = document.getElementById('scene');
  if (!cv) return; // на страницах без hero-сцены
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const hud = { cov: $('hudCov'), spd: $('hudSpd'), pts: $('hudPts'), bar: $('hudBar'), evt: $('hudEvt') };
  const ACC = '247,147,30';

  let W, H, dpr, lanes, path, total, obstacles, hits;
  let dist = 0, lastT = 0, pause = 0, ptsCount = 0, lastEvt = '';

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // широкий экран: поле в правой колонке над HUD; узкий: весь экран под текстом
    const wide = W > 960;
    const hudEl = document.querySelector('.hud');
    const hudTop = hudEl.getBoundingClientRect().top - cv.getBoundingClientRect().top;
    const x0 = wide ? Math.max(W * .56, W - 640) : 24, x1 = wide ? W - Math.max(40, (W - 1160) / 2) : W - 24;
    const y0 = 110, y1 = wide ? Math.max(y0 + 200, hudTop - 50) : H - 60;
    const gap = Math.max(40, (y1 - y0) / 7);
    const n = Math.max(2, Math.floor((y1 - y0) / gap));
    lanes = gap;
    path = [];
    for (let i = 0; i <= n; i++) {
      const y = y0 + i * gap;
      const [a, b] = i % 2 ? [x1, x0] : [x0, x1];
      path.push({ x: a, y }, { x: b, y });
    }
    total = 0;
    path.forEach((p, i) => { p.s = total; if (i) total += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y); });

    // препятствия — между полосами, чтобы их «видел» лидар
    const rnd = mulberry(7);
    obstacles = [];
    for (let i = 0; i < n; i++) {
      const cnt = 1 + (rnd() > .5);
      for (let j = 0; j < cnt; j++) {
        obstacles.push({ x: x0 + 60 + rnd() * (x1 - x0 - 120), y: y0 + (i + .5) * gap + (rnd() - .5) * gap * .2, r: 7 + rnd() * 8, seen: false, label: 'ПРЕПЯТСТВИЕ' });
      }
    }
    hits = [];
    dist = 0; ptsCount = 0;
  }

  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function pos(s) {
    for (let i = 1; i < path.length; i++) {
      if (s <= path[i].s || i === path.length - 1) {
        const a = path[i - 1], b = path[i], k = Math.min(Math.max((s - a.s) / (b.s - a.s || 1), 0), 1);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ang: Math.atan2(b.y - a.y, b.x - a.x) };
      }
    }
  }

  function setEvt(t) { if (t !== lastEvt) { hud.evt.textContent = t; lastEvt = t; } }

  function draw(t) {
    const dt = Math.min((t - lastT) / 1000 || 0, .05); lastT = t;
    ctx.clearRect(0, 0, W, H);

    // сетка
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const speed = 90;
    if (pause > 0) { pause -= dt; if (pause <= 0) { dist = 0; ptsCount = 0; hits = []; obstacles.forEach(o => o.seen = false); } }
    else if (!reduce) { dist += speed * dt; if (dist >= total) { dist = total; pause = 2.5; } }
    if (reduce) dist = total;

    const p = pos(dist);

    // пройденная полоса
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length && path[i].s <= dist; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = `rgba(${ACC},.13)`; ctx.lineWidth = lanes * .82; ctx.stroke();
    ctx.strokeStyle = `rgba(${ACC},.55)`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.stroke();
    ctx.restore();

    // запланированный маршрут
    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); path.forEach(q => ctx.lineTo(q.x, q.y));
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.setLineDash([2, 8]); ctx.stroke(); ctx.setLineDash([]);

    // препятствия и лидар
    const range = 150;
    obstacles.forEach(o => {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      const near = d < range && dist > 0;
      if (near && !o.seen && pause <= 0) { o.seen = true; setEvt(`${o.label} · ${(d / 40).toFixed(1)} м`); }
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7);
      ctx.fillStyle = o.seen ? `rgba(${ACC},.18)` : 'rgba(255,255,255,.05)';
      ctx.fill();
      ctx.strokeStyle = o.seen ? `rgba(${ACC},.9)` : 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.2; ctx.stroke();
      if (o.seen) { // рамка детекции
        const s = o.r + 6;
        ctx.strokeStyle = `rgba(${ACC},.9)`; ctx.lineWidth = 1;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
          ctx.beginPath(); ctx.moveTo(o.x + sx * s, o.y + sy * (s - 6)); ctx.lineTo(o.x + sx * s, o.y + sy * s); ctx.lineTo(o.x + sx * (s - 6), o.y + sy * s); ctx.stroke();
        });
      }
    });

    // лучи
    if (pause <= 0 && !reduce) {
      const sweep = t / 600;
      for (let i = 0; i < 90; i++) {
        const a = sweep + i * (Math.PI * 2 / 90);
        let hit = range;
        for (const o of obstacles) {
          const dx = o.x - p.x, dy = o.y - p.y, pr = dx * Math.cos(a) + dy * Math.sin(a);
          if (pr < 0 || pr > range) continue;
          const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
          if (perp < o.r) hit = Math.min(hit, pr - Math.sqrt(o.r * o.r - perp * perp));
        }
        if (hit < range) {
          hits.push({ x: p.x + Math.cos(a) * hit, y: p.y + Math.sin(a) * hit, life: 1 }); ptsCount++;
        }
      }
      // сканирующий луч
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(sweep) * range, p.y + Math.sin(sweep) * range);
      ctx.strokeStyle = `rgba(${ACC},.35)`; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, range, 0, 7); ctx.strokeStyle = `rgba(${ACC},.1)`; ctx.stroke();
    }
    hits = hits.filter(h => (h.life -= dt * .25) > 0).slice(-900);
    hits.forEach(h => { ctx.fillStyle = `rgba(${ACC},${h.life * .9})`; ctx.fillRect(h.x - 1, h.y - 1, 2.2, 2.2); });

    // робот
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
    ctx.fillStyle = '#4b5f69'; ctx.strokeStyle = '#8fa1aa'; ctx.lineWidth = 1;
    ctx.fillRect(-14, -12, 28, 6); ctx.fillRect(-14, 6, 28, 6);
    ctx.fillStyle = '#35474f'; ctx.fillRect(-11, -9, 22, 18); ctx.strokeRect(-11, -9, 22, 18);
    ctx.fillStyle = `rgb(${ACC})`; ctx.fillRect(2, -5, 7, 10);
    ctx.restore();

    // HUD
    const cov = Math.round(dist / total * 100);
    hud.cov.textContent = cov; hud.bar.style.width = cov + '%';
    hud.spd.textContent = pause > 0 ? '0.0' : (speed / 40).toFixed(1);
    hud.pts.textContent = fmt(ptsCount);
    if (pause > 0) setEvt('Задание выполнено · отчёт отправлен');
    else if (dist < 5) setEvt('Старт маршрута');

    if (!reduce) requestAnimationFrame(draw);
  }

  let rafOn = true;
  new IntersectionObserver(([e]) => {
    if (reduce) return;
    if (e.isIntersecting && !rafOn) { rafOn = true; lastT = performance.now(); requestAnimationFrame(draw); }
    else if (!e.isIntersecting) rafOn = false;
  }).observe(cv);
  // останавливаем цикл, когда hero вне экрана
  const _draw = draw;
  draw = t => { if (!rafOn) return; _draw(t); };

  build();
  requestAnimationFrame(draw);
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduce) draw(performance.now()); }, 150); });
})();
