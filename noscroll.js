// NoScroll for Instagram: run on instagram.com (as a Safari bookmarklet, built by index.html).
// Hides the home feed, the Explore grid and the Reels tab, and blocks swiping from reel to reel.
// Instagram changes pages without reloading, so one tap keeps it on until the page reloads.
// Whole-line comments only: index.html strips them when it builds the bookmarklet.

(function () {
  'use strict';

  // Everything that depends on Instagram's site lives here, so it's quick to fix when they change it.
  const CONFIG = {
    inbox: '/direct/inbox/',
    // Links to hide everywhere (the Reels tab and its relatives).
    hiddenLinks: ['a[href="/reels/"]', 'a[href^="/reels/audio/"]'],
    // On the home page these are hidden, which leaves only the stories tray at the top.
    homeHidden: ['main article', 'main [role="progressbar"]', 'main svg[aria-label="Loading..."]'],
    // On Explore these are hidden, which leaves only the search bar.
    exploreHidden: ['main a[href^="/p/"]', 'main a[href*="/reel/"]', 'main article', 'main [role="progressbar"]'],
    // Touches that start inside these are never blocked (comment sheets, menus).
    scrollAllowedIn: '[role="dialog"]',
    pollMs: 200,
  };

  // --- Rules (pure functions, unit-tested in Node) ---

  function reelId(path) {
    const m = /^\/(?:[\w.]+\/)?reels?\/([\w-]+)/.exec(path);
    return m && m[1] !== 'audio' ? m[1] : null;
  }

  function kind(path) {
    if (path === '/' || path === '') return 'home';
    if (/^\/explore\/search\/keyword/.test(path)) return 'blocked';
    if (/^\/explore\/search(\/|$)/.test(path)) return 'normal';
    if (/^\/explore(\/|$)/.test(path)) return 'explore';
    if (reelId(path)) return 'reel';
    if (/^\/reels(\/|$)/.test(path)) return 'blocked';
    return 'normal';
  }

  // prev: the path we were on before (null when the script has just started).
  function decide(prev, path) {
    const k = kind(path);
    if (k === 'blocked') return { action: 'back' };
    // Swiping from one reel to the next: that's the endless scroll, so go back.
    if (k === 'reel' && prev && reelId(prev) && reelId(prev) !== reelId(path)) return { action: 'back' };
    return { action: 'allow', mode: k };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { reelId, kind, decide, CONFIG };
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // --- Page behaviour ---

  function flash(text) {
    const old = document.getElementById('noscroll-pill');
    if (old) old.remove();
    const pill = document.createElement('div');
    pill.id = 'noscroll-pill';
    pill.textContent = text;
    pill.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 6px);transform:translateX(-50%);' +
      'z-index:2147483001;padding:5px 12px;border-radius:99px;pointer-events:none;transition:opacity .4s;' +
      'font:600 13px -apple-system,system-ui,sans-serif;background:#0095f6;color:#fff';
    document.body.appendChild(pill);
    setTimeout(() => { pill.style.opacity = '0'; }, 1500);
    setTimeout(() => pill.remove(), 2000);
  }

  // Tapping the bookmark again only shows that it's already on.
  if (window.__noscroll) {
    flash('NoScroll already on');
    return;
  }
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) {
    alert('Open instagram.com first, then tap NoScroll.');
    return;
  }
  window.__noscroll = true;

  const style = document.createElement('style');
  style.textContent = `
    ${CONFIG.hiddenLinks.join(',')} { display: none !important; }
    html[data-noscroll="home"] :is(${CONFIG.homeHidden.join(',')}) { display: none !important; }
    html[data-noscroll="explore"] :is(${CONFIG.exploreHidden.join(',')}) { display: none !important; }
    html:is([data-noscroll="home"], [data-noscroll="explore"], [data-noscroll="reel"]),
    html:is([data-noscroll="home"], [data-noscroll="explore"], [data-noscroll="reel"]) body {
      overflow: hidden !important; overscroll-behavior: none !important;
    }
    #noscroll-note {
      position: fixed; left: 50%; top: 55%; transform: translate(-50%, -50%);
      z-index: 2147483000; width: min(300px, calc(100vw - 32px)); box-sizing: border-box;
      padding: 18px 20px; border-radius: 16px; text-align: center;
      font: 15px/1.4 -apple-system, system-ui, sans-serif;
      background: rgba(127,127,127,.12); color: inherit;
    }
    #noscroll-note b { display: block; font-size: 17px; margin-bottom: 4px; }
    #noscroll-note button {
      margin-top: 12px; padding: 9px 18px; border: 0; border-radius: 10px;
      background: #0095f6; color: #fff; font: 600 15px -apple-system, system-ui, sans-serif;
    }
  `;
  document.head.appendChild(style);

  // Move inside Instagram without reloading (a reload would switch NoScroll off),
  // by tapping Instagram's own link to that page when there is one.
  function goTo(path) {
    const link = [...document.querySelectorAll(`a[href="${path}"]`)].find((a) => !a.closest('#noscroll-note'));
    if (link) link.click();
    else location.assign(path);
  }

  let prev = null;
  let mode = 'normal';

  function check() {
    const path = location.pathname;
    if (path === prev) return;
    const d = decide(prev, path);
    prev = path;
    if (d.action === 'back') {
      history.back();
      // If there was nothing to go back to, open messages instead.
      setTimeout(() => { if (location.pathname === path) goTo(CONFIG.inbox); }, 700);
      return;
    }
    mode = d.mode;
    document.documentElement.setAttribute('data-noscroll', mode);
    updateNote();
  }

  function updateNote() {
    let note = document.getElementById('noscroll-note');
    if (mode !== 'home') {
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement('div');
      note.id = 'noscroll-note';
      note.innerHTML = '<b>Feed hidden</b>Stories are at the top.<br><button type="button">Open messages</button>';
      note.querySelector('button').addEventListener('click', () => goTo(CONFIG.inbox));
      document.body.appendChild(note);
    }
  }

  // Block vertical swipes and wheel scrolling on the home page, Explore and reels.
  let startX = 0;
  let startY = 0;
  let free = false;
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    free = !!(e.target.closest && e.target.closest(CONFIG.scrollAllowedIn));
  }, { capture: true, passive: true });
  window.addEventListener('touchmove', (e) => {
    if (mode === 'normal' || free || e.touches.length > 1) return;
    const t = e.touches[0];
    if (Math.abs(t.clientY - startY) > Math.abs(t.clientX - startX)) e.preventDefault();
  }, { capture: true, passive: false });
  window.addEventListener('wheel', (e) => {
    if (mode === 'normal') return;
    if (e.target.closest && e.target.closest(CONFIG.scrollAllowedIn)) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.preventDefault();
  }, { capture: true, passive: false });

  window.addEventListener('popstate', check);
  setInterval(check, CONFIG.pollMs);
  check();
  flash('NoScroll on');
})();
