import * as THREE from 'three';
import { renderer, scene, camera } from './src/core/context.js';
import { tick } from './src/core/loop.js';
import { createSkyDome, setupFog } from './src/render/sky.js';
import { setupLighting } from './src/render/lighting.js';
import { createLivingRoom } from './src/world/rooms/livingRoom.js';
import { createExterior } from './src/world/exterior.js';
import { rebuildFrom, getColliders } from './src/physics/colliders.js';
import { createPlayer } from './src/player/character.js';
import { initController } from './src/player/controller.js';
import { createFollowCamera } from './src/camera/followCamera.js';
import { createComposer } from './src/render/post/composer.js';

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
createLivingRoom(scene, camera, renderer);
createExterior(scene); // 안개가 걸릴 원경 지형 — 이게 없으면 fog가 눈에 안 보인다

const player = createPlayer(scene, [0, 0, 1.2]); // 방 앞쪽, 가구와 안 겹치는 스폰 위치
rebuildFrom(scene); // 플레이어는 solid 태그가 없으니 자기 자신과는 안 부딪힘

const followCam = createFollowCamera(camera, renderer.domElement, player.root.position, scene);
initController(player, followCam.getYaw);

// 디버그 훅 — 헤드리스 검증 스크립트가 위치/카메라 상태를 직접 읽는 용도.
// 프로덕션 동작에는 관여하지 않는다.
window.__debug = { player, camera, getColliders };

// ---------- 로딩 완료 처리 ----------
loadingEl.style.opacity = '0';
setTimeout(() => loadingEl.remove(), 400);
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
