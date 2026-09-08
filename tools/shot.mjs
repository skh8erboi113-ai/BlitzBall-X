/**
 * Headless screenshot / smoke-test harness.
 * Usage: node tools/shot.mjs <url> <outfile> [script]
 *   script: a JS snippet evaluated in the page after load (async allowed), e.g. "await window.__test.play()"
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';

const [,, url, out, script] = process.argv;
const width = parseInt(process.env.W || '1280', 10);
const height = parseInt(process.env.H || '720', 10);

// The bundled chromium needs NSS libs shipped in al2023.tar.br; extract once.
const libDir = '/tmp/al2023/lib';
if (!fs.existsSync(libDir)) {
  const src = path.resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br');
  fs.mkdirSync('/tmp/al2023', { recursive: true });
  fs.writeFileSync('/tmp/al2023/al2023.tar', zlib.brotliDecompressSync(fs.readFileSync(src)));
  execSync('tar -xf /tmp/al2023/al2023.tar -C /tmp/al2023');
}
process.env.LD_LIBRARY_PATH = `${libDir}:/tmp:${process.env.LD_LIBRARY_PATH || ''}`;

chromium.setGraphicsMode = true;
const browser = await puppeteer.launch({
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width, height },
  executablePath: await chromium.executablePath(),
  headless: 'shell',
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  const t = m.type();
  if (t === 'error' || t === 'warning') console.log(`[page:${t}]`, m.text());
  else if (process.env.VERBOSE) console.log('[page]', m.text());
});
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.stack || e.message); });
page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
if (script) {
  try {
    await page.evaluate(`(async () => { ${script} })()`);
  } catch (e) {
    console.log('[script error]', e.message);
    errors.push(e.message);
  }
}
await new Promise((r) => setTimeout(r, parseInt(process.env.WAIT || '300', 10)));
await page.screenshot({ path: out });
console.log('saved', out, errors.length ? `with ${errors.length} error(s)` : 'clean');
await browser.close();
process.exit(errors.length ? 1 : 0);
