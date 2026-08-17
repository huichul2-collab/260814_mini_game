#!/usr/bin/env node
// merge 판단을 픽셀이 아니라 씬 그래프로 한다 — "가구 리팩터링이 렌더를
// 바꿨나"는 걷기 허용오차(0.3m)+물리 dt+카메라 감쇠라는 비결정성 3겹을
// 통과한 픽셀로 물을 질문이 아니라, 씬 그래프를 직접 비교하면 노이즈
// 0으로 답이 나오는 질문이다(docs/STATE.md 참고).
//
// 헤드리스로 게임을 띄우고(rebuildFrom 이후, 즉 월드가 다 조립된 뒤)
// scene.traverse로 모든 메시를 덤프한다. 플레이어·카메라·조명·후처리는
// 제외 — 월드 지오메트리만 본다. 정렬은 좌표 기준으로 고정해서 순회
// 순서 차이가 diff에 안 잡히게 한다.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

const gameDir = path.resolve(process.argv[2] || 'game');
const outFile = process.argv[3] ? path.resolve(process.argv[3]) : null;

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
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[console.error]', m.text()); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
// 씬 그래프(방/벽/소품)는 main.js 최상단에서 동기적으로 조립되고
// rebuildFrom(scene)도 그 직후 동기 호출이라, __debug가 생기는 시점이면
// 이미 다 조립된 뒤다(오디오 게이트 클릭 여부와 무관). 그래도 안전하게
// 짧게 대기한다.
await page.waitForFunction(() => !!(window.__debug && window.__debug.scene && window.__debug.getColliders), { timeout: 15000 });
await sleep(300);

const dump = await page.evaluate(() => {
  const scene = window.__debug.scene;
  const playerRoot = window.__debug.player ? window.__debug.player.root : null;

  function isUnderPlayer(o) {
    let cur = o;
    while (cur) {
      if (cur === playerRoot) return true;
      cur = cur.parent;
    }
    return false;
  }

  function round(n, d = 4) {
    const f = 10 ** d;
    return Math.round(n * f) / f;
  }

  const THREE = window.__debug.THREE;
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const euler = new THREE.Euler();

  // ⚠️ world/exterior.js가 나무 스케일을 `0.8 + Math.random()*0.5`로 매번
  // 랜덤하게 준다(그 파일에서 Math.random()을 쓰는 유일한 곳 — grep으로
  // 확인함). 씬을 새로고침할 때마다 나무 트렁크/잎의 월드 Y가 바뀌어서
  // scene-dump를 그대로 두 번 찍기만 해도 다르게 나온다(직접 재현함).
  // 가구 리팩터링과 전혀 무관한 노이즈라, exterior.js 자신의 나무 배치
  // 규칙과 똑같은 경계(X/Z ±8.5 — 집+마당 바깥)로 걸러서 집+마당 안쪽만
  // 덤프한다. 하늘돔/언덕/나무는 좌표가 전부 이 경계 밖이라 자동 제외되고,
  // 지면(ground)은 원점 근처라 남지만 정점 변위가 고정 수식이라 안전하다.
  const BBOX = 8.5;
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh) return; // 조명/카메라/그룹은 isMesh=false라 자동 제외
    if (playerRoot && isUnderPlayer(o)) return; // 플레이어 캐릭터 메시 제외

    o.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    if (Math.abs(wp.x) > BBOX || Math.abs(wp.z) > BBOX) return; // 집+마당 바깥(원경 장식) 제외
    o.matrixWorld.decompose(pos, quat, scl);
    euler.setFromQuaternion(quat);

    const geoParams = {};
    if (o.geometry && o.geometry.parameters) {
      for (const [k, v] of Object.entries(o.geometry.parameters)) {
        geoParams[k] = typeof v === 'number' ? round(v, 4) : v;
      }
    }

    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const colorHex = mat && mat.color ? mat.color.getHex() : null;

    out.push({
      name: o.name || null,
      position: { x: round(pos.x), y: round(pos.y), z: round(pos.z) },
      rotation: { x: round(euler.x), y: round(euler.y), z: round(euler.z) },
      scale: { x: round(scl.x), y: round(scl.y), z: round(scl.z) },
      geometry: { type: o.geometry ? o.geometry.type : null, params: geoParams },
      colorHex,
      userData: { ...o.userData },
    });
  });

  return out;
});

await browser.close();
server.close();

// 정렬 고정 — 좌표(x→y→z) 다음 geometry.type을 타이브레이크로 써서 씬
// 순회 순서 차이가 diff에 안 잡히게 한다.
dump.sort((a, b) => {
  if (a.position.x !== b.position.x) return a.position.x - b.position.x;
  if (a.position.y !== b.position.y) return a.position.y - b.position.y;
  if (a.position.z !== b.position.z) return a.position.z - b.position.z;
  return (a.geometry.type || '').localeCompare(b.geometry.type || '');
});

const json = JSON.stringify(dump, null, 2);
if (outFile) {
  fs.writeFileSync(outFile, json);
  console.error(`[scene-dump] ${dump.length}개 메시 → ${outFile}`);
} else {
  process.stdout.write(json + '\n');
  console.error(`[scene-dump] ${dump.length}개 메시`);
}
