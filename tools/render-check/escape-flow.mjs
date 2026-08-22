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
import { CLOCK_TIME, PUZZLES, ENDING_TEXT, OBJECTS, NEWS_CLIPPINGS } from '../../game/story.js';

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

const ABORT = Symbol('abort'); // 0번 절대 하한 실패 시 나머지 검사를 건너뛰는 신호
const logs = [];
try {
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 600 });
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
    failures++;
    throw ABORT;
  }
}

// ---------- 페이지 컨텍스트 헬퍼 ----------
function dispatch(type, code) {
  return page.evaluate((t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c })), type, code);
}

async function walkToward(target, maxMs = 5000, targetRadius = 0.3) {
  const held = new Set();
  async function setHeld(wanted) {
    for (const k of held) if (!wanted.has(k)) { await dispatch('keyup', k); held.delete(k); }
    for (const k of wanted) if (!held.has(k)) { await dispatch('keydown', k); held.add(k); }
  }
  const start = Date.now();
  const history = [];
  let arrived = false;
  let reason = 'timeout';
  let finalPos = { x: 0, z: 0 };

  try {
    while (Date.now() - start < maxMs) {
      const pos = await page.evaluate(() => {
        const p = window.__debug?.player?.root?.position;
        return p ? { x: p.x, z: p.z } : null;
      });
      if (!pos) {
        await sleep(100);
        continue;
      }
      finalPos = pos;

      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= targetRadius) {
        arrived = true;
        reason = 'reached';
        break;
      }

      history.push(pos);
      if (history.length > 5) {
        history.shift();
        const oldPos = history[0];
        const moved = Math.hypot(pos.x - oldPos.x, pos.z - oldPos.z);
        if (moved < 0.03) {
          arrived = false;
          reason = 'stuck';
          break;
        }
      }

      const wanted = new Set();
      if (dx > 0.05) wanted.add('KeyD'); else if (dx < -0.05) wanted.add('KeyA');
      if (dz > 0.05) wanted.add('KeyS'); else if (dz < -0.05) wanted.add('KeyW');
      await setHeld(wanted);
      await sleep(150);
    }
  } finally {
    await setHeld(new Set());
  }

  const currentPos = (await page.evaluate(() => {
    const p = window.__debug?.player?.root?.position;
    return p ? { x: p.x, z: p.z } : null;
  })) || finalPos;

  return {
    arrived,
    reason,
    pos: currentPos,
    x: currentPos.x,
    z: currentPos.z,
    ms: Date.now() - start,
  };
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

    // 배치2부터 방을 넘나드는 큰 점프(예: 공방→거실)가 생겨 카메라
    // 추적 감쇠(smoothTarget)가 수렴하는 데 700ms로는 부족한 경우가
    // 실측으로 확인됐다(D3 클릭 좌표가 화면 밖으로 계산됨) — 여유를 둔다.
    await new Promise((r) => setTimeout(r, 1200));

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

// M9-E(E-3) — 캐비닛 개봉 flag(story.js 'cabinet_opened') 확인용.
async function hasStoryFlag(flagId) {
  return page.evaluate(async (flagId) => {
    const state = await import('./src/story/state.js');
    return state.hasFlag(flagId);
  }, flagId);
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
  !afterWalk.arrived && afterWalk.x < 3,
  `실제(${afterWalk.x.toFixed(2)},${afterWalk.z.toFixed(2)}) reason=${afterWalk.reason}`
);

// ---------- 4. 시계 조사 → 대사에 시각 정보 ----------
console.log('\n--- 4. 시계 조사 ---');
// M9-C 배치1: §11.2로 시계가 서벽(-2.90)에서 동벽(2.90)으로 옮겨갔다 —
// 방 안쪽(서쪽)에서 접근해야 하므로 오프셋 부호를 뒤집는다(offsetX=+1.0
// 이었을 때는 동벽 바깥 X=3.90, 즉 벽 너머로 텔레포트돼 클릭이 실패했다).
const clockClick = await placeAndClick('living.clock', -1.0, 0);
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
    enteredStudy.arrived && enteredStudy.x > 3,
    `실제(${enteredStudy.x.toFixed(2)},${enteredStudy.z.toFixed(2)}) reason=${enteredStudy.reason}`
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

// ---------- 페이지 컨텍스트 헬퍼(배치2) ----------
async function getInventory() {
  return page.evaluate(async () => {
    const state = await import('./src/story/state.js');
    return state.getInventory();
  });
}

const ARROW_ID = { '↑': 'up', '↓': 'down', '←': 'left', '→': 'right' };
async function pressKeypad(type, str) {
  for (const ch of str) {
    let sel;
    if (type === 'digits') sel = `#modal-digit-${ch}`;
    else if (type === 'letters') sel = `#modal-letter-${ch}`;
    else if (type === 'arrows') sel = `#modal-arrow-${ARROW_ID[ch]}`;
    await page.click(sel);
    await sleep(60);
  }
}

