// Shared header + two-dot menu for the inner pages (logos, gallery, imprint).
// Matches the home page: CHRIS SCARLAT left, two dots right; the menu opens as a
// card on the right (desktop) or a full-screen panel (phone).
(function () {
  var here = location.pathname.replace(/index\.html$/, '');
  var LINKS = [
    ['/', 'WORK'], ['/logos/', 'LOGO DESIGN'], ['/gallery/', 'GALLERY'],
    ['https://linkedin.com/in/scarlat', 'LinkedIn', true]
  ];
  var FOOT = [['https://calendar.scar.lat', 'BOOK CALL'], ['tel:+491705958989', '+49 170 595 8989'], ['/imprint/', 'IMPRINT']];
  function link(l) {
    var cur = l[0] === here ? ' aria-current="page"' : '';
    var ext = l[2] ? ' target="_blank" rel="noopener"' : '';
    return '<a href="' + l[0] + '"' + cur + ext + '>' + l[1] + '</a>';
  }

  var css = document.createElement('style');
  css.textContent =
    '.sm-frame{position:fixed;top:0;left:0;right:0;z-index:100010;display:flex;align-items:center;justify-content:space-between;padding:30px;' +
      'color:#fff;mix-blend-mode:difference;pointer-events:none;font-family:Inter,Helvetica,Arial,sans-serif;text-transform:uppercase}' +
    '.sm-frame>*{pointer-events:auto}' +
    '.sm-name{font-size:14.4px;font-weight:600;color:inherit;text-decoration:none;letter-spacing:normal}' +
    '.sm-toggle{display:flex;align-items:center;justify-content:center;width:40px;height:40px;padding:8px;margin:-8px;border:0;background:none;color:inherit;cursor:pointer}' +
    '.sm-toggle .sm-close{display:none}' +
    '.sm-open .sm-frame{mix-blend-mode:normal}' +
    '.sm-open .sm-toggle{color:#16161a}.sm-open .sm-toggle .sm-dots{display:none}.sm-open .sm-toggle .sm-close{display:block}' +
    '.sm-overlay{position:fixed;inset:0;z-index:100008;background:rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .4s ease}' +
    '.sm-open .sm-overlay{opacity:1;pointer-events:all}' +
    '.sm-panel{position:fixed;z-index:100009;top:20px;right:20px;bottom:20px;width:min(360px,calc(100vw - 40px));border-radius:20px;' +
      'display:flex;flex-direction:column;align-items:flex-start;gap:18px;padding:64px clamp(34px,4vw,60px) 28px;box-sizing:border-box;' +
      'background:rgba(255,255,255,.92);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);box-shadow:-24px 0 70px rgba(0,0,0,.18);' +
      'transform:translateX(calc(100% + 40px));transition:transform .5s cubic-bezier(.33,1,.68,1);font-family:Inter,Helvetica,Arial,sans-serif;text-transform:uppercase}' +
    '.sm-open .sm-panel{transform:translateX(0)}' +
    '.sm-panel a{color:#000;text-decoration:none;white-space:nowrap;line-height:1.2}.sm-panel a:hover{text-decoration:underline}' +
    '.sm-panel>a{font-size:18px}' +
    '.sm-foot{margin-top:auto;display:flex;flex-direction:column;align-items:inherit;gap:10px}.sm-foot a{font-size:13px}' +
    '@media (max-width:1024px){' +
      '.sm-frame{padding:20px;align-items:flex-start}.sm-name{font-size:18px}' +
      '.sm-panel{top:0;right:0;bottom:0;left:0;width:100%;border-radius:0;align-items:center;padding:96px 0 28px;background:rgba(255,255,255,.75);' +
        'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:none;transform:translateX(100%);transition:transform .3s ease}' +
      '.sm-overlay{display:none}}';
  document.head.appendChild(css);

  var frame = document.createElement('header');
  frame.className = 'sm-frame notranslate';
  frame.setAttribute('translate', 'no');
  frame.innerHTML = '<a class="sm-name" href="/">CHRIS SCARLAT</a>' +
    '<button class="sm-toggle" type="button" aria-label="Open menu" aria-expanded="false">' +
      '<svg class="sm-dots" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="8" r="2" fill="currentColor"/><circle cx="12" cy="16" r="2" fill="currentColor"/></svg>' +
      '<svg class="sm-close" viewBox="0 0 24 24" width="24" height="24"><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="16" cy="8" r="2" fill="currentColor"/><circle cx="8" cy="16" r="2" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="currentColor"/></svg>' +
    '</button>';
  var overlay = document.createElement('div');
  overlay.className = 'sm-overlay';
  var panel = document.createElement('nav');
  panel.className = 'sm-panel notranslate';
  panel.setAttribute('translate', 'no');
  panel.setAttribute('aria-label', 'Menu');
  panel.innerHTML = LINKS.map(link).join('') + '<div class="sm-foot">' + FOOT.map(link).join('') + '</div>';

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  document.body.appendChild(frame);

  var btn = frame.querySelector('.sm-toggle');
  function set(open) {
    document.documentElement.classList.toggle('sm-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(!document.documentElement.classList.contains('sm-open')); });
  overlay.addEventListener('click', function () { set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  // ---- Chat: same avatar button as home; the chat itself is the home page in chat-only mode (/?chat),
  // loaded into a side panel on first open so these pages stay light.
  css.textContent +=
    '.sc-toggle{position:fixed;right:20px;bottom:20px;z-index:100011;width:70px;height:70px;padding:0;border-radius:50%;overflow:hidden;cursor:pointer;' +
      'background:rgba(255,255,255,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:2px solid rgba(0,0,0,.1);box-shadow:0 4px 20px rgba(0,0,0,.15);transition:transform .3s ease,box-shadow .3s ease}' +
    '.sc-toggle:hover{transform:scale(1.1) rotate(5deg);box-shadow:0 6px 30px rgba(0,0,0,.25)}' +
    '.sc-toggle img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}' +
    '.sc-panel{position:fixed;z-index:100012;top:76px;right:20px;bottom:20px;width:380px;max-width:calc(100vw - 40px);border-radius:20px;overflow:hidden;' +
      'background:rgba(255,255,255,.92);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(0,0,0,.1);box-shadow:0 20px 60px rgba(0,0,0,.18);' +
      'opacity:0;pointer-events:none;transform:translateY(20px) scale(.95);transition:opacity .3s ease,transform .3s ease}' +
    '.sc-open .sc-panel{opacity:1;pointer-events:all;transform:none}' +
    '.sc-panel iframe{width:100%;height:100%;border:0;display:block;background:transparent}' +
    '@media (max-width:768px){.sc-toggle{width:56px;height:56px}.sc-panel{top:68px}}';
  var chatBtn = document.createElement('button');
  chatBtn.type = 'button';
  chatBtn.className = 'sc-toggle';
  chatBtn.setAttribute('aria-label', 'Open chat');
  chatBtn.innerHTML = '<img src="https://scar.lat/signature/chris-scarlat.gif" alt="">';
  var chatPanel = document.createElement('div');
  chatPanel.className = 'sc-panel';
  chatPanel.setAttribute('role', 'dialog');
  chatPanel.setAttribute('aria-label', 'Chat with Chris');
  document.body.appendChild(chatPanel);
  document.body.appendChild(chatBtn);
  function setChat(open) {
    if (open && !chatPanel.firstChild) {
      var f = document.createElement('iframe');
      f.src = '/?chat';
      f.title = 'Chat with Chris';
      f.setAttribute('allowtransparency', 'true');
      chatPanel.appendChild(f);
    }
    document.documentElement.classList.toggle('sc-open', open);
    chatBtn.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) set(false);
  }
  window.openChat = function () { setChat(true); };
  chatBtn.addEventListener('click', function (e) { e.stopPropagation(); setChat(!document.documentElement.classList.contains('sc-open')); });
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.type === 'scar-chat-close') setChat(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setChat(false); });
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-open-chat]'); if (a) { e.preventDefault(); setChat(true); } });

  // first-visit privacy bar (shared)
  if (!document.querySelector('script[src*="consent.js"]')) {
    var ck = document.createElement('script'); ck.src = '/assets/consent.js?v=20261125a'; document.head.appendChild(ck);
  }

  // keep clicks / wheel / touches inside the menu from reaching page handlers (gallery canvas, logo deck)
  ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'click'].forEach(function (t) {
    [panel, frame, overlay, chatBtn, chatPanel].forEach(function (el) { el.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
  });
})();
