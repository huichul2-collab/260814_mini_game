import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeWorkbench(id) {
  const workbench = new THREE.Group();
  if (id) workbench.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(1.3, 0.08, 0.7), 0x8a5a3c, workbench, [0, 0.78, 0], {}, { solid: true });
  const legOffsets = [
    [0.58, -0.28],
    [-0.58, -0.28],
    [0.58, 0.28],
    [-0.58, 0.28],
  ];
  for (const [lx, lz] of legOffsets) {
    makeMesh(new THREE.BoxGeometry(0.08, 0.74, 0.08), 0x333333, workbench, [lx, 0.37, lz]);
  }
  // 바이스(vise) — 작업대임을 알아볼 수 있는 디테일
  makeMesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), 0x555555, workbench, [0.45, 0.87, 0.22]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.03, 0.14), 0x777777, workbench, [0.45, 0.9, 0.22]);

  return workbench;
}
