#!/usr/bin/env node
// 모바일 동작 현황 파악 — 아직 가상 조이스틱은 없다("PC 권장" 안내만 있음).
// 실제로 뭐가 되고 안 되는지 스크린샷+측정으로 확인한다. 조이스틱 등
// 기능 추가는 이 스크립트의 목적이 아니다(현황 파악 전용).
//
// 뷰포트 4종(아이폰/안드로이드/태블릿/320폭) 각각에서:
//   (a) 렌더 성공 — room-tint-check.mjs와 같은 절대 하한(휘도/검정비율/최대픽셀)
//   (b) 시점 회전 — 터치(touchstart/move/end)로 카메라가 실제로 움직이는지.
//       드래그 시작·끝 좌표는 반드시 뷰포트 폭 20%~80% 안으로 제한한다 —
//       화면 밖 좌표로 터치 이벤트를 쏘면(실기기에서 불가능한 입력) 측정값이
//       "사용자가 실제로 한 번 쓸어서 얻는 회전량"과 무관해진다. yaw를 직접
//       읽어 라디안/도 단위로 보고한다(카메라 위치 유클리드 거리는 줌/피치가
//       섞여 회전량 판단 지표로 부적합해서 안 쓴다).
//       (followCamera.js는 pointerdown/move/up만 듣는다 — 브라우저가 터치를
//       포인터 이벤트로 변환해주는지가 관건. player 이동은 키보드 전용이라
//       테스트 대상이 아님)
//   (c) "PC 권장" 안내 표시 여부
//   (d) UI(#hint, #loading 내부 버튼/안내) 화면 밖 잘림 여부
// 추가로 renderer.info(draw call/삼각형/geometry 수)를 측정한다 — swiftshader
// 헤드리스 FPS는 실기기 GPU 성능과 무관해서 무의미하다는 게 실측으로 확인됐다
// (이전 버전 결과: 태블릿 해상도에서 6fps대 — 소프트웨어 래스터라이저가 큰
// 프레임버퍼를 못 따라간 것뿐, 실기기 성능과는 별개). renderer.info는 하드웨어
// 독립적인 씬 복잡도 지표라 이걸로 대신한다.
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

const VIEWPORTS = [
  { id: 'iphone', label: 'iPhone(390x844,dpr3)', width: 390, height: 844, deviceScaleFactor: 3 },
  { id: 'android', label: 'Android(360x800,dpr2.75)', width: 360, height: 800, deviceScaleFactor: 2.75 },
  { id: 'tablet', label: 'Tablet(820x1180,dpr2)', width: 820, height: 1180, deviceScaleFactor: 2 },
  { id: 'small320', label: 'Small(320x568,dpr2)', width: 320, height: 568, deviceScaleFactor: 2 },
];

const server = await serve(gameDir);
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
});

// 검사 도중 예외가 나도 chrome.exe가 안 남게 finally에서 닫는다. exit/SIGINT
// 훅은 그마저 못 지나간 경우(강제 종료 등)를 위한 마지막 안전망이다. 이
// 스크립트는 브라우저를 2개 띄운다(뷰포트별 browser + 사후분석용
// sampleBrowser) — 둘 다 훅에 건다.
const liveBrowsers = new Set([browser]);
function trackBrowser(b) { liveBrowsers.add(b); return b; }
async function closeAllBrowsers() {
  for (const b of liveBrowsers) await b.close().catch(() => {});
  liveBrowsers.clear();
}
process.on('exit', () => {
  for (const b of liveBrowsers) b.process()?.kill('SIGKILL');
});
process.on('SIGINT', async () => {
  await closeAllBrowsers();
  server.close();
  process.exit(1);
});

const results = [];

