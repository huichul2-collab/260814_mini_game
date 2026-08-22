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
import { CLOCK_TIME, PUZZLES, ENDING_TEXT, OBJECTS } from '../../game/story.js';

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
  check('정답 입력 후 실제로 걸어서 공방(Z<-3.3) 진입', enteredBedA.z < -3.3, `실제(${enteredBedA.x.toFixed(2)},${enteredBedA.z.toFixed(2)})`);
} else {
  failures += 2;
  console.error('FAIL 12번 스킵 — 11번에서 모달이 이미 닫혀 있었음');
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
    const paper = document.getElementById('modal-paper');
    return { open: !!overlay, text: paper ? paper.textContent : null };
  });
  check('단서 팝업이 뜸', paperBefore.open);
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
  failures += 3;
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
  check('정답 입력 후 실제로 걸어서 보관소(Z>3.3) 진입', enteredBedB.z > 3.3, `실제(${enteredBedB.x.toFixed(2)},${enteredBedB.z.toFixed(2)})`);
} else {
  failures += 4;
  await dragYawBy(YAW_FLIP_DX); // 실패해도 yaw는 복구 — 이후 단계가 계속 깨지는 걸 막는다
  await sleep(1200);
}

// ---------- 16. 보관소 기계장치 조사 → 서랍 열림 + 열쇠조각3 획득 ----------
console.log('\n--- 16. 기계장치 조사 → 서랍 열림 ---');
// probe.js가 이제 레이캐스트에서 플레이어 자신을 제외하므로(캐릭터
// 자기 몸에 가려 클릭이 씹히던 진짜 버그, 2026-08-23 수정) yaw 반전
// 없이도 남쪽 접근만으로 충분하다 — 이전엔 이게 "벽 충돌"인 줄
// 알았는데 실은 자기 몸 가림이었다.
const machineClick = await placeAndClick('bedB.machine', 0.6, 1.0);
check('기계장치 클릭 좌표 계산', machineClick.ok, JSON.stringify(machineClick));
if (machineClick.ok) {
  await page.mouse.click(machineClick.sx, machineClick.sy);
  await sleep(200);
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
  failures += 3;
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
check('D4를 통과해 실제로 마당(YARD, X<-3) 진입', enteredYard.x < -3, `실제(${enteredYard.x.toFixed(2)},${enteredYard.z.toFixed(2)})`);
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

await browser.close();
server.close();

console.log('');
console.log('로그:', logs.length ? logs : '없음');
console.log('');
console.log(failures === 0 ? '전부 통과' : `${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
