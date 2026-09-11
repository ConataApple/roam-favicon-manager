import { createHarness, equal, assert } from './harness.js';

const source = await (await fetch('../extension.js')).text();
const results = [];
async function test(name, initial, run, options) {
  let h;
  try {
    h = createHarness(source, initial, options);
    await run(h);
    results.push({ name, pass: true });
  } catch (error) {
    results.push({ name, pass: false, error: error.stack || String(error) });
  } finally {
    h?.dispose();
  }
}

await test('Depot wrapper creates the settings panel', {}, (h) => {
  equal(h.panels.length, 1);
  equal(h.panels[0].tabTitle, 'Favicon Manager');
});

for (const [key, value] of Object.entries({
  customIcons: 'example.com=https://icons.example/custom.png',
  fallback: 'https://icons.example/fallback.png',
  size: '24',
  spacing: '8',
})) {
  await test(`Real text input persists ${key} across reload`, {}, (h) => {
    h.input(key, value);
    equal(h.settings[key], value);
    h.extension.onunload();
    h.load();
    equal(h.settings[key], value);
    if (key === 'customIcons') assert(h.link.style.backgroundImage.includes('/custom.png'), 'Custom icon did not render');
    if (key === 'size') equal(h.link.style.backgroundSize, '24px auto');
    if (key === 'spacing') equal(h.link.style.paddingLeft, '24px');
  });
}

await test('Switching position clears the old side', {}, (h) => {
  h.select('position', 'right');
  equal(h.link.style.paddingLeft, '');
  equal(h.link.style.paddingRight, '20px');
  h.select('position', 'left');
  equal(h.link.style.paddingRight, '');
  equal(h.link.style.paddingLeft, '20px');
});

await test('Provider select still works', {}, (h) => {
  h.select('provider', 'google');
  equal(h.settings.provider, 'google');
  assert(h.link.style.backgroundImage.includes('google.com/s2/favicons'), 'Google provider not selected');
});

await test('Zero spacing remains zero after reload', { spacing: '0' }, (h) => {
  equal(h.link.style.paddingLeft, '16px');
  h.extension.onunload(); h.load();
  equal(h.link.style.paddingLeft, '16px');
});

for (const value of ['', '-2', 'NaN', 'Infinity', '20px', '1.5']) {
  await test(`Invalid numeric settings use defaults: ${JSON.stringify(value)}`, { size: value, spacing: value }, (h) => {
    equal(h.link.style.backgroundSize, '16px auto');
    equal(h.link.style.paddingLeft, '20px');
  });
}

await test('Zero size uses the default while valid large settings remain supported', { size: '0', spacing: '100' }, (h) => {
  equal(h.link.style.backgroundSize, '16px auto');
  equal(h.link.style.paddingLeft, '116px');
});

await test('Invalid stored types and retired provider values recover to defaults', {
  customIcons: { target: { value: 'bad old event' } }, fallback: false, size: false,
  spacing: false, position: 'up', provider: 'favicon.im',
}, (h) => {
  equal(h.settings.customIcons, '');
  equal(h.settings.fallback, '');
  equal(h.settings.size, '16');
  equal(h.settings.spacing, '4');
  equal(h.settings.position, 'left');
  equal(h.settings.provider, 'duckduckgo');
  equal(h.link.style.paddingLeft, '20px');
});

await test('Legacy numeric settings are preserved as strings', { size: 24, spacing: 0 }, (h) => {
  equal(h.settings.size, '24');
  equal(h.settings.spacing, '0');
  equal(h.link.style.paddingLeft, '24px');
});

await test('Synchronous persistence failure is visible without breaking rendering', {
  position: 'left', size: '16', spacing: '4', provider: 'duckduckgo', customIcons: '', fallback: '',
}, (h) => {
  h.input('size', '24');
  equal(h.link.style.backgroundSize, '24px auto');
  assert(h.warnings.length > 0, 'Persistence failure was silently swallowed');
}, { setError: new Error('Test storage failure') });

await test('Unload cancels pending debounced work', {}, async (h) => {
  h.link.append(' changed');
  await Promise.resolve();
  assert(h.timers.size > 0, 'Fixture did not queue a debounce');
  h.extension.onunload();
  equal(h.link.style.backgroundImage, '');
  h.flushTimers();
  equal(h.link.style.backgroundImage, '');
  equal(h.timers.size, 0);
});

await test('An old image error cannot repaint after unload', { fallback: 'https://icons.example/fallback.png' }, (h) => {
  const staleError = h.images[0].onerror;
  h.extension.onunload();
  staleError();
  equal(h.link.style.backgroundImage, '');
  assert(h.images.every((image) => !image.onerror && !image.onload), 'Image callbacks were not released');
});

