#!/usr/bin/env node
// M4 집 4칸 구조 검증 — 방 4개 중앙 도달성 + 문 가장자리(0.25m 안쪽) 통과성.
// docs/spec/M4-layout.md §6.2 수용기준을 실제 주행(인공 키 입력)으로 검증한다.
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

let failures = 0;
let logs = [];
try {
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
page.on('pageerror', (e) => {
  if (!e.message.includes('linearRampToValueAtTime')) logs.push(`[pageerror] ${e.message}`);
});
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console.error] ${m.text()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.evaluate(() => {
  const btn = document.getElementById('audio-start-btn');
  if (btn) btn.click();
});
await sleep(2000);
await page.waitForSelector('#loading', { hidden: true, timeout: 10000 }).catch(() => {});
await sleep(500);
const loadingStillThere = await page.evaluate(() => !!document.getElementById('loading'));
console.log('[m4-rooms] loading element still in DOM:', loadingStillThere);

// M9-B로 D2가 잠기면서 study 관련 구간이 걸어서는 통과 불가능해졌다.
// 이 스크립트가 묻는 건 "기하학적으로 지나갈 수 있는가"이지 "퍼즐을
// 풀었는가"가 아니다(그건 escape-flow.mjs 몫, 불변 규칙 9) — 그래서
// 주행 시작 전에 검증 전용 훅으로 문을 전부 열어 잠금과 분리한다.
await page.evaluate(() => window.__debug.unlockAllDoors());

function getPos() {
  return page.evaluate(() => {
    if (!window.__debug || !window.__debug.player || !window.__debug.player.root || !window.__debug.player.root.position) return null;
    const p = window.__debug.player.root.position;
    if (typeof p.x !== 'number' || typeof p.z !== 'number') return null;
    return { x: p.x, z: p.z };
  });
}
function keyDown(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
}
function keyUp(code) {
  return page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
}

async function walkTo(target, { tol = 0.3, timeoutMs = 20000, pollMs = 150 } = {}) {
  const held = new Set();
  async function setHeld(wanted) {
    for (const k of held) if (!wanted.has(k)) { await keyUp(k); held.delete(k); }
    for (const k of wanted) if (!held.has(k)) { await keyDown(k); held.add(k); }
  }
  const start = Date.now();
  let pos = await getPos();
  while (!pos && Date.now() - start < timeoutMs) {
    await sleep(200);
    pos = await getPos();
  }
  if (!pos) return { ok: false, pos: { x: 0, z: 0 }, ms: timeoutMs };

  while (Date.now() - start < timeoutMs) {
    pos = await getPos();
    if (!pos) { await sleep(pollMs); continue; }
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    if (Math.hypot(dx, dz) < tol) { await setHeld(new Set()); return { ok: true, pos, ms: Date.now() - start }; }
    const wanted = new Set();
    if (dx > 0.05) wanted.add('KeyD'); else if (dx < -0.05) wanted.add('KeyA');
    if (dz > 0.05) wanted.add('KeyS'); else if (dz < -0.05) wanted.add('KeyW');
    await setHeld(wanted);
    await sleep(pollMs);
  }
  await setHeld(new Set());
  return { ok: false, pos: (await getPos()) || { x: 0, z: 0 }, ms: Date.now() - start };
}

// ⚠️ 이 스크립트는 "주행 테스트(13개 구간 도달)" 전용이다. 스크린샷은
// visual-shot.mjs가 텔레포트로 따로 찍는다 — 한 스크립트가 "도달하는가"와
// "어떻게 보이는가"를 동시에 맡은 게 이전 visual-diff 오염 사고의 뿌리였다
// (walkTo()의 0.3m 도착 허용오차 때문에 걸어서 도착한 최종 좌표가 매 실행
// 마다 미세하게 달라져 카메라 프레이밍이 흔들렸다). docs/STATE.md 참고.
// via: 문D1 옆(책상 북쪽 벽밀착 구석)은 목표(0,0)로 바로 직선 이동하면
// 대각선 입력이 책상 모서리+벽 사이 코너에 걸려 멈춘다(정상적인 코너
// 막힘 — 입력을 반대로 바꾸면 실제로 빠져나오는 것도 확인됨, docs/STATE.md
// 참고). "이론상 통과 가능한 경로만 테스트한다"는 원칙에 따라, 그 코너를
// 그냥 지나치는 경유점을 거쳐 목표로 간다 — 회귀 은폐가 아니라 애초에
// 통과 못 하는 대각선 지름길 대신 실제 사람도 걷는 정상 경로로 바꾼 것.
async function leg(name, target, { via = [] } = {}) {
  for (const wp of via) {
    const vr = await walkTo(wp);
    if (!vr.ok) {
      console.log(`FAIL ${name}(경유점 ${wp.x},${wp.z} 도달 실패) → 실제(${vr.pos.x.toFixed(2)},${vr.pos.z.toFixed(2)})`);
      failures++;
      return vr;
    }
  }
  const r = await walkTo(target);
  const tag = r.ok ? 'OK ' : 'FAIL';
  if (!r.ok) failures++;
  const px = (r && r.pos && typeof r.pos.x === 'number') ? r.pos.x.toFixed(2) : '0.00';
  const pz = (r && r.pos && typeof r.pos.z === 'number') ? r.pos.z.toFixed(2) : '0.00';
  const ms = r ? r.ms : 0;
  console.log(`${tag} ${name} → 목표(${target.x},${target.z}) 실제(${px},${pz}) ${ms}ms`);
  return r;
}

// bedA/D1 쪽에서 living(0,0)으로 바로 대각선으로 가면 책상 북쪽 모서리
// 코너에 걸린다 — 문D1 중앙(-0.5,-3.3) → 책상 Z대역을 벗어난 지점
// (-0.5,-2.0)을 거쳐 간다(실측으로 이 경로가 막힘 없이 통과되는 것 확인).
const VIA_D1_TO_LIVING = [{ x: -0.5, z: -3.3 }, { x: -0.5, z: -2.0 }];

console.log('--- 방 중앙 도달 ---');
await sleep(2000);
await leg('living(spawn 확인)', { x: 0, z: 0 });
// M9-C 배치1: 공방(bedA) 방 중앙(-0.5,-5.0)에 작업대(workbench)가 §11.2대로
// 정확히 들어앉으면서 옛 목표점이 이제 가구 안이 됐다 — 가구를 피해 방
// 서쪽 빈 공간으로 목표를 옮긴다. D1 문 근처(-0.9,-3.6)는 이미 검증된
// 진입 경로라 그 지점을 경유해서 간다(실측으로 작업대를 건드리지 않고
// 통과되는 것 확인).
await leg('bedA', { x: -2.0, z: -5.0 }, { via: [{ x: -0.9, z: -3.6 }] });
await leg('bedA→living', { x: 0, z: 0 }, { via: VIA_D1_TO_LIVING });
await leg('study', { x: 5.0, z: 0.5 });
await leg('study→living', { x: 0, z: 0 });
// M9-C 배치1: 보관소(bedB) 방 한가운데(0,5.2)에 기계장치(machine)가
// §11.2대로 들어앉으면서 옛 목표점이 가구 안이 됐다 — 방 서쪽으로 옮긴다.
// (0,0)에서 목표로 바로 대각선으로 가면 D3 개구부(X[-0.65,0.65]) 바깥의
// 벽에 먼저 걸린다 — 문 중앙을 먼저 지나는 경유점을 거쳐 간다.
await leg('bedB', { x: -1.5, z: 5.0 }, { via: [{ x: 0, z: 3.6 }] });
await leg('bedB→living', { x: 0, z: 0 });

console.log('--- 문 가장자리 통과(0.25m 안쪽) ---');
await leg('D1 가장자리 → bedA', { x: -0.9, z: -3.6 });
await leg('D1 가장자리 → living', { x: 0, z: 0 }, { via: VIA_D1_TO_LIVING });
await leg('D2 가장자리 → study', { x: 5.0, z: 0.1 });
await leg('D2 가장자리 → living', { x: 0, z: 0 });
// M9-C 배치1: 목표(-0.4,5.0)가 기계장치 콜라이더 코앞이라 이 폴링 기반
// 테스트에서는 우연히 tol(0.3m) 안쪽에서 멈춰 통과했지만, 실제로는 거의
// 붙어서 막히는 상태라 불안정하다 — 문 바로 안쪽(z=3.6)으로 당긴다
// (stuck-diagnose.mjs 프레임 단위 테스트에서 여기서 실제 STUCK 재현됨).
await leg('D3 가장자리 → bedB', { x: -0.4, z: 3.6 });
await leg('D3 가장자리 → living', { x: 0, z: 0 });
} finally {
  await closeBrowser();
  server.close();
}

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(`총 13개 구간, 실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
