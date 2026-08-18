#!/usr/bin/env node
// M9-B 최종 회귀 테스트 — 방탈출 시나리오 한 사이클(단서→퍼즐→해제→진행)이
// 실제로 끝까지 도는지 자동 주행한다(docs/spec/M9-escape.md §9, §10.6).
// ⚠️ 불변 규칙 9: 이 스크립트는 "진행 가능 여부" 판정 하나만 맡는다.
// 스크린샷은 안 찍는다 — 그건 visual-shot.mjs 책임이다.
// ⚠️ window.__debug.unlockAllDoors()를 여기서 쓰지 마라. m4-rooms.mjs /
// stuck-diagnose.mjs는 "기하학적으로 지나갈 수 있는가"만 재려고 그 훅으로
// 잠금을 우회하지만, 이 스크립트는 반대다 — 잠긴 상태 자체와 그걸 실제로
// 푸는 과정이 검증 대상이다. 여기서 우회하면 이 스크립트가 존재하는
// 이유가 없어진다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { CLOCK_TIME, PUZZLES } from '../../game/story.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(process.argv[2] || path.join(scriptDir, '..', '..', 'game'));

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

let failures = 0;
function check(name, cond, detail) {
  const tag = cond ? 'OK  ' : 'FAIL';
  console.log(`${tag} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
  return cond;
}

// ---------- 1. CLOCK_TIME ↔ PUZZLES.P1.answer 대조 (순수 node, 브라우저 불필요) ----------
console.log('--- 1. CLOCK_TIME ↔ P1 정답 대조 ---');
const expectedAnswer = `${String(CLOCK_TIME.hour).padStart(2, '0')}${String(CLOCK_TIME.minute).padStart(2, '0')}`;
check(
  'CLOCK_TIME으로 계산한 4자리 == PUZZLES.P1.answer',
  expectedAnswer === PUZZLES.P1.answer,
  `계산값=${expectedAnswer} answer=${PUZZLES.P1.answer}`
);

// ---------- 브라우저 기동 ----------
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
await sleep(1000);

// ---------- 0. 이미지 절대 하한(다른 검사처럼 렌더 실패를 먼저 차단) ----------
console.log('\n--- 0. 이미지 절대 하한 검사 ---');
const shot0 = path.join(scriptDir, '_tmp-escape-flow-boot.png');
await page.screenshot({ path: shot0 });
{
  const b64 = fs.readFileSync(shot0).toString('base64');
  const abs = await page.evaluate((b64png) => new Promise((resolve) => {
    const img = document.createElement('img');
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let sumLuma = 0, nearBlack = 0, maxPixel = 0;
      const total = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        sumLuma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const maxChan = Math.max(r, g, b);
        if (maxChan < 20) nearBlack++;
        if (maxChan > maxPixel) maxPixel = maxChan;
      }
      resolve({ avgLuma: sumLuma / total, nearBlackRatio: nearBlack / total, maxPixel });
    };
    img.src = 'data:image/png;base64,' + b64png;
  }), b64);
  fs.unlinkSync(shot0); // 진단 목적 임시 캡처일 뿐 — visual-shot.mjs 영역을 침범하지 않는다
  const pass = abs.avgLuma >= 15 && abs.nearBlackRatio < 0.5 && abs.maxPixel >= 200;
  console.log(`${pass ? 'OK  ' : 'FAIL'} 절대하한: 평균휘도=${abs.avgLuma.toFixed(1)}(>=15) 검정비=${(abs.nearBlackRatio * 100).toFixed(1)}%(<50%) 최대픽셀=${abs.maxPixel}(>=200)`);
  if (!pass) {
    console.error('FAIL: 렌더 실패(검은 화면) — 나머지 검사를 건너뜁니다.');
    await browser.close();
    server.close();
    process.exit(1);
  }
}

// ---------- 페이지 컨텍스트 헬퍼 ----------
function dispatch(type, code) {
  return page.evaluate((t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), type, code);
}

async function walkToward(target, ms) {
  const held = new Set();
  async function setHeld(wanted) {
    for (const k of held) if (!wanted.has(k)) { await dispatch('keyup', k); held.delete(k); }
    for (const k of wanted) if (!held.has(k)) { await dispatch('keydown', k); held.add(k); }
  }
  const start = Date.now();
  while (Date.now() - start < ms) {
    const pos = await page.evaluate(() => {
      const p = window.__debug.player.root.position;
      return { x: p.x, z: p.z };
    });
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const wanted = new Set();
    if (dx > 0.05) wanted.add('KeyD'); else if (dx < -0.05) wanted.add('KeyA');
    if (dz > 0.05) wanted.add('KeyS'); else if (dz < -0.05) wanted.add('KeyW');
    await setHeld(wanted);
    await sleep(150);
  }
  await setHeld(new Set());
  return page.evaluate(() => {
    const p = window.__debug.player.root.position;
    return { x: p.x, z: p.z };
  });
}

// 오브젝트 근처로 텔레포트 + 정면으로 마주보게 세팅 + 카메라 감쇠 수렴 대기 +
// 그 오브젝트를 클릭할 화면 좌표 계산. interaction-check.mjs와 같은 방식
// (박스 중심을 투영 — 원점을 투영하면 바닥 픽셀을 찍어서 레이캐스트가
// 빗나갈 수 있다는 걸 M9-A에서 이미 겪었다).
async function placeAndClick(interactiveId, offsetX, offsetZ) {
  return page.evaluate(async ({ interactiveId, offsetX, offsetZ }) => {
    const { TAG } = await import('./src/core/tags.js');
    const THREE = window.__debug.THREE;
    let target = null;
    window.__debug.scene.traverse((o) => {
      if (!target && o.userData && o.userData[TAG.INTERACTIVE] === interactiveId) target = o;
    });
    if (!target) return { ok: false, reason: 'target-not-found' };

    const tPos = new THREE.Vector3();
    target.getWorldPosition(tPos);
    const box = new THREE.Box3().setFromObject(target);
    const clickPos = box.isEmpty() ? tPos : box.getCenter(new THREE.Vector3());

    const px = tPos.x + offsetX;
    const pz = tPos.z + offsetZ;
    const dx = tPos.x - px;
    const dz = tPos.z - pz;
    const facing = Math.atan2(dx, dz);

    const player = window.__debug.player;
    player.root.position.set(px, 0, pz);
    player.root.rotation.y = facing;

    await new Promise((r) => setTimeout(r, 700));

    const vector = clickPos.clone().project(window.__debug.camera);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const sx = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;
    return { ok: true, sx, sy };
  }, { interactiveId, offsetX, offsetZ });
}

async function getColliderCount() {
  return page.evaluate(() => window.__debug.getColliders().length);
}

async function isDoorUnlocked(doorId) {
  return page.evaluate(async (doorId) => {
    const state = await import('./src/story/state.js');
    return state.isDoorUnlocked(doorId);
  }, doorId);
}

// ---------- 2. 시계 바늘 각도 부호 검증 ----------
console.log('\n--- 2. 시계 바늘 각도(부호) 검증 ---');
const handCheck = await page.evaluate(async () => {
  const { computeHandAngles } = await import('./src/world/props/clock.js');
  const story = await import('./story.js');
  const expected = computeHandAngles(story.CLOCK_TIME.hour, story.CLOCK_TIME.minute);
  let hourHand = null;
  let minuteHand = null;
  window.__debug.scene.traverse((o) => {
    if (o.name === 'hourHand') hourHand = o;
    if (o.name === 'minuteHand') minuteHand = o;
  });
  return {
    expected,
    actualHour: hourHand ? hourHand.rotation.z : null,
    actualMinute: minuteHand ? minuteHand.rotation.z : null,
  };
});
const EPS = 1e-6;
check(
  '시침 rotation.z == computeHandAngles(hourAngleRad)',
  handCheck.actualHour !== null && Math.abs(handCheck.actualHour - handCheck.expected.hourAngleRad) < EPS,
  `기대=${handCheck.expected.hourAngleRad.toFixed(5)}rad(${(handCheck.expected.hourAngleRad * 180 / Math.PI).toFixed(1)}°) 실제=${handCheck.actualHour}`
);
check(
  '분침 rotation.z == computeHandAngles(minuteAngleRad)',
  handCheck.actualMinute !== null && Math.abs(handCheck.actualMinute - handCheck.expected.minuteAngleRad) < EPS,
  `기대=${handCheck.expected.minuteAngleRad.toFixed(5)}rad(${(handCheck.expected.minuteAngleRad * 180 / Math.PI).toFixed(1)}°) 실제=${handCheck.actualMinute}`
);

// ---------- 8번 절반: 해제 전 콜라이더 개수(3번 진행 전에 재는 게 안전 — 아직 아무것도 안 바뀜) ----------
const collidersBefore = await getColliderCount();

// ---------- 3. 시작 시 D2를 통과할 수 없다 ----------
console.log('\n--- 3. 시작 시 서재 진입 불가 ---');
const afterWalk = await walkToward({ x: 5.0, z: 0.5 }, 3000);
check(
  '3초 이동해도 study 영역(X>3) 진입 실패',
  afterWalk.x < 3,
  `실제(${afterWalk.x.toFixed(2)},${afterWalk.z.toFixed(2)})`
);

// ---------- 4. 시계 조사 → 대사에 시각 정보 ----------
console.log('\n--- 4. 시계 조사 ---');
const clockClick = await placeAndClick('living.clock', 1.0, 0);
if (check('시계 클릭 좌표 계산', clockClick.ok, JSON.stringify(clockClick))) {
  await page.mouse.click(clockClick.sx, clockClick.sy);
  await sleep(200);
  const dlg = await page.evaluate(() => {
    const name = document.getElementById('dialogue-name');
    const text = document.getElementById('dialogue-text');
    const box = document.getElementById('dialogue-box');
    return { open: !!box && box.style.display === 'block', name: name ? name.textContent : null, text: text ? text.textContent : null };
  });
  const hourStr = String(CLOCK_TIME.hour);
  const minuteStr = String(CLOCK_TIME.minute).padStart(2, '0');
  check(
    '시계 조사 시 대화창에 시각 정보 포함',
    dlg.open && dlg.text && dlg.text.includes(hourStr) && dlg.text.includes(minuteStr),
    `text="${dlg.text}"`
  );
  // 대화창을 직접 클릭해 닫는다(캔버스 좌표 재클릭 아님 — 그러면 같은 오브젝트를
  // 또 클릭하는 꼴이라 다음 단계 화면 좌표 계산에 방해될 수 있다).
  await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
  await sleep(350);
} else {
  failures++; // placeAndClick 실패 시에도 이 항목을 실패로 집계
}

// ---------- 5. D2 패널 클릭 → 키패드 모달 ----------
console.log('\n--- 5. D2 패널 클릭 → 모달 ---');
const panelClick = await placeAndClick('lock_D2', -1.0, 0);
check('D2 패널 클릭 좌표 계산', panelClick.ok, JSON.stringify(panelClick));
if (panelClick.ok) await page.mouse.click(panelClick.sx, panelClick.sy);
await sleep(200);
const modalOpen1 = await page.evaluate(() => !!document.getElementById('modal-overlay'));
check('키패드 모달이 뜸', modalOpen1);

// ---------- 6. 오답 입력 ----------
console.log('\n--- 6. 오답(1234) 입력 ---');
async function typeDigits(str) {
  for (const ch of str) {
    await page.click(`#modal-digit-${ch}`);
    await sleep(60);
  }
}
if (modalOpen1) {
  await typeDigits('1234');
  await sleep(200);
  const afterWrong = await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    const feedback = document.getElementById('modal-feedback');
    return { stillOpen: !!overlay, feedbackText: feedback ? feedback.textContent : null };
  });
  check('오답 후 모달이 안 닫힘(문 그대로 잠김)', afterWrong.stillOpen);
  check('오답 안내(wrongText) 표시', afterWrong.feedbackText === PUZZLES.P1.wrongText, `실제="${afterWrong.feedbackText}"`);
  const stillLocked = !(await isDoorUnlocked('D2'));
  check('오답 후 D2 여전히 잠김 상태', stillLocked);
} else {
  failures += 2;
}

