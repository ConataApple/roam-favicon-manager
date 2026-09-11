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

const ROOT_SELECTOR = 'div.roam-main, div#right-sidebar';
const LINK_SELECTOR = 'a[target="_blank"]';
const STYLE_PROPERTIES = [
  'background-image', 'background-position', 'background-repeat', 'background-size',
  'padding-left', 'padding-right',
];
const managedLinks = new Map();
let observer = null;
let refresh = null;
let active = false;
let generation = 0;

function settingValue(key, value) {
  if ((key === 'size' || key === 'spacing') && typeof value === 'number') value = String(value);
  if (typeof value !== 'string') return DEFAULTS[key];
  if (key === 'position' && !['left', 'right'].includes(value)) return DEFAULTS[key];
  if (key === 'provider' && !Object.hasOwn(PROVIDERS, value)) return DEFAULTS[key];
  return value;
}

function saveSetting(key, value) {
  const warn = (error) => console.warn(`[Favicon Manager] Could not save setting "${key}".`, error);
  try {
    Promise.resolve(extensionAPI.settings.set(key, value)).catch(warn);
  } catch (error) {
    warn(error);
  }
}

// Recover invalid types written by older versions without discarding valid strings.
function syncState(key) {
  const stored = extensionAPI.settings.get(key);
  state[key] = settingValue(key, stored);
  if (stored !== state[key]) saveSetting(key, state[key]);
}

function getCfg(key) {
  return state[key] ?? DEFAULTS[key];
}

function numericCfg(key) {
  const raw = getCfg(key);
  const value = raw.trim() === '' ? NaN : Number(raw);
  const minimum = key === 'size' ? 1 : 0;
  return Number.isSafeInteger(value) && value >= minimum ? value : Number(DEFAULTS[key]);
}

function parseCustomIcons() {
  const raw = getCfg('customIcons') || '';
  const map = new Map();
  raw.split('\n').forEach((line) => {
    const t = line.trim().replace(/\r$/, '');
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx === -1) return;
    const domain = t.slice(0, idx).trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    const url = t.slice(idx + 1).trim();
    if (domain && url) map.set(domain, url);
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
  if (map.has(host)) return map.get(host);
  let matchedDomain = '';
  let icon;
  for (const [domain, url] of map) {
    if (domain.includes('.') && host.endsWith('.' + domain) && domain.length > matchedDomain.length) {
      matchedDomain = domain;
      icon = url;
    }
  }
  return icon;
}

function applyFavicon(el, url) {
  const position = getCfg('position');
  const size = numericCfg('size');
  const spacing = numericCfg('spacing');
  el.style['background-image'] = `url("${url}")`;
  el.style['background-position'] = `${position} center`;
  el.style['background-repeat'] = 'no-repeat';
  el.style['background-size'] = `${size}px`;
  el.style[position === 'left' ? 'paddingLeft' : 'paddingRight'] = `${size + spacing}px`;
}

function eligibleLink(el) {
  return el.isConnected && el.matches(LINK_SELECTOR) && el.closest(ROOT_SELECTOR)
    && ['http:', 'https:'].includes(el.protocol) && el.hostname;
}

function releaseImage(entry) {
  if (!entry.image) return;
  entry.image.onload = null;
  entry.image.onerror = null;
  entry.image = null;
}

function addFavicon(el) {
  if (!active || !eligibleLink(el)) return;
  const previous = managedLinks.get(el);
  if (previous?.href === el.href) return;
  if (previous) removeFavicon(el);
  const host = el.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  // Keep custom > provider > fallback; a provider's valid placeholder is not a load error.
  const candidates = [...new Set([
    findCustomIcon(host), PROVIDERS[getCfg('provider')](host), getCfg('fallback'),
  ].filter(Boolean))];
  const entry = {
    href: el.href,
    marker: el.getAttribute('data-favicon-manager'),
    // Pending substitutions such as padding: var(--pad) have empty longhand
    // values in CSSOM. Keep the shorthand so clearing our longhands can restore it.
    shorthands: [['background', 'background-image'], ['padding', 'padding-left']]
      .filter(([name, longhand]) => el.style.getPropertyValue(name) && !el.style.getPropertyValue(longhand))
      .map(([name]) => [name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name)]),
    styles: STYLE_PROPERTIES.map((property) => [
      property, el.style.getPropertyValue(property), el.style.getPropertyPriority(property),
    ]),
    image: null,
  };
  managedLinks.set(el, entry);
  el.dataset.faviconManager = 'true';
  const tryNext = (index) => {
    // Both identity and href matter: old errors must not repaint a new render or URL.
    if (!active || managedLinks.get(el) !== entry || el.href !== entry.href || !eligibleLink(el)) return;
    releaseImage(entry);
    if (index >= candidates.length) {
      removeFavicon(el);
      return;
    }
    const url = candidates[index];
    applyFavicon(el, url);
    const image = new Image();
    entry.image = image;
    image.onerror = () => { if (entry.image === image) tryNext(index + 1); };
    image.onload = () => { if (entry.image === image) releaseImage(entry); };
    image.src = url;
  };
  tryNext(0);
}