// M9-E(E-4, §12.6) — 다이얼 입력. segments는 [['L',3],['R',4],['L',1]]
// 같은 배열 — 방향 버튼을 그 횟수만큼 클릭한다(방향 전환 자체가 구간
// 확정이라 별도 "확정" 버튼은 없다). confirm=true면 마지막에 #modal-
// dial-confirm까지 눌러 판정을 요청한다(오답 테스트는 확인까지 눌러야
// "헛돈다" 피드백이 뜬다 — modal.js가 그렇게 설계됨, 자릿수 채우자마자
// 자동 판정하는 digits/arrows/letters와 다르다).
async function pressDial(segments, { confirm = true } = {}) {
  for (const [dir, count] of segments) {
    const sel = dir === 'L' ? '#modal-dial-left' : '#modal-dial-right';
    for (let i = 0; i < count; i++) {
      await page.click(sel);
      await sleep(40);
    }
  }
  if (confirm) {
    await page.click('#modal-dial-confirm');
    await sleep(150);
  }
}

// 2026-08-23: probe.js가 레이캐스트에서 플레이어 자신을 제외하도록
// 고쳐지면서, "카메라 코앞까지 당겨져 화면 좌표가 깨지는" 문제 중
// 캐릭터 자기 몸 가림이 원인이던 것들(기계장치)은 이 우회 없이도
// 해결됐다. D3·조립머신은 그것과 별개로 남벽 벽 충돌 자체가 원인
// 이라 아직 남아있다(docs/STATE.md 열린 작업 참고 — M9-D 이후 카메라
// pitch·거리 튜닝으로 다룰 문제). 드래그로 yaw를 180도 돌려 카메라를
// 벽 반대쪽에 두는 임시 우회를 그 두 곳에만 계속 쓴다 — 걷기는 카메라
// yaw 기준이라(controller.js) 볼일이 끝나면 반드시 원래대로 돌려놔야
// 한다.
const YAW_FLIP_DX = 524; // Δyaw=π가 되는 드래그 픽셀량(dragSensitivity=0.006 기준 실측)
async function dragYawBy(dxPixels) {
  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.mouse.move(700 + dxPixels, 300, { steps: 5 });
  await page.mouse.up();
  await sleep(50);
}

// placeAndClick()은 텔레포트 "직후"(카메라가 아직 안 움직인) 좌표를 쓴다 —
// yaw를 드래그로 돌리고 카메라가 다시 수렴하길 기다린 *뒤에* 좌표를 다시
// 계산해야 하는 경우(D3, 조립머신) 이 함수로 현재 카메라 기준 좌표만
// 새로 뽑는다(텔레포트는 이미 placeAndClick이 해준 뒤).
async function computeClickCoords(interactiveId) {
  return page.evaluate(async ({ interactiveId }) => {
    const { TAG } = await import('./src/core/tags.js');
    const THREE = window.__debug.THREE;
    let target = null;
    window.__debug.scene.traverse((o) => { if (!target && o.userData && o.userData[TAG.INTERACTIVE] === interactiveId) target = o; });
    if (!target) return { ok: false, reason: 'target-not-found' };
    const tPos = new THREE.Vector3();
    target.getWorldPosition(tPos);
    const box = new THREE.Box3().setFromObject(target);
    const clickPos = box.isEmpty() ? tPos : box.getCenter(new THREE.Vector3());
    const vector = clickPos.clone().project(window.__debug.camera);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const sx = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;
    return { ok: true, sx, sy };
  }, { interactiveId });
}

// ---------- 8-A. 나무상자 2회 조사 → visitedAtLeast variants(M9-E E-1) ----------
console.log('\n--- 8-A. 나무상자 2회 조사(1회차/2회차 설명 다름) ---');
{
  const crateClick = await placeAndClick('bedA.crate1', 0.6, 1.0);
  if (check('나무상자 클릭 좌표 계산', crateClick.ok, JSON.stringify(crateClick))) {
    await page.mouse.click(crateClick.sx, crateClick.sy);
    await sleep(200);
    const first = await page.evaluate(() => {
      const t = document.getElementById('dialogue-text');
      return t ? t.textContent : null;
    });
    check('1회차 설명', first === '밑에 뭔가 쓰여 있을까? 들어볼까.', `실제="${first}"`);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);

    await page.mouse.click(crateClick.sx, crateClick.sy);
    await sleep(200);
    const second = await page.evaluate(() => {
      const t = document.getElementById('dialogue-text');
      return t ? t.textContent : null;
    });
    check('2회차 설명(1회차와 다름)', second === '힘들게 들었다. 아무것도 쓰여 있지 않다.', `실제="${second}"`);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
  } else {
    failures += 2;
  }
}

// ---------- 8-B. 알 수 없는 기계 조사(열쇠조각 0개) → variants 기본 항목 ----------
console.log('\n--- 8-B. 알 수 없는 기계 조사(열쇠조각 0개) ---');
{
  // 조립머신은 거실 남벽에 있어 D3와 같은 이유로 카메라 벽 충돌이
  // 생긴다 — yaw 180도 우회(위 helper 참고).
  const click0pre = await placeAndClick('living.assembler', 0.6, -1.0);
  await dragYawBy(-YAW_FLIP_DX);
  await sleep(1200);
  const click0 = await computeClickCoords('living.assembler');
  if (check('알 수 없는 기계 클릭 좌표 계산(0개)', click0pre.ok && click0.ok, JSON.stringify({ click0pre, click0 }))) {
    await page.mouse.click(click0.sx, click0.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const name = document.getElementById('dialogue-name');
      const text = document.getElementById('dialogue-text');
      return { name: name ? name.textContent : null, text: text ? text.textContent : null };
    });
    check('이름이 "알 수 없는 기계"', dlg.name === '알 수 없는 기계', `실제="${dlg.name}"`);
    check('열쇠조각 0개 상태 기본 설명', dlg.text === '구멍이 세 개 뚫려 있다. 용도를 알 수 없다.', `실제="${dlg.text}"`);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
  } else {
    failures += 2;
  }
  await dragYawBy(YAW_FLIP_DX); // 원상복구
  await sleep(1200);
}

