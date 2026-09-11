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

window.__faviconTestResults = results;
document.querySelector('#results').textContent = JSON.stringify(results, null, 2);
document.title = results.every((result) => result.pass) ? 'PASS' : 'FAIL';