try {
for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({
    width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: true, hasTouch: true,
  });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });

  // ---------- (c) 안내 표시 + 로딩 단계 UI 잘림 ----------
  await sleep(300); // mobile-notice는 gate.js가 동기로 즉시 주입하니 짧은 대기면 충분
  const preClick = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    function rectOf(id) {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        overflow: r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5,
      };
    }
    const notice = document.getElementById('mobile-notice');
    return {
      vw, vh,
      hasNotice: !!notice,
      noticeText: notice ? notice.textContent : null,
      rects: { loading: rectOf('loading'), notice: rectOf('mobile-notice'), btn: rectOf('audio-start-btn') },
    };
  });

  // 로딩 완료 대기 (10초 안전망 + 여유)
  let loadTimedOut = false;
  await page.waitForFunction(() => {
    const btn = document.getElementById('audio-start-btn');
    return btn && !btn.disabled;
  }, { timeout: 15000 }).catch(() => { loadTimedOut = true; });

  // ---------- 시작 버튼 터치 탭 (실제 터치 경로로) ----------
  let renderInfo = null;
  let dragInfo = null;
  let postClickRects = null;
  let rendererInfo = null;
  let canvasRes = null;

  if (!loadTimedOut) {
    const btnBox = await page.evaluate(() => {
      const btn = document.getElementById('audio-start-btn');
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const tap = await page.touchscreen.touchStart(btnBox.x, btnBox.y);
    await tap.end();
    await sleep(900); // 페이드아웃(0.4s) + 씬 안정화 여유

    // ---------- (d) 시작 후 UI(#hint) 잘림 ----------
    postClickRects = await page.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const el = document.getElementById('hint');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        visible: !el.classList.contains('hidden'),
        overflow: r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5,
      };
    });

    // ---------- (a) 렌더 성공 스크린샷 — 드래그 테스트로 카메라 각도를
    // 바꾸기 전, 초기 대기 시점에서 찍는다. 드래그 후에 찍으면 카메라가
    // 캐릭터 뒤통수 클로즈업 등 임의 각도로 가버려서 "렌더가 안 됐다"가
    // 아니라 "그 프레임이 우연히 어둡다/밝은 픽셀이 없다"를 측정하게 되어
    // 렌더 성공 여부와 무관한 거짓 FAIL이 난다.
    const shotPath = path.join(outDir, `m9-mobile-${vp.id}.png`);
    await page.screenshot({ path: shotPath });
    renderInfo = { shotPath };

    // ---------- renderer.info (draw call / 삼각형 / geometry 수) ----------
    // ⚠️ 이 프로젝트는 EffectComposer(RenderPass → OutputPass → GradeGrainVignetteShader
    // 3-패스)를 쓴다. WebGLRenderer.info는 autoReset=true가 기본이라 render() 호출마다
    // 리셋되는데, 컴포저의 마지막 패스(풀스크린 삼각형 셰이더)가 "가장 마지막 render()
    // 호출"이라 그냥 읽으면 calls=1/triangles=1(그 풀스크린 삼각형)만 잡히고 실제
    // RenderPass가 그린 씬 지오메트리는 이미 리셋되어 사라진다(최초 실측 시 실제로
    // 이렇게 나와서 발견함). autoReset을 껐다가 정확히 프레임 하나만 기다린 뒤 같은
    // page.evaluate 호출 안에서 원자적으로 읽어야 한다 — 별도 evaluate 호출로 나누면
    // 그 사이에 게임 루프의 다음 프레임이 끼어들 여지가 생긴다.
    rendererInfo = await page.evaluate(() => new Promise((resolve) => {
      const r = window.__debug?.renderer;
      if (!r) { resolve(null); return; }
      r.info.autoReset = false;
      r.info.reset();
      requestAnimationFrame(() => {
        resolve({
          calls: r.info.render.calls,
          triangles: r.info.render.triangles,
          geometries: r.info.memory.geometries,
          textures: r.info.memory.textures,
        });
        r.info.autoReset = true;
      });
    }));

    // ---------- 캔버스 해상도 ----------
    canvasRes = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, dpr: window.devicePixelRatio } : null;
    });

    // ---------- (b) 터치 드래그로 시점 회전 — 화면 안(폭 20%~80%)만 사용 ----------
    // 이전 버전은 화면 중심에서 임의의 오프셋(최대 +96/-48px)만큼만 움직였는데도
    // 카메라가 캐릭터 뒤통수 클로즈업까지 가버릴 만큼 큰 회전이 나왔다 — 그
    // 자체는 dragSensitivity 계산상 정상이지만, "화면 밖 좌표"를 실수로 잘못
    // 재는 게 아니라는 걸 확실히 하기 위해 여기서는 아예 좌표를 뷰포트 안으로
    // 강제 제한하고, 카메라 위치(줄+피치가 섞여 회전량 판단에 부적합)가 아니라
    // followCam.getYaw()를 직접 읽어 라디안으로 보고한다.
    const yawBefore = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? null);
    const startX = vp.width * 0.2;
    const endX = vp.width * 0.8;
    const midY = vp.height / 2;
    const STEPS = 12;
    const drag = await page.touchscreen.touchStart(startX, midY);
    for (let i = 1; i <= STEPS; i++) {
      const x = startX + ((endX - startX) * i) / STEPS;
      await drag.move(x, midY);
      await sleep(16);
    }
    await drag.end();
    await sleep(200);
    const yawAfter = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? null);
    if (yawBefore !== null && yawAfter !== null) {
      const deltaRad = yawAfter - yawBefore;
      dragInfo = {
        yawBefore, yawAfter, deltaRad,
        deltaDeg: (deltaRad * 180) / Math.PI,
        swipePx: endX - startX,
        rotated: Math.abs(deltaRad) > 0.01,
      };
    }
  }

  results.push({
    vp, loadTimedOut, preClick, postClickRects, dragInfo, renderInfo, canvasRes, rendererInfo, consoleErrors,
  });
  await page.close();
}

