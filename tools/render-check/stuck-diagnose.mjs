#!/usr/bin/env node
// 이동 정지 버그 진단(1단계) — 추측 금지, 실측만.
//
// m4-rooms.mjs와 같은 경로로 걷게 하되, "목표 도달"이 아니라 "3프레임 연속
// 위치가 정확히 그대로"를 멈춤 판정 기준으로 쓴다(폴링이 아니라 매
// requestAnimationFrame마다 위치를 읽어서 진짜 프레임 단위로 잰다). 멈춘
// 순간의 좌표에서 getColliders() 전체를 circleVsAABB로 재검사해서 실제로
// 겹치는 콜라이더를 전부 나열하고, 그 push 벡터들의 합을 출력한다 — 합이
// 0에 가까우면 "반대 push가 서로 상쇄돼서 제자리"라는 가설이 맞는 것이고,
// 아니면 다른 원인을 찾아야 한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2] || 'game');

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

const logs = [];
let stuckReport = null;
let failCount = 0;
const failedLegNames = [];

// 문D1 옆(책상이 벽에 밀착된 구석)은 living(0,0)으로 직선/대각선 이동하면
// 책상 모서리에 걸린다 — 정상적인 코너 막힘(입력을 반대로 바꾸면 실제로
// 빠져나오는 것 확인됨, docs/STATE.md 참고)이라 "이론상 통과 가능한
// 경로만 테스트한다" 원칙에 따라 m4-rooms.mjs와 똑같은 경유점을 쓴다.
const VIA_D1_TO_LIVING = [{ x: -0.5, z: -3.3 }, { x: -0.5, z: -2.0 }];

// M9-C 배치1: 공방(bedA) 방 중앙(-0.5,-5.0)에 작업대, 보관소(bedB) 방
// 한가운데(0,5.2)에 기계장치가 §11.2대로 정확히 들어앉으면서 옛 목표점
// 두 개가 가구 안이 됐다(m4-rooms.mjs와 동일 사유 — 그쪽 주석 참고).
// 같은 이유로 "D3 가장자리 → bedB"도 목표를 기계장치 앞이 아니라 문
// 바로 안쪽으로 당겼다(원래 목적인 "가장자리 통과" 자체는 그대로 검증됨).
const legs = [
  { name: 'living(spawn)', target: { x: 0, z: 0 } },
  { name: 'bedA', target: { x: -2.0, z: -5.0 }, via: [{ x: -0.9, z: -3.6 }] },
  { name: 'bedA→living', target: { x: 0, z: 0 }, via: VIA_D1_TO_LIVING },
  { name: 'study', target: { x: 5.0, z: 0.5 } },
  { name: 'study→living', target: { x: 0, z: 0 } },
  { name: 'bedB', target: { x: -1.5, z: 5.0 }, via: [{ x: 0, z: 3.6 }] },
  { name: 'bedB→living', target: { x: 0, z: 0 } },
  { name: 'D1 가장자리 → bedA', target: { x: -0.9, z: -3.6 } },
  { name: 'D1 가장자리 → living', target: { x: 0, z: 0 }, via: VIA_D1_TO_LIVING },
  { name: 'D2 가장자리 → study', target: { x: 5.0, z: 0.1 } },
  { name: 'D2 가장자리 → living', target: { x: 0, z: 0 } },
  { name: 'D3 가장자리 → bedB', target: { x: -0.4, z: 3.6 } },
  { name: 'D3 가장자리 → living', target: { x: 0, z: 0 } },
];

// stuck-diagnose.mjs가 항상 exit 1인 채로 있으면 새 실패가 생겨도 아무도
// 못 알아챈다 — 여기 있는 이름만 실패해도 exit 0(+"알려진 예외 N건"),
// 목록에 없는 실패가 하나라도 있으면 exit 1.
//
// M9-B에서 D2가 잠기면서 한때 study 관련 2개 구간이 여기 있었다 — 이제는
// 주행 시작 전에 window.__debug.unlockAllDoors()로 문을 전부 열어 잠금과
// 분리했으므로(위 참고) 순수 기하 문제만 남아야 한다. 빈 배열로 둔다 —
// 여기 뭔가 다시 채워진다면 그건 진짜 회귀다.
const KNOWN_FAILURES = [];

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
await sleep(1500);

