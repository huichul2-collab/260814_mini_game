// 휠 줌 검증 — page.mouse.wheel()로 실제 휠 이벤트를 보내고 카메라 거리 변화를 확인.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2]);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png',
};
function findChrome() {
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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
await page.setViewport({ width: 960, height: 600 });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await new Promise((r) => setTimeout(r, 800));
// gate.js가 에셋 로딩 끝나기 전엔 버튼을 disabled로 둔다 — disabled 상태
// 클릭은 브라우저가 무시하므로 활성화될 때까지 기다린 뒤 누른다.
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#audio-start-btn'); // #loading 오버레이가 캔버스를 덮고 있어 휠을 먼저 가로챈다 — 시작 버튼부터 눌러야 함
await new Promise((r) => setTimeout(r, 600));

function camDist() {
  return page.evaluate(() => {
    const p = window.__debug.player.root.position;
    const c = window.__debug.camera.position;
    return Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z);
  });
}

const initial = await camDist();
console.log('초기 카메라-플레이어 거리:', initial.toFixed(3));

await page.mouse.move(480, 300);
for (let i = 0; i < 15; i++) {
  await page.mouse.wheel({ deltaY: -100 }); // 음수 deltaY = 줌인(휠 위로)
  await new Promise((r) => setTimeout(r, 60));
}
await new Promise((r) => setTimeout(r, 500));
const zoomedIn = await camDist();
console.log('줌인 15회 후 거리:', zoomedIn.toFixed(3), zoomedIn < initial ? '(가까워짐 OK)' : '(변화 없음 FAIL)');

for (let i = 0; i < 40; i++) {
  await page.mouse.wheel({ deltaY: 100 }); // 줌아웃
  await new Promise((r) => setTimeout(r, 60));
}
await new Promise((r) => setTimeout(r, 500));
const zoomedOut = await camDist();
console.log('줌아웃 40회 후 거리:', zoomedOut.toFixed(3), zoomedOut > zoomedIn ? '(멀어짐 OK)' : '(변화 없음 FAIL)');
console.log(`→ minDistance(1.8)/maxDistance(8.5) 근처에서 클램프됐는지: 줌인=${zoomedIn.toFixed(2)}, 줌아웃=${zoomedOut.toFixed(2)}`);

await page.screenshot({ path: path.join(gameDir, '..', 'tools', 'render-check', 'zoom-out.png') });

console.log('에러:', logs.length ? logs : '없음');
await browser.close();
server.close();