// ---------- 8-C. 공방 백지 조사(UV 랜턴 미보유) — 1단계 ----------
// M9-E(E-4, §12.5) — "랜턴을 비춘다"와 "판을 겹친다"를 별개 발견으로
// 나눈 첫 단계. 이 시점(9번 이전)엔 아직 일기장을 안 읽어 uv_lantern이
// 없다 — placeAndClick은 문/방 연결과 무관하게 대상 오브젝트로 바로
// 순간이동하므로(이 스크립트의 모든 클릭 테스트가 쓰는 방식) 실제
// 진행 순서와 상관없이 "UV 미보유 상태의 백지"를 여기서 바로 잴 수 있다.
console.log('\n--- 8-C. 백지 조사(UV 랜턴 미보유) — 1단계 ---');
{
  const paperClick0 = await placeAndClick('bedA.blankPaper', 0.6, 1.0);
  if (check('백지 클릭 좌표 계산(UV 미보유)', paperClick0.ok, JSON.stringify(paperClick0))) {
    await page.mouse.click(paperClick0.sx, paperClick0.sy);
    await sleep(200);
    const before = await page.evaluate(() => {
      const prompt = document.getElementById('modal-prompt');
      const paper = document.getElementById('modal-paper');
      return { prompt: prompt ? prompt.textContent : null, paper: paper ? paper.textContent : null };
    });
    check(
      'UV 미보유 안내문(variants 1단계)',
      before.prompt === '빈 종이다. 아무것도 쓰여 있지 않다.',
      `실제="${before.prompt}"`
    );
    check('UV 미보유 상태라 종이 내용도 빈 종이', before.paper === '빈 종이다.', `실제="${before.paper}"`);
    await page.evaluate(() => { const b = document.getElementById('modal-close'); if (b) b.click(); });
    await sleep(200);
  } else {
    failures += 2;
  }
}

// ---------- 8-D. 보관소 기계장치 조사(톱니 미보유) — 다이얼 안 뜸 ----------
// M9-E(E-4, §12.6) — D3를 아직 안 풀어서 gear가 없다(gear는 D3 보상,
// 15번에서 나온다). 톱니 없이는 다이얼 UI 자체가 뜨면 안 된다.
console.log('\n--- 8-D. 기계장치 조사(톱니 미보유) — 다이얼 안 뜸 ---');
{
  const machineClick0 = await placeAndClick('bedB.machine', 0.6, 1.0);
  if (check('기계장치 클릭 좌표 계산(톱니 미보유)', machineClick0.ok, JSON.stringify(machineClick0))) {
    await page.mouse.click(machineClick0.sx, machineClick0.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const text = document.getElementById('dialogue-text');
      return text ? text.textContent : null;
    });
    check('톱니 미보유 안내문', dlg === '축이 비어 있다. 무언가 끼워야 돌아갈 것 같다.', `실제="${dlg}"`);
    const dialOpen = await page.evaluate(() => !!document.getElementById('modal-overlay'));
    check('톱니 없이는 다이얼 모달이 안 뜸', !dialOpen);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
  } else {
    failures += 2;
  }
}

// ---------- 9. 서재 일기장 조사 → UV 랜턴 + 열쇠조각1 획득 ----------
console.log('\n--- 9. 일기장 조사 → 아이템 획득 ---');
// officeChair(5.5,-0.9)가 desk(5.5,-1.55) 남쪽에 있어 남쪽에서 접근하면
// 시야를 가린다 — 서쪽에서 접근한다.
const diaryClick = await placeAndClick('study.diary', -1.0, 0);
if (check('일기장 클릭 좌표 계산', diaryClick.ok, JSON.stringify(diaryClick))) {
  await page.mouse.click(diaryClick.sx, diaryClick.sy);
  await sleep(200);
  const dlg = await page.evaluate(() => {
    const text = document.getElementById('dialogue-text');
    return text ? text.textContent : null;
  });
  check('일기장 조사 대화창에 "얻었다" 문구 포함', dlg && dlg.includes('얻었다'), `text="${dlg}"`);
  await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
  await sleep(350);
  const inv = await getInventory();
  check('인벤토리에 uv_lantern 추가됨', inv.includes('uv_lantern'), JSON.stringify(inv));
  check('인벤토리에 key_piece_1 추가됨', inv.includes('key_piece_1'), JSON.stringify(inv));
} else {
  failures += 3;
}

// ---------- 9-A. 알 수 없는 기계 조사(열쇠조각 1개 이상) → variants 전환 확인 ----------
console.log('\n--- 9-A. 알 수 없는 기계 조사(열쇠조각 1개 이상) ---');
{
  const click1pre = await placeAndClick('living.assembler', 0.6, -1.0);
  await dragYawBy(-YAW_FLIP_DX);
  await sleep(1200);
  const click1 = await computeClickCoords('living.assembler');
  if (check('알 수 없는 기계 클릭 좌표 계산(1개+)', click1pre.ok && click1.ok, JSON.stringify({ click1pre, click1 }))) {
    await page.mouse.click(click1.sx, click1.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const text = document.getElementById('dialogue-text');
      return text ? text.textContent : null;
    });
    check(
      '열쇠조각 1개 이상 상태에서 설명이 바뀜(0개 상태와 다름)',
      dlg === '구멍 세 개. 열쇠 조각이 들어갈 것 같다.',
      `실제="${dlg}"`
    );
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
  } else {
    failures += 1;
  }
  await dragYawBy(YAW_FLIP_DX); // 원상복구
  await sleep(1200);
}

