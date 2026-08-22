import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const full = path.join(gameDir, p);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--use-gl=swiftshader', '--no-sandbox'],
  });
  // 검사 도중 예외가 나도 chrome.exe가 안 남게 finally에서 닫는다. exit/SIGINT
  // 훅은 그마저 못 지나간 경우(강제 종료 등)를 위한 마지막 안전망이다.
  let browserClosed = false;
  async function closeBrowser() {
    if (browserClosed) return;
    browserClosed = true;
    await browser.close().catch(() => {});
  }
  process.on('exit', () => {
    if (!browserClosed) browser.process()?.kill('SIGKILL');
  });
  process.on('SIGINT', async () => {
    await closeBrowser();
    server.close();
    process.exit(1);
  });

  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 1000));
    const n = await page.evaluate(() => window.__debug.getColliders().length);
    console.log('실제 콜라이더 개수:', n);
  } finally {
    await closeBrowser();
    server.close();
  }
});