// M9-B로 D2가 잠기면서 study 관련 구간이 걸어서는 통과 불가능해졌다.
// 이 스크립트가 재는 건 "기하학적으로 지나갈 수 있는가"이지 퍼즐 여부가
// 아니다 — 검증 전용 훅으로 문을 전부 열어 잠금과 분리한다.
await page.evaluate(() => window.__debug.unlockAllDoors());

// ---------- 페이지 컨텍스트 헬퍼 ----------
// 매 requestAnimationFrame마다 위치를 읽어 "3프레임 연속 완전 동일"을
// 멈춤으로 판정한다(폴링 간격에 좌우되지 않는 진짜 프레임 단위 검사).
async function walkLeg(target, { tol = 0.3, maxFrames = 1200 } = {}) {
  return page.evaluate(async ({ target, tol, maxFrames }) => {
    function getPos() {
      const p = window.__debug.player.root.position;
      return { x: p.x, z: p.z };
    }
    function dispatch(type, code) {
      window.dispatchEvent(new KeyboardEvent(type, { code }));
    }
    const held = new Set();
    function setHeld(wanted) {
      for (const k of held) if (!wanted.has(k)) { dispatch('keyup', k); held.delete(k); }
      for (const k of wanted) if (!held.has(k)) { dispatch('keydown', k); held.add(k); }
    }
    function computeWanted(pos) {
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const wanted = new Set();
      if (dx > 0.05) wanted.add('KeyD'); else if (dx < -0.05) wanted.add('KeyA');
      if (dz > 0.05) wanted.add('KeyS'); else if (dz < -0.05) wanted.add('KeyW');
      return wanted;
    }
    function raf() { return new Promise((r) => requestAnimationFrame(r)); }

    const history = [];
    let frames = 0;
    while (frames < maxFrames) {
      const pos = getPos();
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      if (Math.hypot(dx, dz) < tol) { setHeld(new Set()); return { ok: true, pos, frames }; }

      const wanted = computeWanted(pos);
      setHeld(wanted);
      await raf();
      frames++;

      history.push(pos);
      if (history.length > 3) history.shift();
      if (history.length === 3) {
        const [a, b, c] = history;
        const frozen =
          Math.abs(a.x - b.x) < 1e-5 && Math.abs(b.x - c.x) < 1e-5 &&
          Math.abs(a.z - b.z) < 1e-5 && Math.abs(b.z - c.z) < 1e-5;
        if (frozen) {
          // ⚠️ 여기서 setHeld(new Set())로 키를 놓으면 "그 순간 어떤 키가
          // 눌려 있었는지" 증거가 사라진다 — axis는 keys Set을 즉시
          // 반영하므로, 놓기 전에 먼저 axis/held를 캡처해야 한다.
          const heldSnapshot = [...held];
          const axisMod = await import('./src/player/input.js');
          const axisSnapshot = axisMod.getMoveAxis();
          // dt/게임루프 자체가 죽었는지(전역 프리즈) vs SIM의 위치 갱신만
          // 안 되는지(controller.js 국소 문제)를 가르기 위해, 위치와 무관한
          // 진행 지표(믹서 애니메이션 시간, 그레인 셰이더 uTime)가 그동안
          // 계속 흘렀는지 두 프레임에 걸쳐 확인한다.
          const mixerT0 = window.__debug.player.mixer ? window.__debug.player.mixer.time : null;
          const uTime0 = window.__debug.post ? window.__debug.post.gradePass.uniforms.uTime.value : null;
          await raf();
          const mixerT1 = window.__debug.player.mixer ? window.__debug.player.mixer.time : null;
          const uTime1 = window.__debug.post ? window.__debug.post.gradePass.uniforms.uTime.value : null;
          setHeld(new Set());
          return {
            ok: false, stuck: true, pos, frames,
            heldKeys: heldSnapshot, axisAtFreeze: axisSnapshot, wantedAtFreeze: [...wanted],
            loopAlive: { mixerT0, mixerT1, uTime0, uTime1, advancing: (mixerT1 !== mixerT0) || (uTime1 !== uTime0) },
          };
        }
      }
    }
    setHeld(new Set());
    return { ok: false, stuck: false, pos: getPos(), frames, timeout: true };
  }, { target, tol, maxFrames });
}

