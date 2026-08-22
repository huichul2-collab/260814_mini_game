import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makePencilCase(id) {
  const pencilCase = new THREE.Group();
  if (id) pencilCase.userData[TAG.INTERACTIVE] = id;

  // 붉은 박스 필통 본체 및 뚜껑 디테일
  makeMesh(new THREE.BoxGeometry(0.20, 0.035, 0.08), 0xb33939, pencilCase, [0, 0.0175, 0]);
  makeMesh(new THREE.BoxGeometry(0.204, 0.01, 0.084), 0x962d2d, pencilCase, [0, 0.032, 0]);
  makeMesh(new THREE.BoxGeometry(0.015, 0.008, 0.01), 0xdcdde1, pencilCase, [0.09, 0.02, 0]);

  return pencilCase;
}
