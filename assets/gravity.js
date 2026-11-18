// Gravity mode (opt-in, phones/tablets): the cards on screen and their captions
// become physical objects in a box the size of the screen. Tilting the device
// sets gravity — a small tilt is gentle, a bigger tilt makes things slide faster.
// Drag or throw any block with a finger. Normal grid panning is untouched while
// the mode is off. Physics: matter.js 0.20.0 (cdnjs), loaded on the first tap.
(function () {
  var MATTER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js';
  var MATTER_SRI = 'sha512-6+7rTBmR6pRFe9fa0vCFjFaHZj/XYa7774bEBzRtxgdpIJOS++R3cKd6Prg/eJmxtsJotd8KAg4g57uuVQsZKA==';
  var TOP = 64;            // the box starts under the top bar
  var DEAD = 0.05;         // ignore tiny tilts (~3°) so things settle when the phone lies flat
  var G_SCALE = 0.0011;    // matter.js gravity scale (default 0.001)

  var coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  if (!coarse && !/[?&]gravity\b/.test(location.search)) return; // desktop: only with ?gravity (testing)

  var PHONE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2" transform="rotate(-18 12 12)"/><path d="M3 15.5c.4 1.9 1.5 3.6 3 4.7M21 8.5c-.4-1.9-1.5-3.6-3-4.7"/></svg>';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gravity-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = PHONE + '<span class="gv-label">Tilt me</span>';
  document.body.appendChild(btn);

  var toastEl = document.createElement('div');
  toastEl.className = 'gravity-toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  var toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 3600);
  }

  function loadMatter() {
    if (window.Matter) return Promise.resolve(window.Matter);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = MATTER_URL; s.integrity = MATTER_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = function () { window.Matter ? res(window.Matter) : rej(new Error('no Matter')); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  var on = false, raf = 0, engine = null, worldEl = null, blocks = [], walls = [];
  var g = { x: 0, y: 0 }, tg = { x: 0, y: 1 }, gotSensor = false, sensorT = 0;

  // ---- tilt → gravity (deviceorientation: same axes on iOS and Android) ----
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    gotSensor = true;
    var gx = Math.sin(e.gamma * Math.PI / 180);                         // tilt right → slide right
    var gy = Math.sin(Math.max(-90, Math.min(90, e.beta)) * Math.PI / 180); // top up → slide down
    var a = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    a = ((a % 360) + 360) % 360;
    var x = gx, y = gy;                                                 // portrait
    if (a === 90) { x = gy; y = -gx; }                                  // landscape, rotated left
    else if (a === 270) { x = -gy; y = gx; }                            // landscape, rotated right
    else if (a === 180) { x = -gx; y = -gy; }
    tg.x = Math.abs(x) < DEAD ? 0 : x;
    tg.y = Math.abs(y) < DEAD ? 0 : y;
  }

  // ---- the cards + captions currently on screen ----
  function captionHtml(small) {
    var lines = (small.innerText || small.textContent || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return '';
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    return '<span class="brand-name">' + esc(lines[0]) + '</span>' + lines.slice(1, 5).map(esc).join('<br>');
  }
  function collect(W, H) {
    var out = [];
    document.querySelectorAll('#images .item').forEach(function (it) {
      var box = it.querySelector('.item-image'); if (!box) return;
      var r = box.getBoundingClientRect();
      if (r.width < 12 || r.bottom < TOP || r.top > H || r.right < 0 || r.left > W) return;
      var img = box.querySelector('img'), vid = box.querySelector('video');
      out.push({ kind: 'img', r: r, src: img ? (img.currentSrc || img.src) : '', video: vid ? (vid.currentSrc || (vid.querySelector('source') || {}).src || vid.src) : '', logo: box.classList.contains('logo-item') });
      var small = it.querySelector('small');
      if (small) {
        var rc = small.getBoundingClientRect(), html = captionHtml(small);
        if (html && rc.bottom > TOP && rc.top < H && rc.right > 0 && rc.left < W) out.push({ kind: 'txt', r: rc, html: html });
      }
    });
    return out.slice(0, 24);
  }

  function start(sensorOk) {
    var M = window.Matter, W = window.innerWidth, H = window.innerHeight;
    var found = collect(W, H);
    if (!found.length) { toast('Nothing on screen to drop. Scroll a little and try again.'); return; }
    on = true;
    btn.setAttribute('aria-pressed', 'true');
    btn.querySelector('.gv-label').textContent = 'Gravity on';
    document.body.classList.add('gravity-on');

    worldEl = document.createElement('div');
    worldEl.className = 'gravity-world';
    document.body.appendChild(worldEl);

    // make the DOM blocks first so captions can be measured
    var maxW = W * 0.78, maxH = (H - TOP) * 0.5;
    found.forEach(function (f) {
      var el = document.createElement('div'), w, h;
      if (f.kind === 'img') {
        el.className = 'gv-block gv-img' + (f.logo ? ' gv-logo' : '');
        var k = Math.min(1, maxW / f.r.width, maxH / f.r.height);
        w = f.r.width * k; h = f.r.height * k;
        if (f.video) {
          var v = document.createElement('video');
          v.src = f.video; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
          v.setAttribute('playsinline', ''); el.appendChild(v); v.play && v.play().catch(function () {});
        } else {
          var im = document.createElement('img'); im.src = f.src; im.alt = ''; im.draggable = false; el.appendChild(im);
        }
      } else {
        el.className = 'gv-block gv-txt';
        el.innerHTML = f.html;
        el.style.width = Math.min(Math.max(f.r.width, 120), W * 0.62) + 'px';
      }
      if (w) { el.style.width = w + 'px'; el.style.height = h + 'px'; }
      worldEl.appendChild(el);
      f.el = el; f.w = el.offsetWidth; f.h = el.offsetHeight;
    });

    // don't overfill the box: shrink everything if the blocks cover over ~42% of it
    var area = found.reduce(function (s, f) { return s + f.w * f.h; }, 0), room = W * (H - TOP);
    var shrink = area > room * 0.42 ? Math.sqrt(room * 0.42 / area) : 1;
    found.forEach(function (f) {
      if (shrink < 1) {
        if (f.kind === 'img') { f.w *= shrink; f.h *= shrink; f.el.style.width = f.w + 'px'; f.el.style.height = f.h + 'px'; }
        else { f.el.style.fontSize = Math.max(9, 11 * shrink) + 'px'; f.el.style.width = (f.w * Math.max(shrink, .75)) + 'px'; f.w = f.el.offsetWidth; f.h = f.el.offsetHeight; }
      }
    });

    engine = M.Engine.create({ enableSleeping: false });
    engine.gravity.scale = G_SCALE;
    var T = 400;
    walls = [
      M.Bodies.rectangle(W / 2, TOP - T / 2, W + 2 * T, T, { isStatic: true }),
      M.Bodies.rectangle(W / 2, H + T / 2, W + 2 * T, T, { isStatic: true }),
      M.Bodies.rectangle(-T / 2, H / 2, T, H * 3, { isStatic: true }),
      M.Bodies.rectangle(W + T / 2, H / 2, T, H * 3, { isStatic: true })
    ];
    blocks = found.map(function (f) {
      var cx = f.r.left + f.r.width / 2, cy = f.r.top + f.r.height / 2;
      cx = Math.min(W - f.w / 2 - 2, Math.max(f.w / 2 + 2, cx));
      cy = Math.min(H - f.h / 2 - 2, Math.max(TOP + f.h / 2 + 2, cy));
      var b = M.Bodies.rectangle(cx, cy, f.w, f.h, {
        chamfer: { radius: Math.min(8, f.w / 5, f.h / 5) },
        restitution: 0.18, friction: 0.35, frictionAir: 0.035, density: f.kind === 'txt' ? 0.0012 : 0.002
      });
      f.el.style.width = f.w + 'px'; f.el.style.height = f.h + 'px';
      return { b: b, el: f.el, w: f.w, h: f.h };
    });
    M.Composite.add(engine.world, walls.concat(blocks.map(function (x) { return x.b; })));

    // drag / throw with a finger
    var mouse = M.Mouse.create(worldEl);
    var mc = M.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.18, damping: 0.1, render: { visible: false } } });
    M.Composite.add(engine.world, mc);

    // gravity: from the tilt sensor, or straight down when there isn't one
    g.x = 0; g.y = 0; tg.x = 0; tg.y = 1; gotSensor = false;
    if (sensorOk) {
      window.addEventListener('deviceorientation', onOrient);
      clearTimeout(sensorT);
      sensorT = setTimeout(function () { if (on && !gotSensor) toast('No tilt sensor found: things just fall. Drag them around.'); }, 1500);
    } else {
      toast('Motion access is off, so things just fall. Allow it in your browser settings to tilt.');
    }

    var last = performance.now();
    function frame(now) {
      if (!on) return;
      var dt = Math.min(33, Math.max(8, now - last)); last = now;
      g.x += (tg.x - g.x) * 0.08; g.y += (tg.y - g.y) * 0.08; // ease in: things start slowly
      engine.gravity.x = g.x; engine.gravity.y = g.y;
      M.Engine.update(engine, dt);
      for (var i = 0; i < blocks.length; i++) {
        var o = blocks[i], p = o.b.position;
        o.el.style.transform = 'translate(' + (p.x - o.w / 2).toFixed(1) + 'px,' + (p.y - o.h / 2).toFixed(1) + 'px) rotate(' + o.b.angle.toFixed(4) + 'rad)';
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', onResize);
  }

  // rotate / resize: move the walls to the new screen edges
  function onResize() {
    if (!on || !engine) return;
    var M = window.Matter, W = window.innerWidth, H = window.innerHeight, T = 400;
    M.Body.setPosition(walls[0], { x: W / 2, y: TOP - T / 2 });
    M.Body.setPosition(walls[1], { x: W / 2, y: H + T / 2 });
    M.Body.setPosition(walls[2], { x: -T / 2, y: H / 2 });
    M.Body.setPosition(walls[3], { x: W + T / 2, y: H / 2 });
    blocks.forEach(function (o) { // anything now outside the box comes back in
      var p = o.b.position;
      M.Body.setPosition(o.b, { x: Math.min(W - o.w / 2, Math.max(o.w / 2, p.x)), y: Math.min(H - o.h / 2, Math.max(TOP + o.h / 2, p.y)) });
    });
  }

  function stop() {
    on = false;
    cancelAnimationFrame(raf); raf = 0;
    clearTimeout(sensorT);
    window.removeEventListener('deviceorientation', onOrient);
    window.removeEventListener('resize', onResize);
    if (engine && window.Matter) { window.Matter.Engine.clear(engine); }
    engine = null; blocks = []; walls = [];
    if (worldEl) { worldEl.remove(); worldEl = null; }
    document.body.classList.remove('gravity-on');
    btn.setAttribute('aria-pressed', 'false');
    btn.querySelector('.gv-label').textContent = 'Tilt me';
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (on) { stop(); return; }
    // iOS 13+: the motion permission prompt has to be requested right here, inside the tap
    var ask = null, DOE = window.DeviceOrientationEvent, DME = window.DeviceMotionEvent;
    try {
      if (DOE && typeof DOE.requestPermission === 'function') ask = DOE.requestPermission();
      else if (DME && typeof DME.requestPermission === 'function') ask = DME.requestPermission();
    } catch (err) { ask = Promise.resolve('denied'); }
    var perm = ask ? ask.then(function (r) { return r === 'granted'; }, function () { return false; })
                   : Promise.resolve(!!DOE); // Android / others: no prompt needed
    btn.disabled = true;
    Promise.all([perm, loadMatter()]).then(function (r) {
      btn.disabled = false;
      start(r[0]);
    }, function () {
      btn.disabled = false;
      toast('Could not load the physics engine. Check the connection and try again.');
    });
  });
})();
