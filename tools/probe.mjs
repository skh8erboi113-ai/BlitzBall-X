/**
 * Runtime probe: repeated matches, GPU context churn, JS heap, frame timing, console output.
 * Usage: node tools/probe.mjs [url]
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'http://localhost:4173/';
process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:/tmp:${process.env.LD_LIBRARY_PATH || ''}`;
chromium.setGraphicsMode = true;
const browser = await puppeteer.launch({
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'],
  defaultViewport: { width: 1280, height: 720 },
  executablePath: await chromium.executablePath(),
  headless: 'shell',
});
const page = await browser.newPage();
const msgs = [];
page.on('console', (m) => msgs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => msgs.push(`pageerror: ${e.stack || e.message}`));

// Count WebGL contexts created vs explicitly released.
await page.evaluateOnNewDocument(() => {
  window.__ctx = { created: 0, lost: 0 };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /webgl/.test(type)) {
      window.__ctx.created++;
      this.addEventListener('webglcontextlost', () => window.__ctx.lost++);
      const origLose = ctx.getExtension && ctx.getExtension('WEBGL_lose_context');
      if (origLose) {
        const origForce = origLose.loseContext.bind(origLose);
        origLose.loseContext = () => { window.__ctx.lost++; origForce(); };
      }
    }
    return ctx;
  };
});

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => { window.app.audio.unlock = () => {}; });

const heap = () => page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1));

const ROUNDS = 6;
const samples = [];
for (let r = 0; r < ROUNDS; r++) {
  await page.evaluate(() => {
    const app = window.app;
    const T = app.teams;
    app.startMatch({ home: T[0], away: T[3], userTeam: 0, mode: "quick" });
  });
  // Render a few frames, then jump the sim to full time.
  await page.evaluate(() => {
    const m = window.app.match;
    for (let i = 0; i < 120; i++) { m.sim.step(1 / 60); m.renderer.update(1 / 60); }
    m.renderer.render();
  });
  const t0 = Date.now();
  const frames = await page.evaluate(() => {
    const m = window.app.match;
    const t = performance.now();
    for (let i = 0; i < 30; i++) m.renderer.render();
    return (performance.now() - t) / 30;
  });
  const ctxs = await page.evaluate(() => ({ ...window.__ctx }));
  samples.push({ round: r + 1, msPerFrame: +frames.toFixed(1), heapMB: await heap(), ...ctxs, wallMs: Date.now() - t0 });
  // Quit back to the menu the way a player would.
  await page.evaluate(() => window.app.go('title'));
  await new Promise((res) => setTimeout(res, 250));
}

console.log(JSON.stringify(samples, null, 1));
const last = samples[samples.length - 1];
console.log(`contexts: created=${last.created} released=${last.lost} live=${last.created - last.lost}`);
console.log(`heap: ${samples.map((s) => s.heapMB).join(' -> ')} MB`);
const uniq = [...new Set(msgs)];
console.log(`console messages (${uniq.length}):`);
for (const m of uniq.slice(0, 25)) console.log('  ', m.slice(0, 220));
await browser.close();
