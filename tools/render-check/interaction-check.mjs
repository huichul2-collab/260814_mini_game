#!/usr/bin/env node
// M9-A 검증 — "가까운 사물을 좌클릭하면 하단에 설명이 뜬다"가 완료 조건 전체다.
//
//   시작. furniture.js의 모든 항목이 id를 갖는가(순수 node, 브라우저 불필요).
//      ⭐ id가 없는 오브젝트는 씬에 태그가 안 붙어서 아래 1번(씬↔story.js
//      대조) 목록에 애초에 안 잡힌다 — "검사 목록에 없어서 통과"를 막는
//      부재 검사다. 서재 배경 가구 6개가 이 구멍으로 클릭 불가 상태로
//      남아있던 사고 이후 추가(2026-08-23). 의도적으로 id를 안 붙일
//      오브젝트가 생기면 그때 화이트리스트를 만든다 — 지금은 예외 없음.
//   0. room-tint-check.mjs와 같은 절대 하한(휘도/검정비율/최대픽셀) — 검은
//      화면 렌더 실패를 다른 검사보다 먼저 잡는다.
//   1. 씬의 TAG.INTERACTIVE id 전부가 story.js OBJECTS에 대응 키가 있는지
//      (id 오타를 잡는 게 핵심 — 없으면 FAIL)
//   2. 반대로 story.js에만 있고 씬에 없는 키는 경고만(WARN)
//   3. 거실 소품 앞으로 플레이어를 옮기고 클릭 → 대화창 DOM이 뜨는지
//   4. 반경 밖(3m)에서 클릭 → 안 뜨는지
//   5. 대상을 등지고(180도) 클릭 → 안 뜨는지
//   6. 드래그(pointerdown→50px 이동→up) 후 → 안 뜨는지
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { FURNITURE } from '../../game/furniture.js';

const gameDir = path.resolve(process.argv[2] || 'game');
const outDir = path.resolve(process.argv[3] || 'tools/render-check');
const W = 960, H = 600;

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

const failures = [];
const warnings = [];

// ---------- 시작. furniture.js 전 항목이 id를 갖는가(순수 node) ----------
console.log('--- 시작. furniture.js id 부재 검사 ---');
{
  const missing = FURNITURE.filter((item) => !item.id);
  if (missing.length) {
    const labels = missing.map((item) => `${item.room}.${item.type}`);
    console.error(`FAIL: id 없는 furniture.js 항목 ${missing.length}개 — ${labels.join(', ')}`);
    failures.push(`furniture.js id 누락: ${labels.join(', ')}`);
  } else {
    console.log(`OK   furniture.js ${FURNITURE.length}개 항목 전부 id 보유`);
  }
}

const server = await serve(gameDir);
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });

await page.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#audio-start-btn');
await sleep(1000); // 페이드아웃 + 씬 안정화

// ---------- 0. 절대 하한 (검은 화면 렌더 실패 즉시 차단) ----------
console.log('--- 0. 이미지 절대 하한 검사 ---');
const shot0 = path.join(outDir, '_tmp-interaction-boot.png');
await page.screenshot({ path: shot0 });
{
  const b64 = fs.readFileSync(shot0).toString('base64');
  await page.evaluate(() => {}); // no-op, keep page context warm
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
  fs.unlinkSync(shot0);
  const pass = abs.avgLuma >= 15 && abs.nearBlackRatio < 0.5 && abs.maxPixel >= 200;
  console.log(`${pass ? 'OK  ' : 'FAIL'} 절대하한: 평균휘도=${abs.avgLuma.toFixed(1)}(>=15) 검정비=${(abs.nearBlackRatio * 100).toFixed(1)}%(<50%) 최대픽셀=${abs.maxPixel}(>=200)`);
  if (!pass) {
    console.error('FAIL: 렌더 실패(검은 화면) — 나머지 검사를 건너뜁니다.');
    await browser.close();
    server.close();
    process.exit(1);
  }
}