function removeFavicon(el) {
  const entry = managedLinks.get(el);
  if (!entry) return;
  managedLinks.delete(el);
  releaseImage(entry);
  for (const [property, value, priority] of entry.styles) {
    if (value) el.style.setProperty(property, value, priority);
    else el.style.removeProperty(property);
  }
  for (const [property, value, priority] of entry.shorthands) {
    el.style.setProperty(property, value, priority);
  }
  if (entry.marker === null) delete el.dataset.faviconManager;
  else el.setAttribute('data-favicon-manager', entry.marker);
}

function processAll() {
  if (!active) return;
  for (const el of managedLinks.keys()) {
    if (!eligibleLink(el)) removeFavicon(el);
  }
  document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
    root.querySelectorAll(LINK_SELECTOR).forEach(addFavicon);
  });
}

function reapplyAll() {
  if (!active) return;
  for (const el of managedLinks.keys()) removeFavicon(el);
  processAll();
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
    // Text inputs also have checked === false; only checkbox/radio use it.
    if (evt.target.type === 'checkbox' || evt.target.type === 'radio') return evt.target.checked;
    return evt.target.value;
  }
  return evt; // already the value (defensive fallback)
}

function makeOnChange(key) {
  const loadedGeneration = generation;
  return (evt) => {
    if (!active || generation !== loadedGeneration) return;
    const v = extractValue(evt);
    if (typeof v !== 'string' && typeof v !== 'number') return;
    state[key] = settingValue(key, v);
    saveSetting(key, state[key]);
    reapplyAll();
  };
}

function debounce(fn, wait = 400) {
  let timer = null;
  const run = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, wait);
  };
  run.cancel = () => { clearTimeout(timer); timer = null; };
  return run;
}

function startObserver() {
  const loadedGeneration = generation;
  refresh = debounce(() => { if (generation === loadedGeneration) processAll(); });
  observer = new MutationObserver(refresh);
  // Follow roots that mount late or are replaced, but only scan links inside Roam's
  // content roots. Watching href/target (not style) avoids reacting to our own CSS.
  observer.observe(document.body || document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'target'],
  });
  processAll();
}

function onload(input) {
  // Also make direct repeated onload calls safe, without retaining another graph's state.
  onunload();
  active = true;
  // Roam Depot passes the extension API WRAPPED as { extensionAPI } — NOT the API object directly.
  // (Verified against shipping extensions RoamJS/autotag and 8bitgentleman/roam-depot-tweet-extract.)
  // The legacy roam/js route exposes the same API on window.roamjsExtensionAPI.
  extensionAPI = (input && input.extensionAPI) ? input.extensionAPI
    : (input && input.settings) ? input
    : (window.roamjsExtensionAPI || null);

  if (extensionAPI) {
    Object.keys(DEFAULTS).forEach(syncState);

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

  startObserver();
}

function onunload() {
  active = false;
  generation += 1;
  observer?.disconnect();
  observer = null;
  refresh?.cancel();
  refresh = null;
  for (const el of managedLinks.keys()) removeFavicon(el);
  Object.assign(state, DEFAULTS);
  extensionAPI = null;
}

export default { onload, onunload };