async function teleport(x, z) {
  await page.evaluate(({ x, z }) => {
    window.__debug.player.root.position.set(x, 0, z);
  }, { x, z });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
}

// ⚠️ 멈춘 "결과" 위치(resolve 적용 후 최종 정지 좌표)에서 콜라이더를 검사하면
// 언제나 0개가 나온다 — resolve()는 정의상 안 겹치는 자리에 플레이어를
// 놓고 끝나기 때문이다(처음에 이렇게 재서 "겹치는 콜라이더 0개"라는 거짓
// 음성을 봤다). 진짜 원인은 resolve() 적용 *전*, 그 프레임에 입력대로
// 한 걸음 옮긴 "중간 위치"에 있다 — controller.js의 이동 계산을 그대로
// 재현해서 중간 위치를 구하고, 거기서 콜라이더를 검사해야 한다.
async function diagnoseAt(pos, axisAtFreeze, yaw) {
  return page.evaluate(async ({ pos, axisAtFreeze, yaw }) => {
    const { circleVsAABB } = await import('./src/physics/resolve.js');
    const { TAG } = await import('./src/core/tags.js');
    const { PLAYER } = await import('./src/config/player.js');
    const THREE = window.__debug.THREE;
    const player = window.__debug.player;
    const r = player.radius;
    const UP = new THREE.Vector3(0, 1, 0);

    // controller.js와 정확히 같은 이동 계산 — dt는 클램프 상한(1/30)을 쓴다
    // (m4-rooms류 walker는 swiftshader 프레임이 30fps 근방으로 자주 클램프에
    // 걸리는 걸 앞선 트레이스에서 실측했다).
    const dt = 1 / 30;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, yaw);
    const move = new THREE.Vector3(0, 0, 0)
      .addScaledVector(forward, -axisAtFreeze.z)
      .addScaledVector(right, axisAtFreeze.x);
    if (move.lengthSq() > 1e-6) move.normalize();
    const mid = { x: pos.x + move.x * PLAYER.speed * dt, z: pos.z + move.z * PLAYER.speed * dt };

    const box = new THREE.Box3();
    const named = [];
    window.__debug.scene.traverse((o) => {
      if (!o.isMesh || !o.userData[TAG.SOLID]) return;
      box.setFromObject(o);
      let label = null;
      let cur = o;
      while (cur) {
        const id = cur.userData && cur.userData[TAG.INTERACTIVE];
        if (typeof id === 'string') { label = id; break; }
        cur = cur.parent;
      }
      if (!label) {
        const cx = ((box.min.x + box.max.x) / 2).toFixed(2);
        const cz = ((box.min.z + box.max.z) / 2).toFixed(2);
        label = `(무태그) ${o.geometry?.type || o.type} world center(${cx},${cz})`;
      }
      named.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, label });
    });

    function findLabel(b) {
      const m = named.find((n) =>
        Math.abs(n.minX - b.minX) < 1e-6 && Math.abs(n.maxX - b.maxX) < 1e-6 &&
        Math.abs(n.minZ - b.minZ) < 1e-6 && Math.abs(n.maxZ - b.maxZ) < 1e-6);
      return m ? m.label : '(이름 매칭 실패)';
    }

    // (a) 최종 정지 위치 — 참고용, 원래 이렇게 봤다가 거짓 음성(0개)을 냈다.
    const colliders = window.__debug.getColliders();
    const restOverlaps = [];
    for (const b of colliders) {
      const hit = circleVsAABB(pos.x, pos.z, r, b);
      if (hit) restOverlaps.push({ nx: hit.nx, nz: hit.nz, push: hit.push, label: findLabel(b), box: b });
    }

    // (b) 진짜 원인 — resolve() 적용 *전* 중간 위치에서의 겹침.
    const midOverlaps = [];
    let sumX = 0;
    let sumZ = 0;
    for (const b of colliders) {
      const hit = circleVsAABB(mid.x, mid.z, r, b);
      if (!hit) continue;
      midOverlaps.push({ nx: hit.nx, nz: hit.nz, push: hit.push, label: findLabel(b), box: b });
      sumX += hit.nx * hit.push;
      sumZ += hit.nz * hit.push;
    }

    return {
      pos, mid, r, move: { x: move.x, z: move.z },
      restOverlapCount: restOverlaps.length, restOverlaps,
      overlapCount: midOverlaps.length, overlaps: midOverlaps, pushSum: { x: sumX, z: sumZ },
      playerFacing: player.root.rotation.y,
      playerY: player.root.position.y,
    };
  }, { pos, axisAtFreeze, yaw });
}