// ---------- 1+2. interactive id ↔ story.js OBJECTS 대조 ----------
console.log('\n--- 1+2. interactive id ↔ story.js 대조 ---');
const idCheck = await page.evaluate(async () => {
  const { TAG } = await import('./src/core/tags.js');
  const story = await import('./story.js');
  const sceneIds = new Set();
  window.__debug.scene.traverse((o) => {
    const id = o.userData && o.userData[TAG.INTERACTIVE];
    if (typeof id === 'string') sceneIds.add(id);
  });
  // M9-B: 'lock_D2' 같은 문 잠금 패널 id는 story.js의 OBJECTS가 아니라
  // LOCKS(doorId 기준)에서 대응을 찾는다 — probe.js가 이 접두사를 특별
  // 취급해서 대화창 대신 키패드 모달을 연다.
  const storyKeys = new Set(Object.keys(story.OBJECTS));
  const lockDoorIds = new Set(Object.keys(story.LOCKS || {}));
  function hasCounterpart(id) {
    if (id.startsWith('lock_')) return lockDoorIds.has(id.slice('lock_'.length));
    return storyKeys.has(id);
  }
  const missingInStory = [...sceneIds].filter((id) => !hasCounterpart(id));
  const unusedObjectKeys = [...storyKeys].filter((id) => !sceneIds.has(id));
  const unusedLockKeys = [...lockDoorIds].filter((doorId) => !sceneIds.has(`lock_${doorId}`));
  const unusedInScene = [...unusedObjectKeys, ...unusedLockKeys.map((d) => `LOCKS.${d}`)];
  return { sceneIds: [...sceneIds], missingInStory, unusedInScene };
});
console.log(`씬에서 발견한 interactive id (${idCheck.sceneIds.length}개): ${idCheck.sceneIds.join(', ')}`);
if (idCheck.missingInStory.length) {
  console.error(`FAIL: story.js에 없는 id — ${idCheck.missingInStory.join(', ')}`);
  failures.push(`story.js 누락: ${idCheck.missingInStory.join(', ')}`);
} else {
  console.log('OK   씬의 id가 전부 story.js에 대응됨');
}
if (idCheck.unusedInScene.length) {
  console.warn(`WARN: story.js에만 있고 씬엔 없는 id — ${idCheck.unusedInScene.join(', ')}`);
  warnings.push(`씬 미사용: ${idCheck.unusedInScene.join(', ')}`);
}

// ---------- 클릭 시뮬레이션 헬퍼 ----------
// player를 특정 위치/각도로 텔레포트한 뒤(controller.js의 resolve()가 매
// 프레임 충돌 보정을 하므로 실측 위치가 살짝 밀릴 수 있어 여유를 둔다),
// followCamera가 새 위치로 따라잡을 시간을 준 다음, 목표 오브젝트의 현재
// 화면 좌표를 camera.project()로 계산해 그 좌표에 실제 포인터 이벤트를
// 쏜다 — 카메라 드래그를 흉내 내지 않고, 있는 그대로의 체이스캠 프레이밍을
// 그대로 이용한다(거실 소품은 플레이어 근처에 있으므로 42° FOV 안에 들어옴).
async function placeAndProject(targetId, offsetX, offsetZ, facingOffsetRad = 0) {
  return page.evaluate(async ({ targetId, offsetX, offsetZ, facingOffsetRad }) => {
    const { TAG } = await import('./src/core/tags.js');
    let targetObj = null;
    window.__debug.scene.traverse((o) => {
      if (!targetObj && o.userData && o.userData[TAG.INTERACTIVE] === targetId) targetObj = o;
    });
    if (!targetObj) return { ok: false, reason: 'target-not-found' };
    const THREE = window.__debug.THREE;
    // 거리/방향 판정은 probe.js와 똑같이 태그 붙은 오브젝트의 "원점" 월드
    // 좌표를 쓴다(desk 그룹 원점은 바닥 높이). 하지만 그 좌표를 그대로
    // 화면에 투영해서 클릭하면 상판/다리가 아니라 그 아래 바닥 픽셀을
    // 찍게 되어 레이캐스트가 desk를 못 맞힌다 — 클릭 좌표만 바운딩박스
    // 중심(실제 메시가 있는 지점)으로 따로 계산한다.
    const tPos = new THREE.Vector3();
    targetObj.getWorldPosition(tPos);
    const box = new THREE.Box3().setFromObject(targetObj);
    const clickPos = box.isEmpty() ? tPos : box.getCenter(new THREE.Vector3());

    const px = tPos.x + offsetX;
    const pz = tPos.z + offsetZ;
    const dx = tPos.x - px;
    const dz = tPos.z - pz;
    const facing = Math.atan2(dx, dz) + facingOffsetRad;

    const player = window.__debug.player;
    player.root.position.set(px, 0, pz);
    player.root.rotation.y = facing;

    await new Promise((r) => setTimeout(r, 700)); // 카메라 followLambda 수렴 대기

    const vector = clickPos.clone().project(window.__debug.camera);
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const sx = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;
    const inFrustum = vector.z > -1 && vector.z < 1 && Math.abs(vector.x) < 1.05 && Math.abs(vector.y) < 1.05;
    return { ok: true, sx, sy, inFrustum, dist: Math.hypot(dx, dz) };
  }, { targetId, offsetX, offsetZ, facingOffsetRad });
}

