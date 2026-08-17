import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeDesk(id) {
  const desk = new THREE.Group();
  if (id) desk.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(1.0, 0.06, 0.55), 0xc98a52, desk, [0, 0.72, 0], {}, { solid: true });
  const legOffsets = [
    [0.42, -0.24],
    [-0.42, -0.24],
    [0.42, 0.24],
    [-0.42, 0.24],
  ];
  for (const [lx, lz] of legOffsets) {
    makeMesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), 0x7a4a2a, desk, [lx, 0.35, lz]);
  }
  makeMesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 12), 0xe0793f, desk, [-0.25, 0.79, 0.1]);

  return desk;
}

export function makeStudyDesk(id) {
  const desk = new THREE.Group();
  if (id) desk.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(1.4, 0.06, 0.65), 0x5a3826, desk, [0, 0.72, 0], {}, { solid: true });
  const legOffsets = [
    [0.62, -0.26],
    [-0.62, -0.26],
    [0.62, 0.26],
    [-0.62, 0.26],
  ];
  for (const [lx, lz] of legOffsets) {
    makeMesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), 0x333333, desk, [lx, 0.35, lz]);
  }
  makeMesh(new THREE.BoxGeometry(0.32, 0.015, 0.22), 0x333333, desk, [-0.2, 0.76, 0]);
  makeMesh(new THREE.BoxGeometry(0.32, 0.2, 0.015), 0x444444, desk, [-0.2, 0.85, -0.1]);
  makeMesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), 0xd1553f, desk, [0.35, 0.81, 0.05]);

  return desk;
}