// ---------- 9-B. 서재 캐비닛 조사(파이프렌치 미보유) — variants 잠김 상태 ----------
// M9-E(E-3, §12.4) — variants가 실전에서 처음 쓰이는 자리(§12 도입부).
// 아직 공방에 안 가봐서 pipe_wrench가 없다 — 잠긴 문구만 뜨고 flag는
// 안 선다.
console.log('\n--- 9-B. 서재 캐비닛 조사(파이프렌치 미보유) ---');
{
  const cabinetClick = await placeAndClick('study.cabinet', 1.0, 0);
  if (check('캐비닛 클릭 좌표 계산', cabinetClick.ok, JSON.stringify(cabinetClick))) {
    await page.mouse.click(cabinetClick.sx, cabinetClick.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const text = document.getElementById('dialogue-text');
      return text ? text.textContent : null;
    });
    check(
      '파이프렌치 미보유 상태에서 잠김 문구',
      dlg === '잠겨 있다. 열쇠 구멍이 낡아 열쇠로도 열리지 않을 것 같다.',
      `실제="${dlg}"`
    );
    const openedTooEarly = await hasStoryFlag('cabinet_opened');
    check('아직 cabinet_opened flag가 안 섬', !openedTooEarly);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
  } else {
    failures += 2;
  }
}

// ---------- 10~12. D1(방향 자물쇠, P2) — 오답→정답→공방 진입 ----------
console.log('\n--- 10. D1 패널 클릭 → 화살표 모달 ---');
// 정면(offsetZ만)으로 접근하면 카메라 시선(기본 -Z)과 일직선이 되어
// 캐릭터 자신의 몸이 레이캐스트를 가린다 — 대각선으로 접근한다.
const d1Click = await placeAndClick('lock_D1', 0.6, 1.0);
check('D1 패널 클릭 좌표 계산', d1Click.ok, JSON.stringify(d1Click));
if (d1Click.ok) await page.mouse.click(d1Click.sx, d1Click.sy);
await sleep(200);
const d1ModalOpen = await page.evaluate(() => !!document.getElementById('modal-overlay'));
check('화살표 모달이 뜸', d1ModalOpen);

console.log('\n--- 11. D1 오답(→→→→) 입력 ---');
if (d1ModalOpen) {
  await pressKeypad('arrows', '→→→→');
  await sleep(200);
  const afterWrong = await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    const feedback = document.getElementById('modal-feedback');
    return { stillOpen: !!overlay, feedbackText: feedback ? feedback.textContent : null };
  });
  check('오답 후 모달이 안 닫힘', afterWrong.stillOpen);
  check('오답 안내(wrongText) 표시', afterWrong.feedbackText === PUZZLES.P2.wrongText, `실제="${afterWrong.feedbackText}"`);
  const stillLocked = !(await isDoorUnlocked('D1'));
  check('오답 후 D1 여전히 잠김 상태', stillLocked);
} else {
  failures += 3;
}

console.log('\n--- 12. D1 정답(↑↓←→) 입력 → 공방 진입 ---');
const d1ModalStill = await page.evaluate(() => !!document.getElementById('modal-overlay'));
if (d1ModalStill) {
  await pressKeypad('arrows', PUZZLES.P2.answer);
  await sleep(300);
  const modalClosed = await page.evaluate(() => !document.getElementById('modal-overlay'));
  check('정답 입력 후 모달이 닫힘', modalClosed);
  const enteredBedA = await walkToward({ x: -1.5, z: -4.5 }, 6000);
  check(
    '정답 입력 후 실제로 걸어서 공방(Z<-3.3) 진입',
    enteredBedA.arrived && enteredBedA.z < -3.3,
    `실제(${enteredBedA.x.toFixed(2)},${enteredBedA.z.toFixed(2)}) reason=${enteredBedA.reason}`
  );
} else {
  failures += 2;
  console.error('FAIL 12번 스킵 — 11번에서 모달이 이미 닫혀 있었음');
}

// ---------- 12-A. 공구상자 클릭 → 파이프렌치 획득 ----------
console.log('\n--- 12-A. 공구상자 클릭 → 파이프렌치 획득 ---');
{
  const toolboxClick = await placeAndClick('bedA.toolbox', 0, 0.8);
  if (check('공구상자 클릭 좌표 계산', toolboxClick.ok, JSON.stringify(toolboxClick))) {
    await page.mouse.click(toolboxClick.sx, toolboxClick.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const text = document.getElementById('dialogue-text');
      return text ? text.textContent : null;
    });
    check('공구상자 조사 대화창에 "얻었다" 문구 포함', dlg && dlg.includes('얻었다'), `text="${dlg}"`);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
    const inv = await getInventory();
    check('인벤토리에 pipe_wrench 추가됨', inv.includes('pipe_wrench'), JSON.stringify(inv));
  } else {
    failures += 2;
  }
}

