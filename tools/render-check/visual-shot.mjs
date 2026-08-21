#!/usr/bin/env node
// "도달하는가"(m4-rooms.mjs, 걷기+13개 구간 주행 테스트)와 "어떻게 보이는가"
// (이 스크립트, 스크린샷)를 분리한다 — 한 스크립트가 둘 다 맡은 게
// visual-diff 오염 사고의 뿌리였다(docs/STATE.md 참고).
//
// 걷지 않는다: 플레이어를 각 방의 고정 좌표로 텔레포트하고, 카메라 드래그도
// 하지 않는다(초기 yaw/pitch/distance 그대로 유지, config/camera.js 고정값).
// walkTo()의 0.3m 도착 허용오차가 매 실행마다 최종 정지 좌표를 흔들어
// 카메라 프레이밍이 달라지던 게 이전 비결정성의 실제 원인이었다 — 텔레포트는
// 그 오차 자체가 없다. 충분한 프레임(60+) 진행해 카메라 추적 감쇠
// (followLambda)를 정적 타깃으로 수렴시킨 뒤 그레인 uTime=0 고정하고 촬영.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2] || 'game');
const outDir = path.resolve(process.argv[3] || 'tools/render-check');

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
await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.evaluate(() => document.getElementById('audio-start-btn').click());
await sleep(1500);

// 방 중앙 좌표 — m4-rooms.mjs가 걸어서 도달을 검증하는 것과 같은 지점
// (docs/spec/M4-layout.md §2). 여긴 그 좌표로 순간이동만 한다.
// M9-C 배치1: bedA/bedB는 §11.2로 방 중앙에 새 소품(작업대/기계장치)이
// 들어앉으면서 옛 중앙 좌표가 그 소품 내부가 됐다 — 텔레포트라 충돌은
// 안 나지만 캐릭터가 소품에 파묻힌 채로 찍히므로, m4-rooms.mjs가 걷기
// 테스트용으로 옮긴 것과 같은 좌표를 그대로 쓴다(그쪽 주석 참고).
const ROOMS = [
  { id: 'living', x: 0, z: 0 },
  { id: 'bedA', x: -2.0, z: -5.0 },
  { id: 'study', x: 5.0, z: 0.5 },
  { id: 'bedB', x: -1.5, z: 5.0 },
];

async function shootRoom(room) {
  await page.evaluate(({ x, z }) => {
    const player = window.__debug.player;
    player.root.position.set(x, 0, z);
    player.root.rotation.y = 0; // 캐릭터 정면 방향도 고정 — 프레이밍엔 안 쓰이지만 재현성 위해
  }, { x: room.x, z: room.z });

  // 60+ 프레임 진행해 카메라 추적 감쇠(smoothTarget lerp)를 정적 타깃으로 수렴.
  const settleInfo = await page.evaluate(() => new Promise((resolve) => {
    const cam = window.__debug.camera;
    const THREE = window.__debug.THREE;
    const prevPos = new THREE.Vector3().copy(cam.position);
    let frame = 0;
    function tick() {
      frame++;
      const moved = cam.position.distanceTo(prevPos);
      prevPos.copy(cam.position);
      if (frame >= 60) {
        if (window.__debug.post && window.__debug.post.gradePass && window.__debug.post.gradePass.uniforms.uTime) {
          window.__debug.post.gradePass.uniforms.uTime.value = 0.0;
        }
        resolve({ frame, lastMoveDelta: moved, pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z } });
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));

  console.log(`[visual-shot] ${room.id} ${settleInfo.frame}프레임 후 카메라 pos(${settleInfo.pos.x.toFixed(4)}, ${settleInfo.pos.y.toFixed(4)}, ${settleInfo.pos.z.toFixed(4)}) 마지막 프레임 이동량=${settleInfo.lastMoveDelta.toFixed(6)}`);

  const shotPath = path.join(outDir, `m4-${room.id}.png`);
  await page.screenshot({ path: shotPath });
  return shotPath;
}

for (const room of ROOMS) {
  await shootRoom(room);
}

await browser.close();
server.close();

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('스크린샷 4장 생성 완료 (텔레포트 방식, 걷기 없음)');
