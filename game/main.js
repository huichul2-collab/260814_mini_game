import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { renderer, scene, camera } from './src/core/context.js';
import { tick } from './src/core/loop.js';
import { createSkyDome } from './src/render/sky.js';
import { setupLighting } from './src/render/lighting.js';
import { createLivingRoom } from './src/world/rooms/livingRoom.js';

/* ------------------------------------------------------------------ *
 *  부트스트랩 전용 파일 (로드맵 §3 "main.js는 통합자 전용").
 *  씬 구성은 전부 src/ 모듈이 하고, 여기는 조립 + 렌더 루프만 담당한다.
 *  ⚠️ OrbitControls는 M0 후속 작업에서 제거되고 M1의 3인칭 추적
 *  카메라로 교체될 예정이다 — 그 전까지는 지금처럼 드래그 오빗으로 확인.
 * ------------------------------------------------------------------ */

const loadingEl = document.getElementById('loading');
const hintEl = document.getElementById('hint');

scene.add(createSkyDome());
setupLighting(scene);
createLivingRoom(scene, camera, renderer);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, -0.3);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.6;
controls.maxDistance = 6.5;
controls.minPolarAngle = THREE.MathUtils.degToRad(28);
controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-70);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(70);
controls.update();

// ---------- 로딩 완료 처리 ----------
loadingEl.style.opacity = '0';
setTimeout(() => loadingEl.remove(), 400);
hintEl.classList.remove('hidden');
setTimeout(() => hintEl.classList.add('hidden'), 6000);

// ---------- 렌더 루프 ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  tick(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();
