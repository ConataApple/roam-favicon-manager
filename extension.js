/*
 * Favicon Manager for Roam Research
 *
 * Based on and inspired by "roam-show-favicon" by Paul Vieira (paulovieira):
 *   https://github.com/paulovieira/roam-show-favicon
 * Thank you, Paul, for the original idea and implementation.
 *
 * This version adds a real settings panel (answering the original author's
 * "Future improvements" TODO: "make the options configurable by the user")
 * plus per-site custom icons and an optional fallback icon.
 */

let extensionAPI = null;

const DEFAULTS = {
  position: 'left',
  size: '16',
  spacing: '4',
  provider: 'duckduckgo',
  customIcons: '',
  fallback: '',
};

const PROVIDERS = {
  duckduckgo: (h) => `https://icons.duckduckgo.com/ip3/${h}.ico`,
  google:     (h) => `https://www.google.com/s2/favicons?domain=${h}`,
  yandex:     (h) => `https://favicon.yandex.net/favicon/${h}`,
};

const observers = {};

function getCfg(key) {
  if (extensionAPI && extensionAPI.settings) {
    const v = extensionAPI.settings.get(key);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return DEFAULTS[key];
}

function parseCustomIcons() {
  const raw = getCfg('customIcons') || '';
  const map = {};
  raw.split('\n').forEach((line) => {
    const t = line.trim().replace(/\r$/, '');
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx === -1) return;
    const domain = t.slice(0, idx).trim().replace(/^www\./, '');
    const url = t.slice(idx + 1).trim();
    if (domain && url) map[domain] = url;
  });
  return map;
}

function applyFavicon(el, url) {
  const position = getCfg('position');
  const size = parseInt(getCfg('size'), 10) || 16;
  const spacing = parseInt(getCfg('spacing'), 10) || 4;
  el.style['background-image'] = `url("${url}")`;
  el.style['background-position'] = `${position} center`;
  el.style['background-repeat'] = 'no-repeat';
  el.style['background-size'] = `${size}px`;
  el.style[position === 'left' ? 'paddingLeft' : 'paddingRight'] = `${size + spacing}px`;
}

function addFavicon(el) {
  if (el.dataset.faviconManager === 'true') return;
  const host = (el.hostname || '').replace(/^www\./, '');
  const custom = parseCustomIcons()[host];
  const provider = getCfg('provider');
  const url = custom || (PROVIDERS[provider] ? PROVIDERS[provider](host) : '');
  if (!url) return;
  applyFavicon(el, url);
  const fallback = getCfg('fallback');
  if (!custom && fallback) {
    const img = new Image();
    img.onerror = () => applyFavicon(el, fallback);
    img.src = url;
  }
  el.dataset.faviconManager = 'true';
}

function removeFavicon(el) {
  if (el.dataset.faviconManager === 'true') {
    el.style.removeProperty('background-image');
    el.style.removeProperty('background-position');
    el.style.removeProperty('background-repeat');
    el.style.removeProperty('background-size');
    // Clear BOTH padding sides so a left↔right position switch never leaves a stale pad behind.
    el.style.removeProperty('padding-left');
    el.style.removeProperty('padding-right');
    delete el.dataset.faviconManager;
  }
}

function process(root) {
  if (!root) return;
  root.querySelectorAll('a[target="_blank"]').forEach(addFavicon);
}

function reapplyAll() {
  ['div.roam-main', 'div#right-sidebar'].forEach((sel) => {
    const root = document.querySelector(sel);
    if (!root) return;
    root.querySelectorAll('a[target="_blank"]').forEach((el) => {
      removeFavicon(el);
      addFavicon(el);
    });
  });
}

function debounce(fn, wait = 400) {
  let t = null;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), wait);
  };
}

function startObserver(selector) {
  const root = document.querySelector(selector);
  if (!root) return;
  const cb = debounce(() => process(root));
  observers[selector] = new MutationObserver(cb);
  observers[selector].observe(root, { attributes: false, childList: true, subtree: true });
  process(root);
}

function stopObserver(selector) {
  if (observers[selector]) observers[selector].disconnect();
  const root = document.querySelector(selector);
  if (root) root.querySelectorAll('a[target="_blank"]').forEach(removeFavicon);
}

function onload(input) {
  // Roam Depot passes the extension API WRAPPED as { extensionAPI } — NOT the API object directly.
  // (Verified against shipping extensions RoamJS/autotag and 8bitgentleman/roam-depot-tweet-extract.)
  // The legacy roam/js route exposes the same API on window.roamjsExtensionAPI.
  extensionAPI = (input && input.extensionAPI) ? input.extensionAPI
    : (input && input.settings) ? input
    : (window.roamjsExtensionAPI || null);

  if (extensionAPI) {
    Object.keys(DEFAULTS).forEach((k) => {
      if (extensionAPI.settings.get(k) === undefined) {
        extensionAPI.settings.set(k, DEFAULTS[k]);
      }
    });

    extensionAPI.settings.panel.create({
      tabTitle: 'Favicon Manager',
      settings: [
        {
          id: 'position',
          name: 'Icon position',
          description: 'Show the favicon on the left or right of the link.',
          action: { type: 'select', items: ['left', 'right'], onChange: reapplyAll },
        },
        {
          id: 'size',
          name: 'Icon size (px)',
          description: 'Display size of the icon. 14–18 works well.',
          action: { type: 'input', placeholder: '16', onChange: reapplyAll },
        },
        {
          id: 'spacing',
          name: 'Icon spacing (px)',
          description: 'Gap between the icon and the link text.',
          action: { type: 'input', placeholder: '4', onChange: reapplyAll },
        },
        {
          id: 'provider',
          name: 'Icon provider',
          description: 'Service used to fetch favicons.',
          action: { type: 'select', items: ['duckduckgo', 'google', 'yandex'], onChange: reapplyAll },
        },
        {
          id: 'customIcons',
          name: 'Custom icons (one per line)',
          description: 'Format: domain=image-url  e.g. z-lib.fm=https://z-lib.fm/favicon.svg',
          action: { type: 'text', placeholder: 'z-lib.fm=https://z-lib.fm/favicon.svg', onChange: reapplyAll },
        },
        {
          id: 'fallback',
          name: 'Fallback icon URL (optional)',
          description: 'Shown if a provider image fails to load.',
          action: { type: 'input', placeholder: 'https://...', onChange: reapplyAll },
        },
      ],
    });
  } else {
    console.warn('[Favicon Manager] extensionAPI not available — running with default settings (no settings panel).');
  }

  startObserver('div.roam-main');
  startObserver('div#right-sidebar');
}

function onunload() {
  stopObserver('div.roam-main');
  stopObserver('div#right-sidebar');
}

export default { onload, onunload };
