import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

export function makeFrame(id) {
  const frame = new THREE.Group();
  if (id) frame.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.5, 0.38, 0.03), 0x5a3826, frame, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.4, 0.28, 0.01), 0x9db8ff, frame, [0, 0, 0.02]);

  return frame;
}

export function makePictureFrame(id) {
  const pictureFrame = new THREE.Group();
  if (id) pictureFrame.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.7, 0.5, 0.03), 0x5a3826, pictureFrame, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.6, 0.4, 0.01), 0x5f9e52, pictureFrame, [0, 0, 0.02]);

  return pictureFrame;
}
