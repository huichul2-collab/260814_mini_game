import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { renderer, scene, camera } from '../src/core/context.js';
import { tick } from '../src/core/loop.js';
import { createSkyDome, setupFog } from '../src/render/sky.js';
import { setupLighting } from '../src/render/lighting.js';
import { createLivingRoom } from '../src/world/rooms/livingRoom.js';
import { createExterior } from '../src/world/exterior.js';
import { createComposer } from '../src/render/post/composer.js';

// 1. Sky & Fog
scene.add(createSkyDome());
setupFog(scene, 8, 35);

// 2. Lighting & World
setupLighting(scene);
createLivingRoom(scene, camera, renderer);
createExterior(scene);

// 3. Post-processing Composer
const composerObj = createComposer(renderer, scene, camera);

// 4. Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, -0.3);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.update();

// 5. Window Resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composerObj.resize(w, h);
});

// 6. Animation Loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  tick(dt);
  controls.update();
  composerObj.update(dt);
  composerObj.render();
}
animate();