// ---------- 렌더 성공 판정 (room-tint-check.mjs와 같은 절대 하한 재사용) ----------
const sampleBrowser = trackBrowser(await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] }));
const samplePage = await sampleBrowser.newPage();
async function sampleAbsolute(pngPath) {
  const b64 = fs.readFileSync(pngPath).toString('base64');
  await samplePage.setContent(`<img id="i" src="data:image/png;base64,${b64}">`);
  await samplePage.waitForSelector('#i');
  return samplePage.evaluate(() => new Promise((resolve) => {
    const img = document.getElementById('i');
    const draw = () => {
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
    if (img.decode) img.decode().then(draw).catch(draw);
    else if (img.complete) draw();
    else img.onload = draw;
  }));
}

for (const r of results) {
  if (r.renderInfo) {
    const abs = await sampleAbsolute(r.renderInfo.shotPath);
    const pass = abs.avgLuma >= 15 && abs.nearBlackRatio < 0.5 && abs.maxPixel >= 200;
    r.renderInfo.abs = abs;
    r.renderInfo.pass = pass;
  }
}
} finally {
  await closeAllBrowsers();
  server.close();
}

// ---------- 표 출력 ----------
console.log('\n=== 모바일 현황 파악 결과 ===\n');
console.log('| 뷰포트 | (a)렌더성공 | (b)시점회전(폭20~80% 스와이프) | (c)안내표시 | (d)UI잘림 |');
console.log('|---|---|---|---|---|');
for (const r of results) {
  const a = r.loadTimedOut ? 'FAIL(로딩타임아웃)' : (r.renderInfo?.pass ? 'OK' : 'FAIL');
  const b = r.dragInfo ? `${r.dragInfo.deltaRad.toFixed(3)}rad(${r.dragInfo.deltaDeg.toFixed(1)}°)` : 'N/A';
  const c = r.preClick.hasNotice ? 'OK' : 'FAIL(안 뜸)';
  const preOverflow = r.preClick.rects.notice?.overflow || r.preClick.rects.btn?.overflow || r.preClick.rects.loading?.overflow;
  const postOverflow = r.postClickRects?.overflow;
  const d = (preOverflow || postOverflow) ? `잘림 있음${preOverflow ? '(로딩UI)' : ''}${postOverflow ? '(힌트)' : ''}` : '없음';
  console.log(`| ${r.vp.label} | ${a} | ${b} | ${c} | ${d} |`);
}

console.log('\n=== 상세 ===\n');
for (const r of results) {
  console.log(`--- ${r.vp.label} ---`);
  if (r.loadTimedOut) {
    console.log('  로딩이 15초 내 안 끝남 (asset gate 타임아웃 안전망 10초를 넘김) — 렌더/드래그/FPS 측정 스킵');
    if (r.consoleErrors.length) console.log('  콘솔 에러:', r.consoleErrors);
    continue;
  }
  console.log(`  안내: hasNotice=${r.preClick.hasNotice} text="${r.preClick.noticeText || ''}"`);
  console.log(`  로딩 UI 잘림: loading=${JSON.stringify(r.preClick.rects.loading)}`);
  console.log(`             notice=${JSON.stringify(r.preClick.rects.notice)}`);
  console.log(`             btn=${JSON.stringify(r.preClick.rects.btn)}`);
  if (r.postClickRects) console.log(`  힌트(#hint) 잘림: ${JSON.stringify(r.postClickRects)}`);
  if (r.renderInfo) {
    console.log(`  렌더: avgLuma=${r.renderInfo.abs.avgLuma.toFixed(1)}(>=15) 검정비=${(r.renderInfo.abs.nearBlackRatio * 100).toFixed(1)}%(<50%) 최대픽셀=${r.renderInfo.abs.maxPixel}(>=200) → ${r.renderInfo.pass ? 'OK' : 'FAIL'}`);
    console.log(`  스크린샷: ${r.renderInfo.shotPath}`);
  }
  if (r.dragInfo) {
    console.log(`  터치 스와이프(폭 20%~80%, ${r.dragInfo.swipePx.toFixed(0)}px): yaw ${r.dragInfo.yawBefore.toFixed(4)} → ${r.dragInfo.yawAfter.toFixed(4)} rad, Δ=${r.dragInfo.deltaRad.toFixed(4)}rad (${r.dragInfo.deltaDeg.toFixed(1)}°)`);
  }
  if (r.canvasRes) {
    console.log(`  캔버스: 내부해상도=${r.canvasRes.w}x${r.canvasRes.h} CSS크기=${r.canvasRes.cssW}x${r.canvasRes.cssH} devicePixelRatio=${r.canvasRes.dpr} (renderer는 min(dpr,2) 적용)`);
  }
  if (r.rendererInfo) {
    console.log(`  renderer.info: drawCalls=${r.rendererInfo.calls} triangles=${r.rendererInfo.triangles} geometries=${r.rendererInfo.geometries} textures=${r.rendererInfo.textures}`);
  }
  if (r.consoleErrors.length) console.log(`  콘솔 에러: ${JSON.stringify(r.consoleErrors)}`);
  console.log('');
}

const anyFail = results.some((r) => r.loadTimedOut || !r.renderInfo?.pass || (r.dragInfo && !r.dragInfo.rotated) || !r.preClick.hasNotice);
console.log(anyFail ? '일부 항목 FAIL — 위 상세 참고 (조이스틱 등 기능 추가는 이 스크립트 범위 밖, 현황 보고만)' : '전부 OK');
// 현황 파악이 목적이라 exit 1로 파이프라인을 막지 않는다 — 정보성 스크립트.
process.exit(0);
