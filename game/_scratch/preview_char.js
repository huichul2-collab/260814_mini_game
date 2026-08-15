import * as THREE from 'three';
import { createPlayer } from '../src/player/character.js';
import { tick } from '../src/core/loop.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1420);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 4);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfffaed, 0.9);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
scene.add(grid);

const player = createPlayer(scene, [0, 0, 0]);
console.log('[Preview] Player contract check:', {
  hasRoot: player.root instanceof THREE.Group,
  radius: player.radius,
});

// 1초 후 KeyW down 테스트 (걷기 애니메이션으로 전환)
setTimeout(() => {
  console.log('[Preview Test] Simulating KeyDown "KeyW"');
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
}, 1000);

// 2초 후 KeyW up 테스트 (Idle 애니메이션으로 복귀)
setTimeout(() => {
  console.log('[Preview Test] Simulating KeyUp "KeyW"');
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
}, 2000);

let lastTime = performance.now();
function animate(time) {
  requestAnimationFrame(animate);
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  tick(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
