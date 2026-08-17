import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { toonMat } from '../../render/materials.js';
import { onFrame } from '../../core/loop.js';
import { createSfxPool } from '../../audio/audio.js';
import { TAG } from '../../core/tags.js';

export function makeLamp(id, camera, renderer) {
  const lamp = new THREE.Group();
  if (id) lamp.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 12), 0x2e2a3a, lamp, [0, 0.01, 0]);
  makeMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), 0x3a3448, lamp, [0, 0.13, 0]);

  const shadeMat = toonMat(0xffd9a0, { emissive: 0x000000 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.10, 0.10, 12, 1, false), shadeMat);
  shade.position.set(0, 0.26, 0);
  lamp.add(shade);

  const bulbLight = new THREE.PointLight(0xffcf8a, 0, 2.2, 2);
  bulbLight.position.set(0, 0.24, 0);
  lamp.add(bulbLight);

  if (camera && renderer) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clickSfx = createSfxPool('./assets/audio/sfx-click.mp3', 2, { volume: 0.8 });
    let lampOn = false;
    let punch = 0;
    let downX = 0;
    let downY = 0;
    let downT = 0;

    function setPointer(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onPointerDown(e) {
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    }

    function onPointerUp(e) {
      const movedDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      const heldMs = performance.now() - downT;
      if (movedDist >= 5 || heldMs >= 300) return;

      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(lamp.children, true);
      if (hits.length > 0) {
        lampOn = !lampOn;
        bulbLight.intensity = lampOn ? 1.4 : 0;
        shadeMat.emissive.set(lampOn ? 0xffb35a : 0x000000);
        shadeMat.emissiveIntensity = lampOn ? 0.9 : 0;
        punch = 1;
        clickSfx.play();
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    onFrame((dt) => {
      if (punch > 0) {
        punch = Math.max(0, punch - dt * 3.2);
        const s = 1 + Math.sin(punch * Math.PI) * 0.18;
        lamp.scale.setScalar(s);
      }
    });
  }

  return lamp;
}
