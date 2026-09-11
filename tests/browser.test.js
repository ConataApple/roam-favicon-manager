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

window.__faviconTestResults = results;
document.querySelector('#results').textContent = JSON.stringify(results, null, 2);
document.title = results.every((result) => result.pass) ? 'PASS' : 'FAIL';
