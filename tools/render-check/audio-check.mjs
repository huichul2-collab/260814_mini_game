// 오디오 게이트 검증 — puppeteer의 CDP 레벨 클릭(page.click)을 써야 한다.
// 합성 DOM 클릭(dispatchEvent)은 브라우저가 "진짜 사용자 제스처"로 안 쳐줘서
// AudioContext.resume()이 막힌다. page.click()은 실제 입력 이벤트라 통과된다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2]);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary', '.png': 'image/png',
};
function findChrome() {
  const c = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
  return c.find((p) => fs.existsSync(p));
}
function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const full = path.join(dir, p);
      fs.readFile(full, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const server = await serve(gameDir);
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) logs.push(`[http${r.status()}] ${r.url()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await new Promise((r) => setTimeout(r, 500));

const before = await page.evaluate(() => {
  try {
    const ctx = window.__debug ? null : null; // 참고용, 아래서 THREE 통해 직접 조회
  } catch {}
  return { hasButton: !!document.getElementById('audio-start-btn') };
});
console.log('시작 버튼 존재:', before.hasButton);

await page.click('#audio-start-btn');
await new Promise((r) => setTimeout(r, 3000)); // mp3 디코드 + 재생 시작 대기 (4MB라 여유있게)

const after = await page.evaluate(() => {
  const bgm = window.__debug && window.__debug.bgm;
  return {
    contextState: bgm ? bgm.context.state : 'no-bgm',
    isPlaying: bgm ? bgm.isPlaying : null,
    hasBuffer: bgm ? !!bgm.buffer : null,
    volume: bgm ? bgm.getVolume() : null,
    loadingGone: !document.getElementById('loading'),
  };
});
console.log('클릭 후 상태:', after);

console.log('로그:', logs.length ? logs : '없음');

await browser.close();
server.close();
