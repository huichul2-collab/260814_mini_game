import * as THREE from 'three';
import { FOG_CONFIG } from '../../config.js';

/* ---------- 하늘 돔 (은은한 노을 그라디언트, sample1 톤 참고) ---------- */
export function createSkyDome() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3a2350');
  grad.addColorStop(0.55, '#8a3a5a');
  grad.addColorStop(1, '#e0793f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(30, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
  return new THREE.Mesh(geo, mat);
}

/* ---------- 선형 거리 안개 (game/config.js FOG_CONFIG 연동) ---------- */
export function setupFog(scene, near = FOG_CONFIG.near, far = FOG_CONFIG.far, color = FOG_CONFIG.color) {
  scene.fog = new THREE.Fog(color, near, far);
  return scene.fog;
}