// ---------- 12-B. 실제 도보 귀환: 공방 → 거실 → 서재(텔레포트 우회 없음) ----------
// M9-E(E-3) — §12.1 "되돌아가기는 서재 1회뿐" 구간의 핵심 검증. 다른
// 클릭 테스트처럼 placeAndClick으로 순간이동하지 않고, m4-rooms.mjs와
// 같은 방식(walkToward, 키 입력 시뮬레이션)으로 D1→거실→D2를 실제로
// 걸어서 통과한다 — 이미 풀린 자물쇠가 되돌아가는 방향으로도 진짜
// 열려 있는지가 검증 대상이다(잠금 로직이 한쪽 방향만 확인하고 있었다면
// 여기서 잡힌다).
console.log('\n--- 12-B. 실제 도보 귀환: 공방 → 거실 → 서재 ---');
const w1 = await walkToward({ x: -1.8, z: -5.8 }, 3000, 0.25); // 작업대 좌측으로 이동
check('공방 작업대 좌측 경유점 도달', w1.arrived, `reason=${w1.reason} pos=(${w1.x.toFixed(2)},${w1.z.toFixed(2)})`);
const w2 = await walkToward({ x: -1.8, z: -4.0 }, 3000, 0.25); // 작업대 모서리 통과
check('공방 작업대 모서리 통과 경유점 도달', w2.arrived, `reason=${w2.reason} pos=(${w2.x.toFixed(2)},${w2.z.toFixed(2)})`);
const w3 = await walkToward({ x: -0.6, z: -4.0 }, 3000, 0.25); // D1 개구부 정면 정렬 (공방 측)
check('D1 개구부 정면 정렬 경유점 도달', w3.arrived, `reason=${w3.reason} pos=(${w3.x.toFixed(2)},${w3.z.toFixed(2)})`);
const w4 = await walkToward({ x: -0.6, z: -1.5 }, 3000, 0.25); // D1 개구부 직진 통과 (거실 측)
check('D1 개구부 직진 통과 경유점 도달', w4.arrived, `reason=${w4.reason} pos=(${w4.x.toFixed(2)},${w4.z.toFixed(2)})`);
const backToLiving = await walkToward({ x: 0, z: 0 }, 5000, 0.3);
check(
  '공방에서 거실로 실제 도보 복귀(D1 역방향 통과)',
  backToLiving.arrived && Math.abs(backToLiving.x) < 3 && Math.abs(backToLiving.z) < 3,
  `실제(${backToLiving.x.toFixed(2)},${backToLiving.z.toFixed(2)}) reason=${backToLiving.reason}`
);
const backToStudy = await walkToward({ x: 5.0, z: 0.5 }, 6000, 0.3);
check(
  '거실에서 서재로 실제 도보 재진입(D2 재통과, 텔레포트 우회 없음)',
  backToStudy.arrived && backToStudy.x > 3,
  `실제(${backToStudy.x.toFixed(2)},${backToStudy.z.toFixed(2)}) reason=${backToStudy.reason}`
);

// ---------- 12-C. 캐비닛 재조사(파이프렌치 보유) → 개봉 + 스크랩 3장 열람 ----------
console.log('\n--- 12-C. 캐비닛 재조사(파이프렌치 보유) → 개봉 + 스크랩 열람 ---');
{
  const cabinetClick2 = await placeAndClick('study.cabinet', 1.0, 0);
  if (check('캐비닛 재클릭 좌표 계산', cabinetClick2.ok, JSON.stringify(cabinetClick2))) {
    await page.mouse.click(cabinetClick2.sx, cabinetClick2.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const text = document.getElementById('dialogue-text');
      return text ? text.textContent : null;
    });
    check(
      '파이프렌치 보유 상태에서 개봉 문구로 전환(variants)',
      dlg === '파이프렌치로 자물쇠를 부쉈다. 안에 신문 스크랩이 있다.',
      `실제="${dlg}"`
    );
    const opened = await hasStoryFlag('cabinet_opened');
    check('cabinet_opened flag가 섬', opened);

    const clippingsVisible = await page.evaluate(() => {
      let cabinet = null;
      window.__debug.scene.traverse((o) => {
        if (!cabinet && o.userData && o.userData['interactive'] === 'study.cabinet') cabinet = o;
      });
      const clippings = cabinet ? cabinet.getObjectByName('newsClippings') : null;
      return clippings ? clippings.visible : null;
    });
    check('개봉 후 신문 스크랩 자식이 실제로 보임(visible=true)', clippingsVisible === true, `clippingsVisible=${clippingsVisible}`);

    // 스크랩 3장을 페이지 넘기며 순서대로 확인 — story.js NEWS_CLIPPINGS와
    // 문안이 그대로 일치해야 한다(정답/함정을 여기서 새로 베끼지 않는다).
    const page1 = await page.evaluate(() => document.getElementById('modal-clipping-text')?.textContent || null);
    check('스크랩 1장 문안 일치', page1 === NEWS_CLIPPINGS[0], `실제="${page1}"`);
    await page.click('#modal-clipping-next');
    await sleep(100);
    const page2 = await page.evaluate(() => document.getElementById('modal-clipping-text')?.textContent || null);
    check('스크랩 2장 문안 일치(정답 단서)', page2 === NEWS_CLIPPINGS[1], `실제="${page2}"`);
    await page.click('#modal-clipping-next');
    await sleep(100);
    const page3 = await page.evaluate(() => document.getElementById('modal-clipping-text')?.textContent || null);
    check('스크랩 3장 문안 일치', page3 === NEWS_CLIPPINGS[2], `실제="${page3}"`);

    await page.click('#modal-close');
    await sleep(150);
    const modalClosedAfterRead = await page.evaluate(() => !document.getElementById('modal-overlay'));
    check('열람 UI가 닫힘', modalClosedAfterRead);
  } else {
    failures += 5;
  }
}

