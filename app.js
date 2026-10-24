(() => {
  const FRAMES = 121;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- load the 121 frames of the photographer ---------- */
  const canvas = document.getElementById('boyCanvas');
  const ctx = canvas.getContext('2d');
  const boy = document.getElementById('boy');
  const stage = document.getElementById('stage');
  const imgs = new Array(FRAMES);
  const src = i => `frames/f${String(i + 1).padStart(3, '0')}.webp`;
  let loaded = 0;

  function load(i) {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      imgs[i] = im;
      loaded++;
      if (i === 0) draw(0, true);
    };
    im.src = src(i);
  }
  load(0);                                  // first frame shows immediately
  for (let i = 1; i < FRAMES; i++) load(i);

  let lastDrawn = -1;
  function draw(f, force) {
    f = Math.max(0, Math.min(FRAMES - 1, f | 0));
    if (f === lastDrawn && !force) return;
    // fall back to the nearest frame that has loaded
    let k = f;
    while (!imgs[k] && k > 0) k--;
    if (!imgs[k]) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgs[k], 0, 0);
    lastDrawn = f;
  }

  /* ---------- mouse → boy ---------- */
  let tx = 0.5, ty = 0.5;       // target (0..1) from pointer
  let cx = 0.5, cy = 0.5;       // smoothed
  let pos = 0;                  // current position along the clip (0..1)
  let active = false, lastMove = 0, dir = 1;
  const hint = document.getElementById('hint');

  function onMove(x, y) {
    tx = x / innerWidth;
    ty = y / innerHeight;
    if (!active) { active = true; hint && hint.classList.add('gone'); }
    lastMove = performance.now();
  }
  addEventListener('pointermove', e => onMove(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });

  /* ---------- EXIF read-out reacts to the pointer too ---------- */
  const exAp = document.getElementById('exAp');
  const exSh = document.getElementById('exSh');
  const exIso = document.getElementById('exIso');
  const apertures = ['1.8', '2.8', '4', '5.6', '8', '11', '16'];
  const shutters = ['1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15'];
  const isos = [100, 200, 400, 800, 1600, 3200];
  const pick = (a, t) => a[Math.min(a.length - 1, Math.max(0, Math.floor(t * a.length)))];
  let exTick = 0;
  function updateExif() {
    if (++exTick % 4) return;
    exAp.textContent = 'f/' + pick(apertures, cx);
    exSh.textContent = pick(shutters, cy);
    exIso.textContent = 'ISO ' + pick(isos, (cx + cy) / 2);
  }

  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    // After the pointer rests for a while, he goes back to his own routine.
    const idle = !active || now - lastMove > 3500;
    if (idle) {
      if (!reduce) {
        pos += dir * dt / 5.0;                       // 5s clip, ping-pong
        if (pos >= 1) { pos = 1; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
        cx += (pos - cx) * 0.08;                     // glide the tilt with him
        cy += (0.5 - cy) * 0.05;
      }
    } else {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      pos += (cx - pos) * 0.14;                      // scrub the clip by pointer X
    }

    draw(pos * (FRAMES - 1));

    // body follows the pointer: slight turn, lean and drift
    const rx = (cy - 0.5) * -5;
    const ry = (cx - 0.5) * 12;
    const mx = (cx - 0.5) * -22;
    boy.style.transform = `perspective(900px) translate3d(${mx.toFixed(1)}px,0,0) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;

    updateExif();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- focus reticle that trails the cursor ---------- */
  const ret = document.getElementById('reticle');
  if (!matchMedia('(hover: none)').matches && !reduce) {
    let rx = innerWidth / 2, ry = innerHeight / 2, mx = rx, my = ry;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; ret.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => ret.classList.remove('on'));
    document.querySelectorAll('a,button').forEach(el => {
      el.addEventListener('pointerenter', () => ret.classList.add('lock'));
      el.addEventListener('pointerleave', () => ret.classList.remove('lock'));
    });
    (function tick() {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ret.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- film strip drifts sideways as you scroll ---------- */
  const film = document.getElementById('film');
  const wrap = document.getElementById('filmWrap');
  function strip() {
    if (reduce) return;
    const r = wrap.getBoundingClientRect();
    const span = film.scrollWidth - innerWidth;
    if (span <= 0) { film.style.transform = ''; return; }
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    film.style.transform = `translate3d(${(-span * p).toFixed(1)}px,0,0)`;
  }
  addEventListener('scroll', strip, { passive: true });
  addEventListener('resize', strip);
  strip();

  /* ---------- lightbox ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbCap = document.getElementById('lbCap');
  film.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const im = b.querySelector('img');
    lbImg.src = im.src; lbImg.alt = im.alt;
    lbCap.textContent = b.querySelector('span').childNodes[0].textContent + ' — ' + b.querySelector('small').textContent;
    lb.showModal();
  }));
  document.getElementById('lbClose').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
})();
