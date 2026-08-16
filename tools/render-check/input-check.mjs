// 키가 눌린 채 안 풀리는 버그 재현 시도 — player/input.js는 keydown/keyup
// Set 추가/삭제 + blur 클리어뿐이라, 이론적으로 keyup을 못 받는 경로가
// 있으면 축이 0으로 안 돌아온다. 두 갈래로 재현을 시도한다:
//   ① 키보드만: W/A 두 키의 down/up을 "각 키의 up은 반드시 그 키의 down
//      뒤"라는 물리적 제약 안에서 가능한 모든 인터리빙(6가지)으로 조합
//   ② 드래그 중 키 입력: 카메라 드래그(pointerdown~pointerup)가 실제
//      user-gesture 마우스 이벤트라 브라우저/OS가 키보드 이벤트를 삼킬
//      가능성이 유력한 원인으로 지목됨 — pointerdown/up 전후로 키를
//      누르고 떼는 시나리오 4가지를 추가로 시험
// 매 조합 끝에 getMoveAxis()가 {x:0,z:0}인지만 확인한다(중간 상태는 안 봄).
// 재현되면 실패로 보고하고 고친다. 재현이 안 되면 방어책(캡처 리스닝,
// visibilitychange, Escape 클리어)만 넣고 "재현 실패"라고 정직하게 보고한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.mp3': 'audio/mpeg',
};
function findChrome() {
  const c = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
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
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(800);
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 }).catch(() => {});
await page.click('#audio-start-btn').catch(() => {});
await sleep(300);

function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code);
}
function axis() {
  return page.evaluate(() => {
    // input.js는 getMoveAxis만 export하고 main.js/controller.js를 거쳐야
    // 접근 가능하다 — window.__debug에는 없으므로 모듈을 동적 import한다.
    // 이미 로드된 인스턴스를 다시 import해도 ESM 캐시라 같은 keys Set을 본다.
    return import('./src/player/input.js').then((m) => m.getMoveAxis());
  });
}
async function dragStart(x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
}
async function dragMove(x, y) {
  await page.mouse.move(x, y, { steps: 3 });
}
async function dragEnd() {
  await page.mouse.up();
}

const results = [];
async function run(name, steps) {
  for (const step of steps) await step();
  await sleep(60);
  const a = await axis();
  const ok = a.x === 0 && a.z === 0;
  results.push({ name, ok, a });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} → axis={x:${a.x}, z:${a.z}}`);
  // 다음 조합에 새지 않도록 혹시 남은 키를 확실히 정리(테스트 하네스 자체의
  // 오염 방지 목적이지, 프로덕션 동작 검증이 아니다).
  await keyUp('KeyW'); await keyUp('KeyA');
  await sleep(30);
}

console.log('--- ① 키보드만: W/A 다운/업 인터리빙 6가지 ---');
const sequences = [
  ['Wd', 'Wu', 'Ad', 'Au'],
  ['Wd', 'Ad', 'Wu', 'Au'],
  ['Wd', 'Ad', 'Au', 'Wu'],
  ['Ad', 'Wd', 'Wu', 'Au'],
  ['Ad', 'Wd', 'Au', 'Wu'],
  ['Ad', 'Au', 'Wd', 'Wu'],
];
const evt = { Wd: () => keyDown('KeyW'), Wu: () => keyUp('KeyW'), Ad: () => keyDown('KeyA'), Au: () => keyUp('KeyA') };
for (const seq of sequences) {
  await run(`W/A ${seq.join('→')}`, seq.map((s) => evt[s]));
}

console.log('');
console.log('--- ② 드래그 중 키 입력 4가지 ---');
await run('드래그 중 W다운→W업→드래그종료', [
  () => dragStart(480, 300),
  () => keyDown('KeyW'),
  () => dragMove(520, 320),
  () => keyUp('KeyW'),
  () => dragEnd(),
]);
await run('드래그 중 W다운→드래그종료→W업(드래그 끝난 뒤 뗌)', [
  () => dragStart(480, 300),
  () => keyDown('KeyW'),
  () => dragMove(520, 320),
  () => dragEnd(),
  () => keyUp('KeyW'),
]);
await run('W다운(드래그 전)→드래그 시작~종료→W업', [
  () => keyDown('KeyW'),
  () => dragStart(480, 300),
  () => dragMove(520, 320),
  () => dragEnd(),
  () => keyUp('KeyW'),
]);
await run('드래그 중 W+A 다운, 드래그 종료 후 W+A 업', [
  () => dragStart(480, 300),
  () => keyDown('KeyW'),
  () => keyDown('KeyA'),
  () => dragMove(440, 260),
  () => dragMove(400, 340),
  () => dragEnd(),
  () => keyUp('KeyW'),
  () => keyUp('KeyA'),
]);

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');

const failed = results.filter((r) => !r.ok);
console.log(`총 ${results.length}개 조합, 재현(실패) ${failed.length}개`);
if (failed.length) {
  console.log('재현된 조합:', failed.map((f) => f.name).join(' / '));
}

await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