// ---------- 13. 공방 백지 조사 → P3 단서 팝업(UV 랜턴 보유 상태) ----------
console.log('\n--- 13. 백지 조사 → 단서 팝업 ---');
const paperClick = await placeAndClick('bedA.blankPaper', 0.6, 1.0);
check('백지 클릭 좌표 계산', paperClick.ok, JSON.stringify(paperClick));
if (paperClick.ok) {
  await page.mouse.click(paperClick.sx, paperClick.sy);
  await sleep(200);
  const paperBefore = await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    const prompt = document.getElementById('modal-prompt');
    const paper = document.getElementById('modal-paper');
    return { open: !!overlay, prompt: prompt ? prompt.textContent : null, text: paper ? paper.textContent : null };
  });
  check('단서 팝업이 뜸', paperBefore.open);
  check(
    'UV 랜턴 보유 안내문(variants 2단계)',
    paperBefore.prompt === '자외선을 비추자 글자가 떠오른다.',
    `실제="${paperBefore.prompt}"`
  );
  check(
    'UV 랜턴 보유 상태라 빈 종이가 아님(겹치기 전)',
    paperBefore.text && paperBefore.text !== '빈 종이다.' && paperBefore.text !== PUZZLES.P3.answer,
    `실제="${paperBefore.text}"`
  );
  await page.click('#modal-acrylic-toggle');
  await sleep(150);
  const paperAfter = await page.evaluate(() => {
    const paper = document.getElementById('modal-paper');
    return paper ? paper.textContent : null;
  });
  check('아크릴판 겹치면 정답(TRUTH)만 보임', paperAfter === PUZZLES.P3.answer, `실제="${paperAfter}"`);
  await page.evaluate(() => { const b = document.getElementById('modal-close'); if (b) b.click(); });
  await sleep(200);
} else {
  failures += 4;
}

// ---------- 13-A. 아크릴판 직접 조사 — 이제 팝업과 무관(평범한 설명) ----------
// M9-E(E-4, §12.5) — acrylicPanel에서 paperClue를 뺐다. 직접 클릭하면
// 그냥 대화창으로 짧은 설명만 뜨고, P3 팝업(모달)은 안 열려야 한다.
console.log('\n--- 13-A. 아크릴판 직접 조사(팝업 아님) ---');
{
  const acrylicClick = await placeAndClick('bedA.acrylicPanel', 0.6, 1.0);
  if (check('아크릴판 클릭 좌표 계산', acrylicClick.ok, JSON.stringify(acrylicClick))) {
    await page.mouse.click(acrylicClick.sx, acrylicClick.sy);
    await sleep(200);
    const dlg = await page.evaluate(() => {
      const box = document.getElementById('dialogue-box');
      const text = document.getElementById('dialogue-text');
      return { open: !!box && box.style.display === 'block', text: text ? text.textContent : null };
    });
    check('아크릴판 평범한 설명', dlg.open && dlg.text === '구멍이 뚫린 판이다.', `text="${dlg.text}"`);
    const modalOpened = await page.evaluate(() => !!document.getElementById('modal-overlay'));
    check('아크릴판 클릭으론 팝업이 안 뜸', !modalOpened);
    await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
    await sleep(350);
  } else {
    failures += 2;
  }
}

// ---------- 14~15. D3(영어 자물쇠, P3) — 정답 입력 → 보관소 진입 ----------
console.log('\n--- 14. D3 패널 클릭 → 알파벳 모달 ---');
const d3Click0 = await placeAndClick('lock_D3', 0.6, -1.0);
await dragYawBy(-YAW_FLIP_DX); // 카메라를 벽 반대쪽으로
await sleep(1200); // 카메라 감쇠가 새 yaw로 다시 수렴할 시간
const d3Click = await computeClickCoords('lock_D3');
check('D3 패널 클릭 좌표 계산', d3Click0.ok && d3Click.ok, JSON.stringify({ d3Click0, d3Click }));
if (d3Click.ok) await page.mouse.click(d3Click.sx, d3Click.sy);
await sleep(200);
const d3ModalOpen = await page.evaluate(() => !!document.getElementById('modal-overlay'));
check('알파벳 모달이 뜸', d3ModalOpen);