for (const leg of legs) {
  if (leg.via) {
    let viaFailed = false;
    for (const wp of leg.via) {
      const vr = await walkLeg(wp);
      if (!vr.ok) {
        console.log(`FAIL ${leg.name}(경유점 ${wp.x},${wp.z} 도달 실패) → (${vr.pos.x.toFixed(2)},${vr.pos.z.toFixed(2)})`);
        failCount++;
        failedLegNames.push(leg.name);
        viaFailed = true;
        break;
      }
    }
    if (viaFailed) continue;
  }
  const r = await walkLeg(leg.target);
  if (r.ok) {
    console.log(`OK   ${leg.name} → 목표(${leg.target.x},${leg.target.z}) 실제(${r.pos.x.toFixed(2)},${r.pos.z.toFixed(2)}) ${r.frames}프레임`);
  } else if (r.stuck) {
    console.log(`STUCK ${leg.name} → (${r.pos.x.toFixed(4)},${r.pos.z.toFixed(4)})에서 3프레임 연속 정지 (${r.frames}프레임째)`);
    console.log(`      멈추는 순간 눌려 있던 키: ${JSON.stringify(r.heldKeys)}  axis=${JSON.stringify(r.axisAtFreeze)}  wanted=${JSON.stringify(r.wantedAtFreeze)}`);
    console.log(`      게임루프 진행 여부: ${JSON.stringify(r.loopAlive)}`);
    failCount++;
    failedLegNames.push(leg.name);
    if (!stuckReport) {
      const yaw = await page.evaluate(() => (window.__debug.followCam ? window.__debug.followCam.getYaw() : 0));
      stuckReport = await diagnoseAt(r.pos, r.axisAtFreeze, yaw);
      stuckReport.heldKeys = r.heldKeys;
      stuckReport.axisAtFreeze = r.axisAtFreeze;
      stuckReport.wantedAtFreeze = r.wantedAtFreeze;
      stuckReport.yaw = yaw;
    }
    // ⚠️ 예전엔 여기서 break했다 — "한 번 멈추면 게임이 죽은 상태"라는
    // 가정이었는데, 그건 그때의 유일한 원인(책상 코너 트랩)이 진짜로
    // 전역을 얼려버렸기 때문이었다. M9-B로 D2가 잠기면서 "막힘"의 원인이
    // 하나 더 생겼다 — 잠긴 문에 부딪히는 건 국소적이고 정상적인 차단
    // 이라 플레이어가 다른 방향으로는 얼마든지 움직일 수 있다(m4-rooms.mjs
    // 로 11/13 실측 확인). 그래서 이제는 멈춰도 다음 구간을 계속 시도한다.
  } else {
    console.log(`FAIL ${leg.name} → (${r.pos.x.toFixed(2)},${r.pos.z.toFixed(2)}) ${r.frames}프레임 안에 도달도 정지도 아님(타임아웃)`);
    failCount++;
    failedLegNames.push(leg.name);
  }
}

// ---------- 좁은 통로 테스트: 책상↔의자 사이 ----------
// 간격을 하드코딩하지 않는다 — 실측 실패(위 STUCK)의 원인이 "추정 간격"이
// 아니라 실제 콜라이더 박스였던 것처럼, 여기도 씬에서 desk/chair의 실제
// AABB를 쿼리해서 그 사이를 정면으로 관통하는 경로를 만든다.
console.log('\n--- 좁은 통로: 책상↔의자 ---');
const gapInfo = await page.evaluate(async () => {
  const { TAG } = await import('./src/core/tags.js');
  const THREE = window.__debug.THREE;
  const box = new THREE.Box3();
  let desk = null;
  let chair = null;
  window.__debug.scene.traverse((o) => {
    if (!o.isMesh || !o.userData[TAG.SOLID]) return;
    let cur = o;
    let id = null;
    while (cur) {
      const v = cur.userData && cur.userData[TAG.INTERACTIVE];
      if (typeof v === 'string') { id = v; break; }
      cur = cur.parent;
    }
    if (id === 'living.desk') { box.setFromObject(o); desk = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }; }
    if (id === 'living.chair') { box.setFromObject(o); chair = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }; }
  });
  return { desk, chair, radius: window.__debug.player.radius };
});

