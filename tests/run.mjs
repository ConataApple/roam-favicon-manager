import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = process.env.CHROME_BIN ? [process.env.CHROME_BIN] : [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].flatMap((name) =>
    (process.env.PATH || '').split(delimiter).filter(Boolean).map((dir) => join(dir, name))),
];
let chrome;
for (const candidate of candidates) {
  try { await access(candidate, constants.X_OK); chrome = candidate; break; } catch { /* Try the next installed browser. */ }
}
if (!chrome) throw new Error('Chrome/Chromium not found. Set CHROME_BIN to an installed browser executable.');

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname}`);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
      res.writeHead(403).end(); return;
    }
    const content = await readFile(path);
    res.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const profile = await mkdtemp(join(tmpdir(), 'favicon-manager-tests-'));
try {
  const url = `http://127.0.0.1:${server.address().port}/tests/browser.html`;
  const html = await new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', `--user-data-dir=${profile}`,
      '--dump-dom', '--virtual-time-budget=10000', url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const deadline = setTimeout(() => child.kill(), 45000);
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err = (err + chunk).slice(-10000); });
    child.once('error', (error) => { clearTimeout(deadline); reject(error); });
    child.once('close', (code) => {
      clearTimeout(deadline);
      if (code !== 0) reject(new Error(`Chrome exited with ${code}: ${err}`));
      else resolve(out);
    });
  });
  const text = html.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
  if (!text || text.includes('Running…')) throw new Error('Browser tests did not finish. Check tests/browser.html in a browser.');
  const results = JSON.parse(text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  if (!results.length) throw new Error('No browser tests ran.');
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}`);
    if (!result.pass) console.error(result.error);
  }
  const passed = results.filter((result) => result.pass).length;
  console.log(`\n${passed}/${results.length} browser tests passed (${chrome}).`);
  if (passed !== results.length) process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
