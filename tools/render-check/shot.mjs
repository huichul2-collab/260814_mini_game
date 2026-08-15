// 렌더 검증 하네스 — 정적 서버 + 헤드리스 Chrome/Edge 스크린샷 + 콘솔 에러 수집
// 사용법: node shot.mjs <game 폴더 절대경로> <출력 png 경로> [대기ms]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const [, , gameDirArg, outPngArg, waitMsArg, pagePathArg] = process.argv;
if (!gameDirArg || !outPngArg) {
  console.error('usage: node shot.mjs <gameDir> <outPng> [waitMs] [pagePath]');
  process.exit(1);
}
const gameDir = path.resolve(gameDirArg);
const outPng = path.resolve(outPngArg);
const waitMs = Number(waitMsArg || 1500);
const pagePath = pagePathArg ? pagePathArg.replace(/^\//, '') : '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
};

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const full = path.join(dir, p);
      if (!full.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(full, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found: ' + p); return; }
        const ext = path.extname(full).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const exe = findChrome();
if (!exe) {
  console.error('FAIL: no local Chrome/Edge executable found');
  process.exit(2);
}

const server = await serve(gameDir);
const port = server.address().port;
const url = `http://127.0.0.1:${port}/${pagePath}`;

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText || ''}`));
page.on('response', (res) => { if (res.status() >= 400) logs.push(`[http${res.status()}] ${res.url()}`); });

let webglInfo = null;
try {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await new Promise((r) => setTimeout(r, waitMs));
  webglInfo = await page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { ok: false, reason: 'no webgl context' };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        ok: true,
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  });
  await page.screenshot({ path: outPng });
} catch (e) {
  logs.push(`[fatal] ${e.message}`);
} finally {
  await browser.close();
  server.close();
}

console.log('chrome executable:', exe);
console.log('webgl:', JSON.stringify(webglInfo));
console.log('console/page logs:');
for (const l of logs) console.log(' ', l);
console.log('screenshot written to:', outPng, fs.existsSync(outPng) ? `(${fs.statSync(outPng).size} bytes)` : '(MISSING)');
