/*
 * Favicon Manager for Roam Research
 *
 * A faithful fork of "roam-show-favicon" by Paul Vieira (paulovieira):
 *   https://github.com/paulovieira/roam-show-favicon
 * All credit for the original idea and its implementation belongs to him.
 *
 * The original extension did exactly what this file does, but it could only be
 * configured by editing code. This fork keeps that behaviour unchanged and adds
 * the one thing the original author himself had on his TODO list
 * ("make the options configurable by the user"): a settings panel.
 *
 * On top of that it adds ONE new option: custom icons for specific domains.
 *
 * Deliberately out of scope:
 *   - No "fallback icon". The favicon providers used here always return an
 *     image (a generic globe when they have nothing better), so a fallback
 *     that only shows up "when loading fails" can never actually trigger.
 *     The original author's note on this problem was to try the next provider
 *     instead; he never implemented it, so neither do we.
 *   - No provider-chain retry, no subdomain matching, no image pre-loading.
 */

let extensionAPI = null;

const ANCHOR_SELECTOR = 'a[target="_blank"]';
const ROOTS = ['div.roam-main', 'div#right-sidebar'];
const MARKER = 'faviconManager';

const DEBOUNCE_MS = 400;   // wait this long after the last DOM change
const RETRY_MS = 500;      // how often to look for a root that is not mounted yet
const MAX_RETRIES = 30;

// The option set of the original extension, plus custom icons.
const DEFAULTS = {
  position: 'left',       // 'left' | 'right'
  size: '16',             // px          (the original's "size")
  spacing: '4',           // px          (the original's "paddingOffset")
  provider: 'duckduckgo', // 'duckduckgo' | 'google' | 'yandex'
  customIcons: '',        // "domain=image-url", one per line
};

const PROVIDERS = {
  duckduckgo: (host) => `https://icons.duckduckgo.com/ip3/${host}.ico`,
  google: (host) => `https://www.google.com/s2/favicons?domain=${host}`,
  yandex: (host) => `https://favicon.yandex.net/favicon/${host}`,
};

// In-memory copy of the settings, so a change is visible immediately instead of
// waiting for the settings store to round-trip.
const state = {};
const observers = {};
const timers = new Set();

let customIconMap = null;
let reapplySoon = null;

/* ------------------------------------------------------------------ timers */

function later(fn, delay) {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, delay);
  timers.add(id);
  return id;
}

function debounce(fn, wait = DEBOUNCE_MS) {
  let id = null;
  return function debounced(...args) {
    if (id !== null) {
      clearTimeout(id);
      timers.delete(id);
    }
    id = later(() => {
      id = null;
      fn(...args);
    }, wait);
  };
}

// Everything we scheduled goes through `timers`, so unloading can stop it all.
function cancelAllTimers() {
  timers.forEach((id) => clearTimeout(id));
  timers.clear();
}

/* ---------------------------------------------------------------- settings */

function storedValue(key) {
  if (!extensionAPI || !extensionAPI.settings) return null;
  try {
    return extensionAPI.settings.get(key);
  } catch (e) {
    return null;
  }
}

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function cfg(key) {
  const value = state[key];
  return isBlank(value) ? DEFAULTS[key] : value;
}

function loadSettings() {
  const hasStore = !!(extensionAPI && extensionAPI.settings);
  Object.keys(DEFAULTS).forEach((key) => {
    // settings.get() returns null for a key that was never saved.
    const saved = hasStore ? storedValue(key) : null;
    state[key] = isBlank(saved) ? DEFAULTS[key] : saved;
    if (hasStore && (saved === null || saved === undefined)) {
      try {
        extensionAPI.settings.set(key, DEFAULTS[key]);
      } catch (e) {
        /* read-only settings (graph admin installed it for everyone) — fine */
      }
    }
  });
}

/* ---------------------------------------------------------- custom icons */

function parseCustomIcons() {
  const map = new Map();
  String(cfg('customIcons') || '')
    .split(/[\n;]/)
    .forEach((line) => {
      const entry = line.trim();
      if (!entry) return;
      const eq = entry.indexOf('=');
      if (eq <= 0) return;
      const domain = entry.slice(0, eq).trim().toLowerCase().replace(/^www\./, '');
      const url = entry.slice(eq + 1).trim();
      if (domain && url) map.set(domain, url);
    });
  return map;
}

function customIcons() {
  if (customIconMap === null) customIconMap = parseCustomIcons();
  return customIconMap;
}

/* -------------------------------------------------------------- rendering */

