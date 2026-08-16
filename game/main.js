import * as THREE from 'three';
import { renderer, scene, camera } from './src/core/context.js';
import { tick } from './src/core/loop.js';
import { createSkyDome, setupFog } from './src/render/sky.js';
import { setupLighting } from './src/render/lighting.js';
import { createHouse } from './src/world/house.js';
import { createLivingRoom } from './src/world/rooms/livingRoom.js';
import { createExterior } from './src/world/exterior.js';
import { rebuildFrom, getColliders } from './src/physics/colliders.js';
import { createPlayer } from './src/player/character.js';
import { initController } from './src/player/controller.js';
import { createFollowCamera } from './src/camera/followCamera.js';
import { createComposer } from './src/render/post/composer.js';
import { loadGLTF } from './src/assets/loaders.js';
import { restyle, Restyle, logMaterials } from './src/assets/restyle.js';
import { fitHeight } from './src/assets/normalize.js';
import { initAudioGate } from './src/audio/gate.js';
import { playBGM } from './src/audio/audio.js';
import { initFootsteps } from './src/audio/footsteps.js';

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
createHouse(scene); // M4: layout.js 기반 바닥·벽·문. 방 3개(bedA/study/bedB)는 아직 뼈대만 — 소품은 gemini/lane-rooms
const livingRoom = createLivingRoom(scene, camera, renderer);
createExterior(scene); // 안개가 걸릴 원경 지형 — 이게 없으면 fog가 눈에 안 보인다

// ---------- M3 텍스처 실습: 책상 위 소품으로 GLB 하나 얹어보기 ----------
// cubone.glb는 애니메이션·스킨 없는 정적 메시라 걷는 캐릭터로는 못 쓰지만
// (사전검사 결과, dev-log 참고), restyle 파이프라인 검증용 소품으로는 충분하다.
loadGLTF('./assets/glb/cubone.glb')
  .then((gltf) => {
    const model = gltf.scene;
    fitHeight(model, 0.22); // 책상 위에 올려둘 작은 피규어 크기
    restyle(model, { mode: Restyle.KEEP }); // 원본 재질 유지 + Lambert로 강등
    logMaterials(model); // 콘솔에서 재질 구성 확인 가능
    model.position.set(0.3, 0.75, -0.05); // 책상 위, 머그컵 반대쪽
    livingRoom.desk.add(model);
  })
  .catch((err) => console.warn('[cubone] 로드 실패:', err));

const player = createPlayer(scene, [0, 0, 1.5]); // 거실, D3 문 앞 여유 1.5m (docs/spec/M4-layout.md §5.3)
rebuildFrom(scene); // 플레이어는 solid 태그가 없으니 자기 자신과는 안 부딪힘

const followCam = createFollowCamera(camera, renderer.domElement, player.root.position, scene);
initController(player, followCam.getYaw);

// 디버그 훅 — 헤드리스 검증 스크립트가 위치/카메라 상태를 직접 읽는 용도.
// 프로덕션 동작에는 관여하지 않는다.
window.__debug = { player, camera, getColliders };

// ---------- 오디오 게이트 (브라우저 오토플레이 정책상 사용자 제스처 필요) ----------
// #loading 오버레이를 "시작하기" 버튼으로 바꾼다(index.html은 안 건드림, gate.js가 DOM 주입).
// 클릭 시에만 AudioContext.resume() + BGM 재생이 허용된다.
initAudioGate(loadingEl, () => {
  const bgm = playBGM('./assets/audio/bgm-main.mp3', { volume: 0.4, loop: true });
  window.__debug.bgm = bgm;
  window.__debug.footsteps = initFootsteps('./assets/audio/sfx-footstep.mp3', 0.38);
});
hintEl.classList.remove('hidden');
setTimeout(() => hintEl.classList.add('hidden'), 6000);

// ---------- 후처리 (그레인+색보정+비네트) ----------
const post = createComposer(renderer, scene, camera);
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