if (gapInfo.desk && gapInfo.chair) {
  const gapZ = gapInfo.chair.minZ - gapInfo.desk.maxZ; // desk 남쪽 끝 ~ chair 북쪽 끝
  const midX = (Math.max(gapInfo.desk.minX, gapInfo.chair.minX) + Math.min(gapInfo.desk.maxX, gapInfo.chair.maxX)) / 2;
  console.log(`실측 간격(Z): ${gapZ.toFixed(3)}m, 플레이어 지름: ${(gapInfo.radius * 2).toFixed(3)}m → ${gapZ >= gapInfo.radius * 2 ? '이론상 통과 가능' : '이론상 통과 불가(더 좁음) — 이 경우 STUCK이 아니라 그냥 못 지나가면 정상'}`);

  await teleport(midX, gapInfo.desk.minZ - 0.6);
  const gapResult = await walkLeg({ x: midX, z: gapInfo.chair.maxZ + 0.6 }, { tol: 0.25, maxFrames: 300 });
  const passable = gapZ >= gapInfo.radius * 2;
  // ⚠️ 실측 간격(0.315m)이 플레이어 지름(0.44m)보다 좁다 — 여긴 물리적으로
  // 못 지나가는 게 정상이다. "3프레임 정지=STUCK"은 정상적인 벽 막힘도
  // 똑같이 잡아내므로(벽에 기대 서 있으면 위치가 안 변하는 게 당연하다),
  // passable=false일 때는 STUCK을 실패로 안 센다 — 여기서 재는 건 "막혔을
  // 때도 조용히 멈추지 게임이 이상해지진 않는지"뿐이다. passable=true인데
  // STUCK이면 그건 진짜 회귀다.
  if (gapResult.ok) {
    console.log(`OK   책상↔의자 통과 → (${gapResult.pos.x.toFixed(2)},${gapResult.pos.z.toFixed(2)}) ${gapResult.frames}프레임`);
  } else if (gapResult.stuck) {
    if (passable) {
      console.log(`STUCK(회귀) 책상↔의자 → (${gapResult.pos.x.toFixed(4)},${gapResult.pos.z.toFixed(4)})에서 정지 — 이론상 지나갈 수 있는 폭인데 못 지나감`);
      failCount++;
      failedLegNames.push('책상↔의자');
    } else {
      console.log(`정상 차단 책상↔의자 → (${gapResult.pos.x.toFixed(4)},${gapResult.pos.z.toFixed(4)})에서 멈춤 — 실측 간격(${gapZ.toFixed(3)}m) < 플레이어 지름이라 못 지나가는 게 맞음(버그 아님)`);
    }
  } else {
    console.log(`FAIL(타임아웃, 멈추진 않음) 책상↔의자 → (${gapResult.pos.x.toFixed(2)},${gapResult.pos.z.toFixed(2)})`);
    if (passable) { failCount++; failedLegNames.push('책상↔의자'); }
  }
} else {
  console.log(`SKIP: living.desk 또는 living.chair 콜라이더를 못 찾음(desk=${!!gapInfo.desk}, chair=${!!gapInfo.chair})`);
}

} finally {
  await closeBrowser();
  server.close();
}

console.log('');
console.log('로그:', logs.length ? logs : '없음');

