import * as THREE from 'three';

export function setupLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xfbe9d0, 0x5a3f45, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe9c2, 1.15);
  key.position.set(2.4, 3.6, 2.2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9db8ff, 0.25);
  fill.position.set(-2.5, 1.6, -1.5);
  scene.add(fill);

  return { hemi, key, fill };
}