// Keep a user-supplied URL from breaking out of url("…").
function cssUrl(url) {
  return String(url).replace(/[\\"'()\s]/g, '');
}

function toPx(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function applyFavicon(el, url) {
  const position = cfg('position') === 'right' ? 'right' : 'left';
  const size = toPx(cfg('size'), 16);
  const spacing = toPx(cfg('spacing'), 4);

  el.style.backgroundImage = `url("${cssUrl(url)}")`;
  el.style.backgroundPosition = `${position} center`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = `${size}px`;
  el.style[position === 'left' ? 'paddingLeft' : 'paddingRight'] = `${size + spacing}px`;
}

function addFavicon(el) {
  if (el.dataset[MARKER] === 'true') return;

  const host = String(el.hostname || '').toLowerCase().replace(/^www\./, '');
  if (!host) return; // mailto:, file:, relative links, …

  const provider = PROVIDERS[cfg('provider')] ? cfg('provider') : DEFAULTS.provider;
  const url = customIcons().get(host) || PROVIDERS[provider](host);

  applyFavicon(el, url);
  el.dataset[MARKER] = 'true';
}

function removeFavicon(el) {
  if (el.dataset[MARKER] !== 'true') return;

  el.style.removeProperty('background-image');
  el.style.removeProperty('background-position');
  el.style.removeProperty('background-repeat');
  el.style.removeProperty('background-size');
  // Clear both sides, so switching left↔right never leaves a stale pad behind.
  el.style.removeProperty('padding-left');
  el.style.removeProperty('padding-right');

  delete el.dataset[MARKER];
}

/* -------------------------------------------------------------- observing */

function process(root) {
  if (!root) return;
  root.querySelectorAll(ANCHOR_SELECTOR).forEach(addFavicon);
}

function startObserver(selector) {
  const root = document.querySelector(selector);
  if (!root) return false;

  observers[selector] = new MutationObserver(debounce(() => process(root)));
  observers[selector].observe(root, { childList: true, subtree: true });

  process(root);
  return true;
}

// The main area is not always mounted yet when the extension loads (this bites
// especially hard with local-folder development extensions), so retry briefly.
function startObserverWhenReady(selector, attempt = 0) {
  if (startObserver(selector)) return;
  if (attempt >= MAX_RETRIES) return;
  later(() => startObserverWhenReady(selector, attempt + 1), RETRY_MS);
}

function stopObserver(selector) {
  const observer = observers[selector];
  if (observer) {
    observer.disconnect();
    delete observers[selector];
  }
  const root = document.querySelector(selector);
  if (root) root.querySelectorAll(ANCHOR_SELECTOR).forEach(removeFavicon);
}

// Re-decorate what is on screen, e.g. after a setting changed.
function reapplyAll() {
  ROOTS.forEach((selector) => {
    const root = document.querySelector(selector);
    if (!root) return;
    root.querySelectorAll(ANCHOR_SELECTOR).forEach((el) => {
      if (el.dataset[MARKER] === 'true') removeFavicon(el);
    });
    process(root);
  });
}

function scheduleReapply() {
  if (reapplySoon === null) reapplySoon = debounce(reapplyAll, 300);
  reapplySoon();
}

/* --------------------------------------------------------- settings panel */

// A `select` row hands the chosen item straight over; `input` rows hand over a
// DOM event whose `target` is the text field. Handle both.
function extractValue(evt) {
  if (typeof evt === 'string') return evt;
  if (evt && evt.target) {
    if (evt.target.type === 'checkbox') return !!evt.target.checked;
    if (typeof evt.target.value === 'string') return evt.target.value;
  }
  return undefined;
}

function makeOnChange(key) {
  return (evt) => {
    const value = extractValue(evt);
    if (value === undefined) return;
    state[key] = value;
    customIconMap = null;
    scheduleReapply();
  };
}

const CUSTOM_ICONS_DESCRIPTION =
  'Give a specific website your own icon, written as domain=image-url. A leading ' +
  '"www." is ignored, and the domain must match the link exactly. Separate several ' +
  'mappings with a semicolon. Example: github.com=https://github.com/favicon.ico';

function createPanel() {
  const panel = {
    tabTitle: 'Favicon Manager',
    settings: [
      {
        id: 'position',
        name: 'Icon position',
        description: 'Show the favicon on the left or the right of the link.',
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
        description: 'Service used to fetch the icon of links that have no custom icon.',
        action: { type: 'select', items: ['duckduckgo', 'google', 'yandex'], onChange: makeOnChange('provider') },
      },
      {
        id: 'customIcons',
        name: 'Custom icons',
        description: CUSTOM_ICONS_DESCRIPTION,
        action: {
          type: 'input',
          placeholder: 'github.com=https://github.com/favicon.ico',
          onChange: makeOnChange('customIcons'),
        },
      },
    ],
  };

  try {
    const created = extensionAPI.settings.panel.create(panel);
    if (created && typeof created.catch === 'function') {
      created.catch((e) => console.warn('[Favicon Manager] settings panel error:', e));
    }
  } catch (e) {
    console.warn('[Favicon Manager] settings panel error:', e);
  }
}

/* -------------------------------------------------------------- lifecycle */

function onload(input) {
  // Roam Depot calls onload({ extensionAPI, extension }). (`input.extensionAPI`
  // is the documented shape; `input.settings` is accepted defensively.)
  extensionAPI = (input && input.extensionAPI) || (input && input.settings ? input : null);

  loadSettings();

  if (extensionAPI && extensionAPI.settings && extensionAPI.settings.panel) {
    createPanel();
  } else {
    console.warn(
      '[Favicon Manager] no Extension API available — favicons still work, but there is no settings panel.'
    );
  }

  ROOTS.forEach((selector) => startObserverWhenReady(selector));
}

function onunload() {
  ROOTS.forEach((selector) => stopObserver(selector));
  cancelAllTimers();
  customIconMap = null;
  reapplySoon = null;
}

export default { onload, onunload };