// ⚠️ dialogue.js는 성공(오브젝트 설명)과 실패("너무 멀다" 등) 안내를 같은
// #dialogue-box로 보여준다(probe.js 스펙: "실패 시 ... 안내"). 그래서
// "대화창 DOM이 떴는지"만 보면 실패 안내도 성공으로 오판한다 — 실제로
// 처음에 이렇게 잘못 재서 반경 밖(3m)/등진 상태 테스트가 거짓 FAIL이
// 났었다. 이름줄(#dialogue-name)이 채워진 경우만 "진짜 오브젝트 설명이
// 떴다"로 친다(실패 안내는 이름 없이 본문만 채운다 — dialogue.js 참고).
async function isDialogueOpen() {
  return page.evaluate(() => {
    const el = document.getElementById('dialogue-box');
    const nameEl = document.getElementById('dialogue-name');
    return !!el && el.style.display === 'block' && !!nameEl && nameEl.style.display === 'block';
  });
}

async function dialogueText() {
  return page.evaluate(() => {
    const name = document.getElementById('dialogue-name');
    const text = document.getElementById('dialogue-text');
    return { name: name ? name.textContent : null, text: text ? text.textContent : null };
  });
}

// ⚠️ 대화창은 화면 하단(bottom:24px)에 떠 있고, 클릭해서 닫는 리스너는
// 캔버스가 아니라 그 대화창 DOM 엘리먼트 자신에게 달려 있다. 성공 테스트
// 직후 정리한답시고 "같은 화면 좌표(캔버스=책상 위치)"를 다시 클릭하면
// 대화창이 안 닫히고 오히려 probe.js가 또 한 번 성공 판정을 내려 새
// dialogDuration 타이머로 계속 열려 있는 상태가 된다 — 그 상태로 다음
// 테스트(4/5/6)를 돌리면 "이전 대화창이 아직 떠 있어서" 전부 거짓 FAIL이
// 난다(실제로 한 번 이렇게 겪었다). 반드시 대화창 엘리먼트 자체를 클릭해야
// 닫힌다.
async function closeDialogue() {
  await page.evaluate(() => {
    const el = document.getElementById('dialogue-box');
    if (el) el.click();
  });
  await sleep(350); // hideDialogue()의 250ms 페이드아웃 타이머보다 여유 있게
}

const TARGET = 'living.desk';