if (stuckReport) {
  console.log('');
  console.log('=== 멈춘 지점 진단 ===');
  console.log(`정지 위치: (${stuckReport.pos.x.toFixed(4)}, ${stuckReport.pos.z.toFixed(4)})  플레이어 반지름: ${stuckReport.r}  y=${stuckReport.playerY}`);
  console.log(`멈추는 순간 눌려 있던 키: ${JSON.stringify(stuckReport.heldKeys)}  axis=${JSON.stringify(stuckReport.axisAtFreeze)}  카메라yaw=${stuckReport.yaw}`);
  console.log(`(참고) 정지 위치 자체에서의 겹침: ${stuckReport.restOverlapCount}개 — resolve()가 이미 안 겹치게 놓은 자리라 원래 0이 정상(거짓 음성 주의).`);
  console.log(`이번 프레임에 이동 계산대로 한 걸음 옮긴 중간 위치(resolve 적용 전): (${stuckReport.mid.x.toFixed(4)}, ${stuckReport.mid.z.toFixed(4)})  이동벡터=(${stuckReport.move.x.toFixed(4)},${stuckReport.move.z.toFixed(4)})`);
  console.log(`그 중간 위치에서 겹치는 콜라이더 ${stuckReport.overlapCount}개:`);
  for (const o of stuckReport.overlaps) {
    console.log(
      `  - ${o.label}\n` +
      `      box X[${o.box.minX.toFixed(3)},${o.box.maxX.toFixed(3)}] Z[${o.box.minZ.toFixed(3)},${o.box.maxZ.toFixed(3)}]\n` +
      `      n=(${o.nx.toFixed(3)},${o.nz.toFixed(3)}) push=${o.push.toFixed(4)} → 벡터=(${(o.nx * o.push).toFixed(4)},${(o.nz * o.push).toFixed(4)})`
    );
  }
  console.log(`push 벡터 합: (${stuckReport.pushSum.x.toFixed(5)}, ${stuckReport.pushSum.z.toFixed(5)})  크기=${Math.hypot(stuckReport.pushSum.x, stuckReport.pushSum.z).toFixed(5)}`);
  const magnitude = Math.hypot(stuckReport.pushSum.x, stuckReport.pushSum.z);
  const stepMag = Math.hypot(stuckReport.move.x, stuckReport.move.z) * 2.5 * (1 / 30); // PLAYER.speed 하드코딩 아님 — 표시용 근사
  if (stuckReport.overlapCount >= 2 && Math.abs(magnitude - stepMag) < 0.005) {
    console.log('→ push 합의 크기가 그 프레임 이동량과 거의 같다(방향은 정반대): 여러 콜라이더의 push 합이 그 프레임 이동을 정확히 상쇄하고 있다.');
  } else if (stuckReport.overlapCount >= 2) {
    console.log('→ 콜라이더 2개 이상 겹쳤지만 합이 이동량과 다르다: 단순 상쇄가 아닌 다른 패턴 의심.');
  } else if (stuckReport.overlapCount === 1) {
    console.log('→ 겹치는 콜라이더가 1개뿐: 상쇄가 아니라 해당 콜라이더 하나가 이동 방향과 거의 정반대로 막고 있다(정면 충돌).');
  } else {
    console.log('→ 중간 위치에서도 겹치는 콜라이더가 없다: 이 진단으로는 원인 특정 실패, 추가 조사 필요.');
  }
} else {
  console.log('');
  console.log('STUCK 재현 안 됨 — 이번 실행에서는 3프레임 연속 정지가 관측되지 않았다.');
}

console.log('');
console.log(`총 ${legs.length}개 구간 중 실패 ${failCount}개`);

// 항상 빨간불이면 새 실패가 생겨도 아무도 못 알아챈다 — KNOWN_FAILURES에
// 있는 이름만 실패했으면 "알려진 예외"로 보고 exit 0, 목록에 없는 새
// 실패가 하나라도 있으면 exit 1.
const unknownFailures = failedLegNames.filter((n) => !KNOWN_FAILURES.includes(n));
if (unknownFailures.length > 0) {
  console.log(`FAIL: 알려지지 않은 실패 ${unknownFailures.length}건 — ${unknownFailures.join(', ')}`);
  process.exit(1);
} else if (failedLegNames.length > 0) {
  console.log(`알려진 예외 ${failedLegNames.length}건(KNOWN_FAILURES) — 통과 처리`);
  process.exit(0);
} else {
  console.log('전부 통과');
  process.exit(0);
}
