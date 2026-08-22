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
  let joystickInfo = null;
  let moveInfo = null;
  let simulInfo = null;

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
    // ---------- (e) 가상 조이스틱 표시 검사 ----------
    const joystickInfo = await page.evaluate(() => {
      const el = document.getElementById('virtual-joystick-container');
      const knob = document.getElementById('virtual-joystick-knob');
      const base = document.getElementById('virtual-joystick-base');
      if (!el) return { exists: false, visible: false };
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
      return {
        exists: true,
        visible: isVisible,
        rect: { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom },
        knobExists: !!knob,
        baseExists: !!base,
      };
    });

    // ---------- (f) 조이스틱 터치 드래그로 캐릭터 실제 이동 검증 ----------
    let moveInfo = null;
    if (joystickInfo.visible) {
      const posBefore = await page.evaluate(() => {
        const p = window.__debug?.player?.root?.position;
        return p ? { x: p.x, y: p.y, z: p.z } : null;
      });

      if (posBefore) {
        const baseCenter = await page.evaluate(() => {
          const base = document.getElementById('virtual-joystick-base');
          if (!base) return null;
          const r = base.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        if (baseCenter) {
          // 조이스틱을 위로 45px 드래그 (전진/W 방향)
          const jTouch = await page.touchscreen.touchStart(baseCenter.x, baseCenter.y);
          await jTouch.move(baseCenter.x, baseCenter.y - 45);
          await sleep(500); // 0.5초간 전진 이동 대기
          await jTouch.end();
          await sleep(100);

          const posAfter = await page.evaluate(() => {
            const p = window.__debug?.player?.root?.position;
            return p ? { x: p.x, y: p.y, z: p.z } : null;
          });

          if (posAfter) {
            const dx = posAfter.x - posBefore.x;
            const dz = posAfter.z - posBefore.z;
            const dist = Math.hypot(dx, dz);
            moveInfo = {
              posBefore,
              posAfter,
              deltaX: dx,
              deltaZ: dz,
              distMoved: dist,
              moved: dist >= 0.15, // 0.5초 동안 최소 0.15m 이상 전진
            };
          }
        }
      }
    }

    // ---------- (g) 조이스틱 + 우측 시점회전 동시 입력 검증 ----------
    let simulInfo = null;
    if (joystickInfo.visible) {
      const yawBeforeSim = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? 0);
      const posBeforeSim = await page.evaluate(() => {
        const p = window.__debug?.player?.root?.position;
        return p ? { x: p.x, z: p.z } : null;
      });

      const baseCenter = await page.evaluate(() => {
        const base = document.getElementById('virtual-joystick-base');
        if (!base) return null;
        const r = base.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });

      if (baseCenter && posBeforeSim) {
        // 1번 터치: 조이스틱 전진 유지
        const jTouch = await page.touchscreen.touchStart(baseCenter.x, baseCenter.y);
        await jTouch.move(baseCenter.x, baseCenter.y - 45);

        // 2번 터치: 우측 화면(폭 70% -> 85%)에서 시점 회전 스와이프
        const rightStartX = vp.width * 0.70;
        const rightEndX = vp.width * 0.85;
        const rightY = vp.height * 0.5;

        const rTouch = await page.touchscreen.touchStart(rightStartX, rightY);
        for (let i = 1; i <= 6; i++) {
          await rTouch.move(rightStartX + ((rightEndX - rightStartX) * i) / 6, rightY);
          await sleep(20);
        }
        await sleep(250);

        const yawAfterSim = await page.evaluate(() => window.__debug?.followCam?.getYaw?.() ?? 0);
        const posAfterSim = await page.evaluate(() => {
          const p = window.__debug?.player?.root?.position;
          return p ? { x: p.x, z: p.z } : null;
        });

        await rTouch.end();
        await jTouch.end();
        await sleep(100);

        if (posAfterSim) {
          const yawDelta = Math.abs(yawAfterSim - yawBeforeSim);
          const distSim = Math.hypot(posAfterSim.x - posBeforeSim.x, posAfterSim.z - posBeforeSim.z);
          simulInfo = {
            yawDelta,
            distSim,
            simulOk: yawDelta >= 0.01 && distSim >= 0.1,
          };
        }
      }
    }
  }

  results.push({
    vp, loadTimedOut, preClick, postClickRects, dragInfo, renderInfo, canvasRes, rendererInfo,
    joystickInfo, moveInfo, simulInfo, consoleErrors,
  });
  await page.close();
}