// ---------- 7. 정답 입력 → 실제로 서재 진입 ----------
console.log('\n--- 7. 정답 입력 → 서재 진입 ---');
const modalStillThere = await page.evaluate(() => !!document.getElementById('modal-overlay'));
if (modalStillThere) {
  await typeDigits(PUZZLES.P1.answer);
  await sleep(300);
  const modalClosed = await page.evaluate(() => !document.getElementById('modal-overlay'));
  check('정답 입력 후 모달이 닫힘', modalClosed);

  const enteredStudy = await walkToward({ x: 5.0, z: 0.5 }, 6000);
  check(
    '정답 입력 후 실제로 걸어서 서재(X>3) 진입',
    enteredStudy.x > 3,
    `실제(${enteredStudy.x.toFixed(2)},${enteredStudy.z.toFixed(2)})`
  );
} else {
  failures += 2;
  console.error('FAIL 7번 스킵 — 6번에서 모달이 이미 닫혀 있었음');
}

// ---------- 8. 해제 후 콜라이더 개수가 패널 하나만큼 감소 ----------
console.log('\n--- 8. 콜라이더 개수 증감 ---');
const collidersAfter = await getColliderCount();
check(
  '해제 후 콜라이더 개수 = 이전 - 1',
  collidersAfter === collidersBefore - 1,
  `이전=${collidersBefore} 이후=${collidersAfter}`
);

await browser.close();
server.close();

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(failures === 0 ? '전부 통과' : `${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