console.log('\n--- 15. D3 정답(TRUTH) 입력 → 보관소 진입 + 보상 획득 ---');
if (d3ModalOpen) {
  await pressKeypad('letters', PUZZLES.P3.answer);
  await sleep(300);
  const modalClosed = await page.evaluate(() => !document.getElementById('modal-overlay'));
  check('정답 입력 후 모달이 닫힘', modalClosed);
  const invAfterD3 = await getInventory();
  check('D3 해제 보상으로 gear 획득', invAfterD3.includes('gear'), JSON.stringify(invAfterD3));
  check('D3 해제 보상으로 key_piece_2 획득', invAfterD3.includes('key_piece_2'), JSON.stringify(invAfterD3));
  await dragYawBy(YAW_FLIP_DX); // 카메라 yaw 원상복구 — 이후 걷기는 yaw=0 기준
  await sleep(1200);
  const enteredBedB = await walkToward({ x: 0, z: 4.5 }, 6000);
  check(
    '정답 입력 후 실제로 걸어서 보관소(Z>3.3) 진입',
    enteredBedB.arrived && enteredBedB.z > 3.3,
    `실제(${enteredBedB.x.toFixed(2)},${enteredBedB.z.toFixed(2)}) reason=${enteredBedB.reason}`
  );
} else {
  failures += 4;
  await dragYawBy(YAW_FLIP_DX); // 실패해도 yaw는 복구 — 이후 단계가 계속 깨지는 걸 막는다
  await sleep(1200);
}

// ---------- 16. 보관소 기계장치 조사(톱니 보유) → 다이얼 → 서랍 열림 ----------
// M9-E(E-4, §12.6) — D3 보상으로 gear를 이미 갖고 있다(15번). 톱니 보유
// 상태에서 클릭하면 이제 즉시 지급이 아니라 다이얼 모달이 뜬다.
console.log('\n--- 16. 기계장치 조사(톱니 보유) → 다이얼 ---');
// probe.js가 이제 레이캐스트에서 플레이어 자신을 제외하므로(캐릭터
// 자기 몸에 가려 클릭이 씹히던 진짜 버그, 2026-08-23 수정) yaw 반전
// 없이도 남쪽 접근만으로 충분하다 — 이전엔 이게 "벽 충돌"인 줄
// 알았는데 실은 자기 몸 가림이었다.
const machineClick = await placeAndClick('bedB.machine', 0.6, 1.0);
const machineOk = check('기계장치 클릭 좌표 계산', machineClick.ok, JSON.stringify(machineClick));
if (machineOk) await page.mouse.click(machineClick.sx, machineClick.sy);
await sleep(200);
const dialOpened = await page.evaluate(() => !!document.getElementById('modal-overlay'));
check('톱니 보유 상태에서 다이얼 모달이 뜸', dialOpened);
if (!machineOk) failures += 1;

console.log('\n--- 16-A. 다이얼 오답(스크랩 ① 유도값 L3) ---');
if (dialOpened) {
  await pressDial([['L', 3]]);
  const afterL3 = await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    const feedback = document.getElementById('modal-feedback');
    const display = document.getElementById('modal-dial-display');
    return { stillOpen: !!overlay, feedbackText: feedback ? feedback.textContent : null, display: display ? display.textContent : null };
  });
  check('오답(L3) 후 모달이 안 닫힘', afterL3.stillOpen);
  check('오답 안내("헛돈다.") 표시', afterL3.feedbackText === PUZZLES.P4.wrongText, `실제="${afterL3.feedbackText}"`);
  check('오답 후 입력이 초기화됨', afterL3.display === '입력 없음', `실제="${afterL3.display}"`);
} else {
  failures += 3;
}

console.log('\n--- 16-B. 다이얼 오답(스크랩 ③ 유도값 L13) ---');
if (dialOpened) {
  await pressDial([['L', 13]]);
  const afterL13 = await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    const feedback = document.getElementById('modal-feedback');
    return { stillOpen: !!overlay, feedbackText: feedback ? feedback.textContent : null };
  });
  check('오답(L13) 후 모달이 안 닫힘', afterL13.stillOpen);
  check('오답 안내("헛돈다.") 표시', afterL13.feedbackText === PUZZLES.P4.wrongText, `실제="${afterL13.feedbackText}"`);
  const stillNoReward = !(await getInventory()).includes('key_piece_3');
  check('오답 후 key_piece_3 미지급', stillNoReward);
} else {
  failures += 2;
}

console.log('\n--- 16-C. 다이얼 정답(L3R4L1) → 서랍 열림 + 열쇠조각3 획득 ---');
if (dialOpened) {
  await pressDial([['L', 3], ['R', 4], ['L', 1]]);
  await sleep(200);
  const modalClosed = await page.evaluate(() => !document.getElementById('modal-overlay'));
  check('정답 입력 후 모달이 닫힘', modalClosed);
  const dlg = await page.evaluate(() => {
    const text = document.getElementById('dialogue-text');
    return text ? text.textContent : null;
  });
  check('기계장치 조사 대화창에 "얻었다" 문구 포함', dlg && dlg.includes('얻었다'), `text="${dlg}"`);
  await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
  await sleep(800); // 서랍 슬라이드 애니메이션(0.6s)이 끝날 때까지
  const invAfterMachine = await getInventory();
  check('기계장치 해결 보상으로 key_piece_3 획득', invAfterMachine.includes('key_piece_3'), JSON.stringify(invAfterMachine));
  const drawerZ = await page.evaluate(() => {
    let machine = null;
    window.__debug.scene.traverse((o) => { if (!machine && o.userData && o.userData['interactive'] === 'bedB.machine') machine = o; });
    if (!machine) return null;
    const drawer = machine.getObjectByName('machineDrawer');
    return drawer ? drawer.position.z : null;
  });
  check('서랍이 실제로 Z- 방향 슬라이드함(위치 변화)', drawerZ !== null && drawerZ < -0.001, `drawer.position.z=${drawerZ}`);
} else {
  failures += 4;
}