// ---------- 3. 정상 거리+정면 → 대화창 뜸 ----------
console.log('\n--- 3. 정상 거리+정면 클릭 ---');
{
  const p = await placeAndProject(TARGET, -1.0, 0); // 목표 서쪽 1m, 정면으로 마주봄
  if (!p.ok || !p.inFrustum) {
    console.error(`FAIL: 테스트 좌표 계산 실패(${JSON.stringify(p)})`);
    failures.push('test3 좌표 계산 실패');
  } else {
    await page.mouse.click(p.sx, p.sy);
    await sleep(150);
    const open = await isDialogueOpen();
    if (open) {
      const { name, text } = await dialogueText();
      console.log(`OK   대화창 뜸: name="${name}" text="${text}"`);
      // 요청된 스크린샷 — 대화창이 떠 있는 상태 1장.
      await page.screenshot({ path: path.join(outDir, 'm9-dialogue.png') });
      console.log(`     스크린샷 저장: m9-dialogue.png`);
    } else {
      console.error('FAIL: 정상 거리+정면인데 대화창이 안 뜸');
      failures.push('test3: 정상 조건에서 대화창 미표시');
    }
    // 다음 테스트에 영향 없도록 대화창 자체를 클릭해 닫는다(캔버스 좌표
    // 재클릭 아님 — 위 closeDialogue() 주석 참고).
    await closeDialogue();
  }
}

// ---------- 4. 반경 밖(3m) → 대화창 안 뜸 ----------
console.log('\n--- 4. 반경 밖(3m) 클릭 ---');
{
  const p = await placeAndProject(TARGET, -3.0, 0);
  if (!p.ok) {
    console.error(`FAIL: 테스트 좌표 계산 실패(${JSON.stringify(p)})`);
    failures.push('test4 좌표 계산 실패');
  } else {
    await page.mouse.click(p.sx, p.sy);
    await sleep(150);
    const open = await isDialogueOpen();
    if (!open) {
      console.log(`OK   반경 밖(dist=${p.dist.toFixed(2)}m)에서 대화창 안 뜸`);
    } else {
      console.error('FAIL: 반경 밖인데 대화창이 뜸');
      failures.push('test4: 반경 밖에서 대화창 오표시');
      await closeDialogue(); // 정리
    }
  }
}

// ---------- 5. 대상을 등지고(180도) 클릭 → 안 뜸 ----------
console.log('\n--- 5. 등지고(180도) 클릭 ---');
{
  const p = await placeAndProject(TARGET, -1.0, 0, Math.PI);
  if (!p.ok || !p.inFrustum) {
    console.error(`FAIL: 테스트 좌표 계산 실패(${JSON.stringify(p)})`);
    failures.push('test5 좌표 계산 실패');
  } else {
    await page.mouse.click(p.sx, p.sy);
    await sleep(150);
    const open = await isDialogueOpen();
    if (!open) {
      console.log('OK   등지고 있을 때 대화창 안 뜸');
    } else {
      console.error('FAIL: 등지고 있는데 대화창이 뜸');
      failures.push('test5: 등진 상태에서 대화창 오표시');
      await closeDialogue(); // 정리
    }
  }
}

// ---------- 6. 드래그(50px) → 안 뜸 ----------
console.log('\n--- 6. 드래그(50px 이동) ---');
{
  const p = await placeAndProject(TARGET, -1.0, 0); // 성공 조건과 동일한 위치+정면
  if (!p.ok || !p.inFrustum) {
    console.error(`FAIL: 테스트 좌표 계산 실패(${JSON.stringify(p)})`);
    failures.push('test6 좌표 계산 실패');
  } else {
    await page.mouse.move(p.sx, p.sy);
    await page.mouse.down();
    await page.mouse.move(p.sx + 50, p.sy, { steps: 8 });
    await page.mouse.up();
    await sleep(150);
    const open = await isDialogueOpen();
    if (!open) {
      console.log('OK   드래그(50px) 후 대화창 안 뜸');
    } else {
      console.error('FAIL: 드래그였는데 대화창이 뜸');
      failures.push('test6: 드래그 후 대화창 오표시');
    }
  }
}

await browser.close();
server.close();

console.log('');
if (warnings.length) console.log(`경고 ${warnings.length}건 (FAIL 아님): ${warnings.join(' / ')}`);
console.log(failures.length ? `${failures.length}건 실패:\n- ${failures.join('\n- ')}` : '전부 통과');
process.exit(failures.length ? 1 : 0);
