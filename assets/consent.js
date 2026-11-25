// First-visit privacy bar (all pages).
// Likes are the only thing we send anywhere: the server derives country + city from the request,
// no IP address is stored, no other tracking. Choice is kept in localStorage 'scar-consent' = yes | no.
// OK  → allow sending likes, reload.   No → never send, drop any queued likes, reload.
// The ring around the cookie counts down; when it runs out the bar just hides for this visit
// (nothing is sent until the visitor says OK).
(function () {
  var KEY = 'scar-consent', SKEY = 'scar-consent-hidden', SECONDS = 20;
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  window.scarConsent = get;
  if (get() || /[?&]chat\b/.test(location.search)) return;
  try { if (sessionStorage.getItem(SKEY)) return; } catch (e) {}

  function set(v) {
    try {
      localStorage.setItem(KEY, v);
      if (v === 'no') localStorage.removeItem('scarlat-vote-queue');
    } catch (e) {}
    location.reload();
  }

  var css = document.createElement('style');
  css.textContent =
    '.ck-bar{position:fixed;left:20px;bottom:20px;z-index:100020;display:flex;align-items:center;gap:14px;max-width:min(460px,calc(100vw - 40px));' +
      'box-sizing:border-box;padding:14px 16px;border-radius:18px;background:#000;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.28);' +
      'font:400 12.5px/1.45 Inter,Helvetica,Arial,sans-serif;transform:translateY(calc(100% + 40px));opacity:0;transition:transform .5s cubic-bezier(.33,1,.68,1),opacity .4s ease}' +
    '.ck-bar.show{transform:none;opacity:1}' +
    '.ck-ico{position:relative;flex:0 0 44px;width:44px;height:44px}' +
    '.ck-ico svg{position:absolute;inset:0;width:44px;height:44px}' +
    '.ck-ico .ck-ring{transform:rotate(-90deg)}' +
    '.ck-ico .ck-sec{position:absolute;right:-4px;bottom:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#fff;color:#000;font-size:10px;font-weight:700;line-height:18px;text-align:center}' +
    '.ck-txt{flex:1;margin:0}.ck-txt b{font-weight:600}' +
    '.ck-act{display:flex;align-items:center;gap:12px;flex:0 0 auto}' +
    '.ck-ok{border:0;border-radius:999px;background:#fff;color:#000;font:600 12px/1 Inter,Helvetica,Arial,sans-serif;padding:10px 18px;cursor:pointer}' +
    '.ck-ok:hover{background:#e8e8e8}' +
    '.ck-no{color:#fff;opacity:.75;font-size:12px;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.ck-no:hover{opacity:1}' +
    '@media (max-width:600px){.ck-bar{left:12px;right:12px;bottom:98px;max-width:none;flex-wrap:wrap}.ck-txt{flex:1 1 calc(100% - 60px)}.ck-act{width:100%;justify-content:flex-end}}';
  document.head.appendChild(css);

  var R = 20, C = 2 * Math.PI * R;
  var bar = document.createElement('div');
  bar.className = 'ck-bar notranslate';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Privacy');
  bar.innerHTML =
    '<div class="ck-ico" aria-hidden="true">' +
      '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="' + R + '" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/></svg>' +
      '<svg class="ck-ring" viewBox="0 0 44 44"><circle class="ck-arc" cx="22" cy="22" r="' + R + '" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg>' +
      // cookie
      '<svg viewBox="0 0 44 44"><g transform="translate(10 10)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/>' +
        '<circle cx="8.5" cy="8.5" r=".6" fill="#fff"/><circle cx="15.5" cy="15.5" r=".6" fill="#fff"/><circle cx="7.5" cy="15" r=".6" fill="#fff"/><circle cx="12" cy="12" r=".6" fill="#fff"/>' +
      '</g></svg>' +
      '<span class="ck-sec">' + SECONDS + '</span>' +
    '</div>' +
    '<p class="ck-txt"><b>No tracking here.</b> When you like an image we only keep the country and city it came from. No IP address, no cookies for ads, nothing else.</p>' +
    '<div class="ck-act"><a class="ck-no" role="button" tabindex="0">No</a><button type="button" class="ck-ok">OK</button></div>';

  function mount() {
    document.body.appendChild(bar);
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('show'); }); });
    var arc = bar.querySelector('.ck-arc'), sec = bar.querySelector('.ck-sec'), t0 = performance.now(), stopped = false;
    function tick(now) {
      if (stopped) return;
      var left = Math.max(0, SECONDS - (now - t0) / 1000);
      arc.setAttribute('stroke-dashoffset', String(C * (1 - left / SECONDS)));
      sec.textContent = Math.ceil(left);
      if (left <= 0) { hide(); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    function hide() {
      stopped = true;
      try { sessionStorage.setItem(SKEY, '1'); } catch (e) {}
      bar.classList.remove('show');
      setTimeout(function () { bar.remove(); }, 600);
    }
    bar.querySelector('.ck-ok').addEventListener('click', function () { stopped = true; set('yes'); });
    var no = bar.querySelector('.ck-no');
    no.addEventListener('click', function () { stopped = true; set('no'); });
    no.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stopped = true; set('no'); } });
    // keep clicks inside the bar away from page handlers (grid zoom, gallery canvas)
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'wheel'].forEach(function (t) { bar.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
