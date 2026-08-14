import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { renderer, scene, camera } from '../src/core/context.js';
import { tick } from '../src/core/loop.js';
import { createSkyDome } from '../src/render/sky.js';
import { setupLighting } from '../src/render/lighting.js';
import { createLivingRoom } from '../src/world/rooms/livingRoom.js';

import { loadGLTF } from '../src/assets/loaders.js';
import { restyle, Restyle, logMaterials } from '../src/assets/restyle.js';
import { fitHeight, recenterXZ, dropToFloor } from '../src/assets/normalize.js';
import { initAudioGate } from '../src/audio/gate.js';

scene.add(createSkyDome());
setupLighting(scene);
createLivingRoom(scene, camera, renderer);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, -0.3);
controls.enableDamping = true;
controls.update();

// Audio Gate 초기화
const loadingEl = document.getElementById('loading');
initAudioGate(loadingEl, () => {
  console.log('[preview_e] Audio Gate Start clicked!');
});

// GLB 에셋 로드 및 처리 (cubone.glb)
loadGLTF('../assets/glb/cubone.glb')
  .then((gltf) => {
    console.log('[preview_e] GLB successfully loaded:', gltf);
    const model = gltf.scene;

    // 1. 진단 로그
    logMaterials(model);

    // 2. 바운드 및 크기 정규화 (높이 0.9m로 조절, 중앙 정렬, 지면 배치)
    fitHeight(model, 0.9);
    recenterXZ(model);
    dropToFloor(model);

    // 방 내부 위치 배치 (러그 옆)
    model.position.set(-0.6, 0, 0.2);

    // 3. 재질 모드 전환 테스트 (REPLACE 모드로 팔레트 재질 적용)
    const palette = [0xd1553f, 0x5a8fd1, 0xe0b23f, 0x6fae5e, 0xb15fd1];
    restyle(model, { mode: Restyle.REPLACE, palette });

    scene.add(model);
  })
  .catch((err) => {
    console.error('[preview_e] GLB load error:', err);
  });

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  tick(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();
