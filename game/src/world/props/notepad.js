import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeNotepad(id) {
  const notepad = new THREE.Group();
  if (id) notepad.userData[TAG.INTERACTIVE] = id;

  // 얇은 박스 (낙서장 표지 및 속지)
  makeMesh(new THREE.BoxGeometry(0.20, 0.012, 0.15), 0xf4eee1, notepad, [0, 0.006, 0]);
  makeMesh(new THREE.BoxGeometry(0.21, 0.004, 0.16), 0x3d352e, notepad, [0, 0.002, 0]);

  return notepad;
}
