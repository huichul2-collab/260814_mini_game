import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  renderer / scene / camera — 다른 모든 모듈이 참조하는 공용 상태.
 *  이 파일은 chokepoint다: M0 이후에는 구조를 바꾸지 않는다.
 * ------------------------------------------------------------------ */

export const canvasHolder = document.body;

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // 플랫하고 채도 높은 톤 유지
canvasHolder.appendChild(renderer.domElement);

export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.05,
  100
);
camera.position.set(3.4, 2.7, 3.7);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
