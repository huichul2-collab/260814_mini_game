import * as THREE from 'three';
import { renderer, scene, camera } from './src/core/context.js';
import { tick, onFrame, Phase } from './src/core/loop.js';
import { checkEnding } from './src/story/ending.js';
import { createSkyDome, setupFog } from './src/render/sky.js';
import { setupLighting } from './src/render/lighting.js';
import { createHouse } from './src/world/house.js';
import { initDoorLocks } from './src/world/doorLock.js';
import { createLivingRoom } from './src/world/rooms/livingRoom.js';
import { createBedA } from './src/world/rooms/bedA.js';
import { createStudy } from './src/world/rooms/study.js';
import { createBedB } from './src/world/rooms/bedB.js';
import { createExterior } from './src/world/exterior.js';
import { rebuildFrom, getColliders } from './src/physics/colliders.js';
import { createPlayer } from './src/player/character.js';
import { initController } from './src/player/controller.js';
import { createFollowCamera } from './src/camera/followCamera.js';
import { createComposer } from './src/render/post/composer.js';
import { initAudioGate } from './src/audio/gate.js';
import { playBGM } from './src/audio/audio.js';
import { initFootsteps } from './src/audio/footsteps.js';
import { loadAudioBuffer } from './src/assets/loaders.js';
import { initProbe } from './src/interaction/probe.js';
import { initInventory } from './src/ui/inventory.js';
import { unlockDoor } from './src/story/state.js';
import { startOpening } from './src/ui/opening.js';

/* ------------------------------------------------------------------ *
 *  부트스트랩 전용 파일 (로드맵 §3 "main.js는 통합자 전용").
 *  씬 구성은 전부 src/ 모듈이 하고, 여기는 조립 + 렌더 루프만 담당한다.
 *
 *  순서가 중요하다: 콜라이더는 월드가 다 지어진 뒤에 수집해야 하고,
 *  추적 카메라는 벽(TAG.FADEABLE)을 자기 생성 시점에 한 번만 스캔하므로
 *  createLivingRoom() 이후에 만들어야 한다.
 * ------------------------------------------------------------------ */

const loadingEl = document.getElementById('loading');
const hintEl = document.getElementById('hint');

scene.add(createSkyDome());
setupFog(scene);
setupLighting(scene);
createHouse(scene); // M4: layout.js 기반 바닥·벽·문
const doorLocks = initDoorLocks(scene); // M9-B: story.js LOCKS만큼 잠금 패널 — rebuildFrom 전에 있어야 초기 콜라이더에 포함됨
const livingRoom = createLivingRoom(scene, camera, renderer);
const bedA = createBedA(scene);
const study = createStudy(scene);
const bedB = createBedB(scene);
createExterior(scene); // 안개가 걸릴 원경 지형 — 이게 없으면 fog가 눈에 안 보인다

const player = createPlayer(scene, [0, 0, 1.5]); // 거실, D3 문 앞 여유 1.5m (docs/spec/M4-layout.md §5.3)
rebuildFrom(scene); // 플레이어는 solid 태그가 없으니 자기 자신과는 안 부딪힘

const followCam = createFollowCamera(camera, renderer.domElement, player.root.position, scene);
initController(player, followCam.getYaw);
initProbe(scene, camera, renderer, player); // M9-A: 가까운 사물 좌클릭 → 하단 설명
initInventory();
onFrame(() => checkEnding(player.root.position), Phase.LATE); // M9-C: 마당 첫 진입 시 종료 대사

// 디버그 훅 — 헤드리스 검증 스크립트가 위치/카메라/씬 상태를 직접 읽는 용도.
// 프로덕션 동작에는 관여하지 않는다. scene/THREE/rooms는 tools/render-check/
// prop-bounds-check.mjs가 방별 소품 월드 좌표를 계산할 때 쓴다.
window.__debug = {
  player,
  camera,
  renderer,
  followCam,
  getColliders,
  scene,
  THREE,
  rooms: { living: livingRoom.room, bedA: bedA.room, study: study.room, bedB: bedB.room },
  doorLocks, // M9-B: escape-flow.mjs가 잠금 패널 상태를 직접 조회할 때 씀
  // 검증 전용 훅 — 프로덕션 동작에는 관여하지 않는다. m4-rooms.mjs /
  // stuck-diagnose.mjs가 "기하학적으로 지나갈 수 있는가"만 재려면 퍼즐과
  // 무관하게 문을 전부 열어야 한다(escape-flow.mjs는 잠긴 상태 자체가
  // 검증 대상이라 이 훅을 쓰지 않는다). 해제 절차는 doorLock.js의 실제
  // 해제 경로(probe.js onSuccess)와 동일해야 한다 — panel.visible=false만으론
  // 콜라이더가 안 사라지므로 userData.solid도 지우고 rebuildFrom을 마지막에
  // 한 번만 부른다.
  unlockAllDoors: () => {
    for (const doorId of Object.keys(doorLocks)) {
      const lock = doorLocks[doorId];
      const unlockPanel = lock.group.userData._unlockPanel;
      if (unlockPanel) unlockPanel();
      unlockDoor(doorId);
    }
    rebuildFrom(scene);
  },
};

// ---------- 오디오 게이트 (브라우저 오토플레이 정책상 사용자 제스처 필요) ----------
// #loading 오버레이를 "시작하기" 버튼으로 바꾼다(index.html은 안 건드림, gate.js가 DOM 주입).
// 클릭 시에만 AudioContext.resume() + BGM 재생이 허용된다.
//
// 오디오 데이터 자체는 미리 받아둔다 — 로딩(=네트워크 다운로드)과 재생은
// 별개고, 브라우저 오토플레이 정책이 막는 건 "제스처 없는 재생"뿐이다.
// 게이트가 실제 로딩 완료를 반영하려면(gate.js가 공용 LoadingManager를
// 구독) 여기서 먼저 요청을 걸어둬야 한다 — 안 그러면 manager가 이 두
// 파일의 존재를 아예 모른 채로 "다 받았다"고 오판한다. 클릭 이후
// playBGM/initFootsteps가 같은 URL을 다시 로드하지만 브라우저 HTTP
// 캐시 덕분에 사실상 즉시 끝난다.
loadAudioBuffer('./assets/audio/bgm-main.mp3').catch(() => {});
loadAudioBuffer('./assets/audio/sfx-footstep.mp3').catch(() => {});

initAudioGate(loadingEl, () => {
  const bgm = playBGM('./assets/audio/bgm-main.mp3', { volume: 0.4, loop: false });
  window.__debug.bgm = bgm;
  window.__debug.footsteps = initFootsteps('./assets/audio/sfx-footstep.mp3', 0.38);

  // M9-D: 오프닝 페이드인(3초) + 인트로 대사 + 조작 안내 시작
  startOpening();
});

const post = createComposer(renderer, scene, camera);
window.__debug.post = post;
window.addEventListener('resize', () => {
  post.resize(window.innerWidth, window.innerHeight);
});

// ---------- 렌더 루프 ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  tick(dt); // SIM(이동/충돌) → POST_SIM(카메라) 순서로 실행됨
  post.update(dt);
  post.render(); // renderer.render() 대신 컴포저가 최종 출력을 담당
}
animate();
