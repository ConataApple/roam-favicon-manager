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

// In-memory cache of the current settings. Mirrors what's persisted so that a
// settings change takes effect immediately (reapplyAll reads from here), and so a
// value is always available even before/if the panel's auto-persist round-trips.
const state = {};

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

// Pull a setting value into the in-memory cache from persisted storage.
function syncState(key) {
  const v = extensionAPI && extensionAPI.settings ? extensionAPI.settings.get(key) : undefined;
  state[key] = (v !== undefined && v !== null && v !== '') ? v : DEFAULTS[key];
}

function getCfg(key) {
  if (state[key] !== undefined) return state[key];
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

// Look up a custom icon for a host. Supports suffix matching so a bare domain
// (e.g. "github.com") also covers its subdomains (e.g. "gist.github.com").
// Single-label entries like "com" are ignored for suffix matching to avoid
// accidentally matching every .com host.
function findCustomIcon(host) {
  if (!host) return undefined;
  const map = parseCustomIcons();
  if (map[host]) return map[host];
  for (const domain in map) {
    if (domain.includes('.') && host.endsWith('.' + domain)) return map[domain];
  }
  return undefined;
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
  const custom = findCustomIcon(host);
  const provider = getCfg('provider');
  const fallback = getCfg('fallback');
  const providerUrl = PROVIDERS[provider] ? PROVIDERS[provider](host) : '';
  // Priority: custom icon > provider > fallback. If one fails to load, fall through to the next.
  // The fallback is a true fallback: it only appears when the real icon (custom or provider) fails to load.
  const candidates = [custom, providerUrl, fallback].filter(Boolean);
  if (candidates.length === 0) return;
  const tryNext = (i) => {
    if (i >= candidates.length) return;
    const url = candidates[i];
    applyFavicon(el, url);
    const img = new Image();
    img.onerror = () => tryNext(i + 1);
    img.src = url;
  };
  tryNext(0);
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

// Persist a setting value explicitly and re-render.
// (Roam Depot's input onChange may not auto-persist every keystroke, so we save it ourselves.
//  Guarded so it is harmless if the framework already saved it.)
// Roam Depot's settings onChange receives an EVENT OBJECT, not the raw value:
// evt.target.value for input/select, evt.target.checked for switch. The persisted
// settings store can also return stale values immediately after a change, so we read
// the fresh value straight from the event and persist it ourselves (confirmed against
// the shipping Depot extension camflint/reddit-unofficial).
function extractValue(evt) {
  if (evt && evt.target) {
    if (typeof evt.target.checked === 'boolean') return evt.target.checked;
    return evt.target.value;
  }
  return evt; // already the value (defensive fallback)
}

function makeOnChange(key) {
  return (evt) => {
    const v = extractValue(evt);
    if (v !== undefined && v !== null) {
      state[key] = v;
      try { extensionAPI.settings.set(key, v); } catch (e) { /* ignore */ }
    }
    reapplyAll();
  };
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
      syncState(k);
    });

    extensionAPI.settings.panel.create({
      tabTitle: 'Favicon Manager',
      settings: [
        {
          id: 'position',
          name: 'Icon position',
          description: 'Show the favicon on the left or right of the link.',
          action: { type: 'select', items: ['left', 'right'], onChange: makeOnChange('position') },
        },
        {
          id: 'size',
          name: 'Icon size (px)',
          description: 'Display size of the icon. 14–18 works well.',
          action: { type: 'input', placeholder: '16', onChange: makeOnChange('size') },
        },
        {
          id: 'spacing',
          name: 'Icon spacing (px)',
          description: 'Gap between the icon and the link text.',
          action: { type: 'input', placeholder: '4', onChange: makeOnChange('spacing') },
        },
        {
          id: 'provider',
          name: 'Icon provider',
          description: 'Service used to fetch favicons.',
          action: { type: 'select', items: ['duckduckgo', 'google', 'yandex'], onChange: makeOnChange('provider') },
        },
        {
          id: 'customIcons',
          name: 'Custom icons',
          description: 'Custom favicon for a domain. Format: domain=image-url  e.g. github.com=https://github.com/favicon.ico',
          action: { type: 'input', placeholder: 'github.com=https://github.com/favicon.ico', onChange: makeOnChange('customIcons') },
        },
        {
          id: 'fallback',
          name: 'Fallback icon URL (optional)',
          description: 'Shown only if the normal icon (custom or provider) fails to load.',
          action: { type: 'input', placeholder: 'https://...', onChange: makeOnChange('fallback') },
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