// ---------- (h) 데스크톱 뷰포트(960x600, mouse)에서 조이스틱 미표시 검사 ----------
const desktopPage = await browser.newPage();
await desktopPage.setViewport({ width: 960, height: 600, isMobile: false, hasTouch: false });
await desktopPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await sleep(300);
const desktopNotice = await desktopPage.evaluate(() => !!document.getElementById('mobile-notice'));
await desktopPage.waitForFunction(() => {
  const btn = document.getElementById('audio-start-btn');
  return btn && !btn.disabled;
}, { timeout: 15000 }).catch(() => {});
await desktopPage.click('#audio-start-btn');
await sleep(600);
const desktopJoystick = await desktopPage.evaluate(() => {
  const el = document.getElementById('virtual-joystick-container');
  if (!el) return { exists: false, visible: false };
  const style = window.getComputedStyle(el);
  return {
    exists: true,
    visible: style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0,
    display: style.display,
  };
});
await desktopPage.close();

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
console.log('\n=== 모바일 가상 조이스틱 및 터치 검증 결과 ===\n');
console.log('| 뷰포트 | (a)렌더성공 | (b)시점회전 | (c)안내표시 | (d)조이스틱표시 | (e)조이스틱이동 | (f)동시입력 |');
console.log('|---|---|---|---|---|---|---|');
for (const r of results) {
  const a = r.loadTimedOut ? 'FAIL(타임아웃)' : (r.renderInfo?.pass ? 'OK' : 'FAIL');
  const b = r.dragInfo ? `${r.dragInfo.deltaRad.toFixed(3)}rad(${r.dragInfo.deltaDeg.toFixed(1)}°)` : 'N/A';
  const c = r.preClick.hasNotice ? 'OK' : 'FAIL(안 뜸)';
  const d = r.joystickInfo?.visible ? 'OK' : 'FAIL';
  const e = r.moveInfo?.moved ? `OK (${r.moveInfo.distMoved.toFixed(2)}m)` : 'FAIL';
  const f = r.simulInfo?.simulOk ? 'OK' : 'FAIL';
  console.log(`| ${r.vp.label} | ${a} | ${b} | ${c} | ${d} | ${e} | ${f} |`);
}

console.log('\n--- 데스크톱(960x600) 비터치 환경 검사 ---');
console.log(`데스크톱 조이스틱 미표시: ${!desktopJoystick.visible ? 'OK (display: none)' : 'FAIL (노출됨!)'}`);
console.log(`데스크톱 모바일안내 미표시: ${!desktopNotice ? 'OK' : 'FAIL'}`);

console.log('\n=== 상세 내역 ===\n');
for (const r of results) {
  console.log(`--- ${r.vp.label} ---`);
  if (r.loadTimedOut) {
    console.log('  로딩이 15초 내 안 끝남');
    continue;
  }
  console.log(`  안내 문구: "${r.preClick.noticeText || ''}"`);
  console.log(`  조이스틱: visible=${r.joystickInfo?.visible} rect=${JSON.stringify(r.joystickInfo?.rect)}`);
  if (r.moveInfo) {
    console.log(`  조이스틱 이동: dist=${r.moveInfo.distMoved.toFixed(3)}m (dx=${r.moveInfo.deltaX.toFixed(3)}, dz=${r.moveInfo.deltaZ.toFixed(3)}) → ${r.moveInfo.moved ? 'OK' : 'FAIL'}`);
  }
  if (r.simulInfo) {
    console.log(`  동시 입력(조이스틱 이동+카메라 회전): Δyaw=${r.simulInfo.yawDelta.toFixed(3)}rad, dist=${r.simulInfo.distSim.toFixed(3)}m → ${r.simulInfo.simulOk ? 'OK' : 'FAIL'}`);
  }
  if (r.dragInfo) {
    console.log(`  우측 시점 회전: Δyaw=${r.dragInfo.deltaRad.toFixed(4)}rad (${r.dragInfo.deltaDeg.toFixed(1)}°)`);
  }
  if (r.renderInfo) {
    console.log(`  렌더 품질: avgLuma=${r.renderInfo.abs.avgLuma.toFixed(1)} 검정비=${(r.renderInfo.abs.nearBlackRatio * 100).toFixed(1)}% → ${r.renderInfo.pass ? 'OK' : 'FAIL'}`);
  }
}

const allPass = results.every((r) => !r.loadTimedOut && r.renderInfo?.pass && r.joystickInfo?.visible && r.moveInfo?.moved && r.simulInfo?.simulOk) && !desktopJoystick.visible && !desktopNotice;

if (allPass) {
  console.log('\n모든 모바일 뷰포트 및 데스크톱 검증 통과!');
  process.exit(0);
} else {
  console.error('\n일부 항목 검증 실패');
  process.exit(1);
}

