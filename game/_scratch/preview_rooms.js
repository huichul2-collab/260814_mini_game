import * as THREE from 'three';
import { createHouse } from '../src/world/house.js';
import { createBedA } from '../src/world/rooms/bedA.js';
import { createStudy } from '../src/world/rooms/study.js';
import { createBedB } from '../src/world/rooms/bedB.js';
import { setupLighting } from '../src/render/lighting.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1420);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 12, 10);
camera.lookAt(1, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

setupLighting(scene);

// 집 메인 구조 (벽, 바닥, 문)
createHouse(scene);

// 방 3개 소품 생성
const bedA = createBedA(scene);
const study = createStudy(scene);
const bedB = createBedB(scene);

console.log('[Preview Rooms] All rooms initialized successfully:', {
  hasBedA: Boolean(bedA.room),
  hasStudy: Boolean(study.room),
  hasBedB: Boolean(bedB.room),
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