// ---------- 17. 거실 조립머신 조사 → 현관 열쇠 획득 ----------
console.log('\n--- 17. 조립머신 조사 → 현관 열쇠 획득 ---');
// 조립머신은 거실 남벽에 붙어 있어 D3와 같은 이유로 카메라 벽 충돌이
// 생긴다 — 같은 방식(yaw 180도 반전)으로 우회한다.
const assemblerClick0 = await placeAndClick('living.assembler', 0.6, -1.0);
await dragYawBy(-YAW_FLIP_DX);
await sleep(1200);
const assemblerClick = await computeClickCoords('living.assembler');
check('조립머신 클릭 좌표 계산', assemblerClick0.ok && assemblerClick.ok, JSON.stringify({ assemblerClick0, assemblerClick }));
if (assemblerClick.ok) await page.mouse.click(assemblerClick.sx, assemblerClick.sy);
await sleep(200);
const dlgAssembler = await page.evaluate(() => {
  const text = document.getElementById('dialogue-text');
  return text ? text.textContent : null;
});
check('조립머신 조사 대화창에 "얻었다" 문구 포함', dlgAssembler && dlgAssembler.includes('얻었다'), `text="${dlgAssembler}"`);
await page.evaluate(() => { const b = document.getElementById('dialogue-box'); if (b) b.click(); });
await sleep(350);
const invAfterAssembler = await getInventory();
check('조립 보상으로 front_key 획득', invAfterAssembler.includes('front_key'), JSON.stringify(invAfterAssembler));
await dragYawBy(YAW_FLIP_DX); // 원상복구
await sleep(1200);

// ---------- 18. D4 패널 조사 → 현관 열쇠 소지 판정(모달 없음) → 해제 ----------
console.log('\n--- 18. D4 패널 조사 → 해제(아이템 판정) ---');
const d4Click = await placeAndClick('lock_D4', 1.0, 0);
check('D4 패널 클릭 좌표 계산', d4Click.ok, JSON.stringify(d4Click));
if (d4Click.ok) await page.mouse.click(d4Click.sx, d4Click.sy);
await sleep(200);
const d4Unlocked = await isDoorUnlocked('D4');
check('D4가 현관 열쇠로 즉시 해제됨(모달 없이)', d4Unlocked);
const modalAfterD4 = await page.evaluate(() => !!document.getElementById('modal-overlay'));
check('D4는 아이템 판정이라 키패드 모달을 안 띄움', !modalAfterD4);

// ---------- 19. 마당 진입 → 엔딩 대사(최종 완료 조건) ----------
console.log('\n--- 19. 마당 진입 → 엔딩(시작→탈출 전 구간 클리어) ---');
const enteredYard = await walkToward({ x: -5.0, z: 0 }, 9000);
check(
  'D4를 통과해 실제로 마당(YARD, X<-3) 진입',
  enteredYard.arrived && enteredYard.x < -3,
  `실제(${enteredYard.x.toFixed(2)},${enteredYard.z.toFixed(2)}) reason=${enteredYard.reason}`
);
await sleep(200);
const endingDlg = await page.evaluate(async () => {
  const state = await import('./src/story/state.js');
  const text = document.getElementById('dialogue-text');
  return { shown: state.hasFlag('ending:shown'), text: text ? text.textContent : null };
});
check('엔딩 플래그가 켜짐', endingDlg.shown);
check('엔딩 대사가 정확히 표시됨', endingDlg.text === ENDING_TEXT, `실제="${endingDlg.text}"`);

// ---------- 20. 정면 클릭 회귀 테스트 (2026-08-23 카메라 레이캐스트 버그) ----------
// probe.js가 씬 전체를 레이캐스트하면서 3인칭 카메라와 오브젝트 사이에
// 흔히 서 있는 플레이어 자신의 몸(로봇 GLB)에 먼저 맞아 클릭이 씹히던
// 실사용 버그의 재발 방지 테스트다. 위 1~19번은 전부 카메라 yaw를
// 돌려 우회한 상태라 이 버그를 못 잡았다 — 여기서는 yaw를 하나도
// 안 건드린 "정면으로 똑바로 접근" 상태(오프셋을 오브젝트 정면
// 1.0m로만 준다, 대각선 없음)로 직접 재현해서 검사한다.
console.log('\n--- 20. 정면 클릭 회귀 테스트 ---');
const frontClick = await placeAndClick('bedA.workbench', 0, 1.0);
check('정면 오브젝트 클릭 좌표 계산', frontClick.ok, JSON.stringify(frontClick));
if (frontClick.ok) {
  await page.mouse.click(frontClick.sx, frontClick.sy);
  await sleep(200);
  const dlg = await page.evaluate(() => {
    const box = document.getElementById('dialogue-box');
    const text = document.getElementById('dialogue-text');
    return { open: !!box && box.style.display === 'block', text: text ? text.textContent : null };
  });
  check(
    '카메라 yaw 기본값 상태에서 정면 1.0m 오브젝트 클릭이 대화창을 띄움(캐릭터 자기 몸에 안 가려짐)',
    dlg.open && dlg.text === OBJECTS['bedA.workbench'].text,
    `text="${dlg.text}"`
  );
} else {
  failures++;
}

} catch (e) {
  if (e !== ABORT) throw e;
} finally {
  await closeBrowser();
  server.close();
}

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(failures === 0 ? '전부 통과' : `${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
