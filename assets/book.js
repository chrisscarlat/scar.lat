// Book icon → opens the portfolio as a Duofy book (git submodule vendor/duofy, config in /book/book.json).
// Any element with class "book-toggle" opens it. A direct click handler (not Duofy's data-duofy
// delegation) because the headers stop click propagation so clicks don't reach the grid / canvas.
// Everything in the book is also normal text on /book/.
(function () {
  var CONFIG = '/book/book.json';
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    // read the config ahead so the tap itself can ask for full screen and the camera
    if (window.Duofy) window.Duofy.preload(CONFIG).catch(function () {});
  });
  // Duofy sizes its text in rem. The home page sets html{font-size:1px}, which would shrink the book's
  // text to 1/16, so the root goes back to 16px while the book is open (the page behind is covered).
  var st = document.createElement('style');
  st.textContent = 'html.duofy-rem{font-size:16px!important}';
  document.head.appendChild(st);
  function remFix(on) {
    if (on && parseFloat(getComputedStyle(document.documentElement).fontSize) === 16) return;
    document.documentElement.classList.toggle('duofy-rem', on);
  }
  ready(function () { if (window.Duofy) window.Duofy.on('closed', function () { remFix(false); }); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.book-toggle');
    if (!b || !window.Duofy) return;
    e.preventDefault();
    remFix(true);
    window.Duofy.open(CONFIG, { trigger: b }).catch(function () { remFix(false); });
  }, true); // capture: runs before header handlers that stop propagation
})();