await test('An old image error cannot overwrite new settings', { fallback: 'https://icons.example/fallback.png' }, (h) => {
  const staleError = h.images[0].onerror;
  h.select('provider', 'google');
  staleError();
  assert(h.link.style.backgroundImage.includes('google.com/s2/favicons'), 'Old request overwrote Google icon');
});

await test('An old panel callback cannot write after unload or a new load', {}, (h) => {
  const oldPanel = h.panels[0];
  h.extension.onunload();
  h.input('size', '90', oldPanel);
  equal(h.settings.size, '16');
  equal(h.link.style.backgroundImage, '');
  h.load();
  h.input('size', '90', oldPanel);
  equal(h.settings.size, '16');
  equal(h.link.style.backgroundSize, '16px auto');
});

await test('Repeated loading does not leave observers running after unload', {}, (h) => {
  h.load();
  h.extension.onunload();
  assert(h.observers.every((observer) => !observer.connected), 'An observer from an earlier load leaked');
});

await test('Loading without an API does not retain the previous graph settings', { size: '24' }, (h) => {
  h.extension.onunload(); h.load('missing');
  equal(h.link.style.backgroundSize, '16px auto');
});

await test('Unload restores original styles and priorities without changing unrelated styles', {}, (h) => {
  h.select('position', 'right');
  h.link.style.color = 'blue';
  h.extension.onunload();
  equal(h.link.style.paddingLeft, '7px');
  equal(h.link.style.paddingRight, '3px');
  equal(h.link.style.getPropertyPriority('padding-left'), 'important');
  equal(h.link.style.backgroundImage, 'linear-gradient(red, blue)');
  equal(h.link.style.color, 'blue');
}, { styles: 'padding-left: 7px !important; padding-right: 3px; background-image: linear-gradient(red, blue); color: red;' });

await test('Editing href in place updates the icon', {}, async (h) => {
  h.link.href = 'https://different.example/path';
  await h.settle();
  assert(h.link.style.backgroundImage.includes('different.example'), 'Link retained the previous domain icon');
});

await test('A link that stops opening a new tab loses the decoration', {}, async (h) => {
  h.link.target = '_self';
  await h.settle();
  equal(h.link.style.backgroundImage, '');
  equal(h.link.style.paddingLeft, '');
});

await test('Replacing the sidebar still discovers new links', {}, async (h) => {
  h.doc.querySelector('#right-sidebar').remove();
  const sidebar = h.doc.createElement('div'); sidebar.id = 'right-sidebar';
  sidebar.innerHTML = '<a target="_blank" href="https://sidebar.example">Sidebar</a>';
  h.doc.body.append(sidebar);
  await h.settle();
  assert(sidebar.querySelector('a').style.backgroundImage.includes('sidebar.example'), 'Replacement sidebar was not processed');
});

await test('A main root mounted after loading is discovered', {}, async (h) => {
  const main = h.doc.createElement('div'); main.className = 'roam-main';
  main.innerHTML = '<a target="_blank" href="https://late.example">Late root</a>';
  h.doc.body.append(main);
  await h.settle();
  assert(main.querySelector('a').style.backgroundImage.includes('late.example'), 'Late main root was not processed');
}, { html: '<div>Loading graph</div>' });

await test('Detached links are restored rather than retained', {}, async (h) => {
  h.link.remove();
  await h.settle();
  equal(h.link.style.backgroundImage, '');
  equal(h.link.style.paddingLeft, '');
});

for (const href of ['mailto:person@example.com', 'file:///tmp/example', 'javascript:void(0)']) {
  await test(`Non-HTTP link is not decorated: ${href}`, {}, (h) => {
    equal(h.link.style.backgroundImage, '');
    equal(h.images.length, 0);
  }, { html: `<div class="roam-main"><a target="_blank" href="${href}">Other scheme</a></div>` });
}

await test('Fallback order is custom, provider, fallback; exhausting all images restores the link', {
  customIcons: 'example.com=https://icons.example/custom.png', fallback: 'https://icons.example/fallback.png',
}, (h) => {
  assert(h.link.style.backgroundImage.includes('/custom.png'), 'Custom icon was not first');
  h.images.at(-1).fail();
  assert(h.link.style.backgroundImage.includes('duckduckgo.com'), 'Provider was not second');
  h.images.at(-1).fail();
  assert(h.link.style.backgroundImage.includes('/fallback.png'), 'Fallback was not third');
  h.images.at(-1).fail();
  equal(h.link.style.backgroundImage, '');
  equal(h.link.style.paddingLeft, '');
});

window.__faviconTestResults = results;
document.querySelector('#results').textContent = JSON.stringify(results, null, 2);
document.title = results.every((result) => result.pass) ? 'PASS' : 'FAIL';
