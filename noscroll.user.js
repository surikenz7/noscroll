// ==UserScript==
// @name         NoScroll for Instagram
// @description  Instagram without the endless feed: no home feed, Explore or Reels tab. DMs, stories, notes, reels friends send you and settings still work.
// @version      1.0.0
// @match        *://*.instagram.com/*
// @run-at       document-start
// @inject-into  content
// @updateURL    https://surikenz7.github.io/noscroll/noscroll.user.js
// @downloadURL  https://surikenz7.github.io/noscroll/noscroll.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Everything that depends on Instagram's site lives here, so it's quick to fix when they change it.
  const CONFIG = {
    inbox: '/direct/inbox/',
    search: '/explore/search/',
    // Links to hide everywhere (the Reels tab and its relatives).
    hiddenLinks: ['a[href="/reels/"]', 'a[href^="/reels/audio/"]'],
    // Links that get turned into the plain search page instead of the Explore grid.
    exploreLinks: ['a[href="/explore/"]'],
    // On the home page these are hidden, which leaves only the stories tray at the top.
    homeHidden: ['main article', 'main [role="progressbar"]', 'main svg[aria-label="Loading..."]'],
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
    if (/^\/explore\/search(\/|$)/.test(path)) return 'allow';
    if (/^\/explore(\/|$)/.test(path)) return 'explore';
    if (reelId(path)) return 'reel';
    if (/^\/reels(\/|$)/.test(path)) return 'blocked';
    return 'allow';
  }

  // prev: the path we were on before (null on a fresh page load).
  // lastNonReel: the last page that wasn't a reel, where a blocked reel swipe sends you back.
  function decide(prev, path, lastNonReel) {
    const k = kind(path);
    if (k === 'explore') return { action: 'go', to: CONFIG.search };
    if (k === 'blocked') return { action: 'go', to: lastNonReel || CONFIG.inbox };
    if (k === 'reel' && prev) {
      const before = reelId(prev);
      // Swiping from one reel to the next: that's the endless scroll, so leave.
      if (before && before !== reelId(path)) return { action: 'go', to: lastNonReel || CONFIG.inbox };
    }
    return { action: 'allow', mode: k === 'home' || k === 'reel' ? k : 'normal' };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { reelId, kind, decide, CONFIG };
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // --- Page behaviour ---

  const css = `
    ${CONFIG.hiddenLinks.join(',')} { display: none !important; }
    html[data-noscroll="home"] :is(${CONFIG.homeHidden.join(',')}) { display: none !important; }
    html[data-noscroll="home"], html[data-noscroll="home"] body,
    html[data-noscroll="reel"], html[data-noscroll="reel"] body {
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
    #noscroll-note a {
      display: inline-block; margin-top: 12px; padding: 9px 18px; border-radius: 10px;
      background: #0095f6; color: #fff !important; font-weight: 600; text-decoration: none;
    }
    #noscroll-pill {
      position: fixed; left: 50%; top: calc(env(safe-area-inset-top) + 6px); transform: translateX(-50%);
      z-index: 2147483001; padding: 4px 10px; border-radius: 99px; pointer-events: none;
      font: 600 12px -apple-system, system-ui, sans-serif; background: #0095f6; color: #fff;
      transition: opacity .4s;
    }
  `;
  // At document-start the <html> element can still be missing, so wait for it.
  function whenRoot(fn) {
    if (document.documentElement) return fn();
    const obs = new MutationObserver(() => {
      if (!document.documentElement) return;
      obs.disconnect();
      fn();
    });
    obs.observe(document, { childList: true });
  }

  whenRoot(() => {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  });

  let prev = null;
  let lastNonReel = null;
  let mode = 'normal';

  function check() {
    const path = location.pathname;
    if (path === prev) return;
    const d = decide(prev, path, lastNonReel);
    if (d.action === 'go') {
      prev = d.to;
      location.replace(d.to);
      return;
    }
    if (!document.documentElement) return;
    if (kind(path) !== 'reel') lastNonReel = path;
    prev = path;
    mode = d.mode;
    document.documentElement.setAttribute('data-noscroll', mode);
    updateNote();
  }

  function updateNote() {
    if (!document.body) return;
    let note = document.getElementById('noscroll-note');
    if (mode !== 'home') {
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement('div');
      note.id = 'noscroll-note';
      note.innerHTML = '<b>Feed hidden</b>Stories are at the top.<br><a href="' + CONFIG.inbox + '">Open messages</a>';
      document.body.appendChild(note);
    }
  }

  // Block vertical swipes and wheel scrolling on the home page and on reels.
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

  // The Explore button opens plain search instead of the Explore grid.
  window.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest(CONFIG.exploreLinks.join(','));
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.assign(CONFIG.search);
  }, true);

  window.addEventListener('popstate', check);
  setInterval(check, CONFIG.pollMs);
  check();

  // Small "NoScroll on" badge for a moment after the page loads, so you can see the script is running.
  document.addEventListener('DOMContentLoaded', () => {
    updateNote();
    const pill = document.createElement('div');
    pill.id = 'noscroll-pill';
    pill.textContent = 'NoScroll on';
    document.body.appendChild(pill);
    setTimeout(() => { pill.style.opacity = '0'; }, 1500);
    setTimeout(() => pill.remove(), 2000);
  });
})();
