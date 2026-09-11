// Real browser DOM and MutationObserver; only the host API, image responses,
// and clock are controlled. Tests exercise the extension's public lifecycle.
export function createHarness(source, initialSettings = {}, options = {}) {
  const doc = document.implementation.createHTMLDocument('Favicon regression fixture');
  doc.body.innerHTML = options.html ?? '<div class="roam-main"><a target="_blank" href="https://example.com/page">Example</a></div><div id="right-sidebar"></div>';
  const link = doc.querySelector('a');
  if (link && options.styles) {
    link.setAttribute('style', options.styles);
  }
  const settings = { ...initialSettings };
  const panels = [];
  const images = [];
  const observers = [];
  const warnings = [];
  const writes = [];
  const timers = new Map();
  let timerId = 0;
  const api = { settings: {
    get: (key) => settings[key],
    set: (key, value) => {
      if (options.setError) throw options.setError;
      settings[key] = value;
      writes.push([key, value]);
      return options.setResult;
    },
    panel: { create: (panel) => panels.push(panel) },
  }};
  class ControlledImage {
    constructor() { images.push(this); }
    set src(url) { this.url = url; }
    fail() { this.onerror?.(); }
    succeed() { this.onload?.(); }
  }
  class TrackedObserver extends MutationObserver {
    constructor(callback) {
      super(callback);
      observers.push(this);
      this.connected = false;
    }
    observe(root, options) {
      this.connected = true;
      super.observe(root, options);
    }
    disconnect() {
      this.connected = false;
      super.disconnect();
    }
  }
  const body = source.replace(/export default\s*\{\s*onload,\s*onunload\s*\};?\s*$/, 'return { onload, onunload };');
  if (body === source) throw new Error('Expected the public onload/onunload export');
  const extension = new Function('document', 'window', 'Image', 'MutationObserver', 'setTimeout', 'clearTimeout', 'console', body)(
    doc, {}, ControlledImage, TrackedObserver,
    (fn) => { const id = ++timerId; timers.set(id, fn); return id; },
    (id) => timers.delete(id),
    { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args), log() {} },
  );
  function load(shape = options.shape ?? 'wrapped') {
    extension.onload(shape === 'wrapped' ? { extensionAPI: api } : shape === 'direct' ? api : undefined);
  }
  function action(key, panel = panels.at(-1)) {
    return panel.settings.find((item) => item.id === key).action;
  }
  function input(key, value, panel) {
    const field = doc.createElement('input');
    field.type = 'text';
    field.value = value;
    let thrown;
    field.addEventListener('input', (event) => {
      try { action(key, panel).onChange(event); } catch (error) { thrown = error; }
    });
    field.dispatchEvent(new Event('input', { bubbles: true }));
    if (thrown) throw thrown;
  }
  function select(key, value, panel) {
    const field = doc.createElement('select');
    const option = doc.createElement('option');
    option.value = value; option.textContent = value;
    field.append(option);
    action(key, panel).onChange({ target: field });
  }
  function flushTimers() {
    const queued = [...timers];
    timers.clear();
    for (const [, fn] of queued) fn();
  }
  async function settle() {
    // MutationObserver delivery is a microtask; debounce uses our controlled clock.
    await Promise.resolve();
    flushTimers();
    await Promise.resolve();
  }
  function dispose() {
    extension.onunload();
    observers.forEach((observer) => observer.disconnect());
    timers.clear();
  }
  load();
  return { doc, link, settings, api, panels, images, observers, warnings, writes, timers, extension, load, action, input, select, settle, flushTimers, dispose };
}

export function equal(actual, expected, message = '') {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
