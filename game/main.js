import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------------------------------------------------ *
 *  작은 방 — 카툰(툰셰이딩) 로우폴리 미니 게임 MVP
 *  구조: 바닥1 + 벽3(개방형) + 책상 오브젝트1 + 스탠드 상호작용1
 * ------------------------------------------------------------------ */

const canvasHolder = document.body;
const loadingEl = document.getElementById('loading');
const hintEl = document.getElementById('hint');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // 플랫하고 채도 높은 카툰 톤 유지
canvasHolder.appendChild(renderer.domElement);

// ---------- scene / camera ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.05,
  100
);
camera.position.set(3.4, 2.7, 3.7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, -0.3);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.6;
controls.maxDistance = 6.5;
controls.minPolarAngle = THREE.MathUtils.degToRad(28);
controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-70);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(70);
controls.update();

// ---------- 카툰 그라디언트 맵 (셀 셰이딩 단계) ----------
function createToonGradient(steps) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round((i / (steps - 1)) * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
const gradientMap = createToonGradient(4);

function toonMat(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
}

// ---------- 만화풍 외곽선(인버티드 헐) ----------
const outlineVert = `
  uniform float thickness;
  void main() {
    vec3 pos = position + normal * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const outlineFrag = `
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }
`;
function addOutline(mesh, thickness = 0.014, color = 0x241a30) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness }, uColor: { value: new THREE.Color(color) } },
    vertexShader: outlineVert,
    fragmentShader: outlineFrag,
    side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(mesh.geometry, mat);
  mesh.add(outline);
  return outline;
}

function makeMesh(geo, color, parent, pos, extraMat = {}) {
  const mesh = new THREE.Mesh(geo, toonMat(color, extraMat));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  addOutline(mesh);
  (parent || scene).add(mesh);
  return mesh;
}

// ---------- 하늘 돔 (은은한 노을 그라디언트, sample1 톤 참고) ----------
function createSkyDome() {
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
scene.add(createSkyDome());

// ---------- 조명 ----------
const hemi = new THREE.HemisphereLight(0xfbe9d0, 0x5a3f45, 0.85);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffe9c2, 1.15);
key.position.set(2.4, 3.6, 2.2);
scene.add(key);

const fill = new THREE.DirectionalLight(0x9db8ff, 0.25);
fill.position.set(-2.5, 1.6, -1.5);
scene.add(fill);

// ---------- 방: 바닥 + 벽 3면 (정면 개방형, 위에서 비스듬히 내려다보는 구도) ----------
const ROOM_W = 3.6;
const ROOM_D = 3.6;
const ROOM_H = 2.3;

const room = new THREE.Group();
scene.add(room);

// 바닥
makeMesh(
  new THREE.BoxGeometry(ROOM_W, 0.12, ROOM_D),
  0x8a5a3c,
  room,
  [0, -0.06, 0]
);

// 러그 (아기자기 포인트 1)
makeMesh(
  new THREE.CylinderGeometry(0.75, 0.75, 0.02, 24),
  0xd1553f,
  room,
  [0.2, 0.02, 0.5]
);

// 뒷벽
makeMesh(
  new THREE.BoxGeometry(ROOM_W, ROOM_H, 0.12),
  0xf1e3cd,
  room,
  [0, ROOM_H / 2, -ROOM_D / 2]
);

// 왼쪽 벽
makeMesh(
  new THREE.BoxGeometry(0.12, ROOM_H, ROOM_D),
  0xe7d5ba,
  room,
  [-ROOM_W / 2, ROOM_H / 2, 0]
);

// 오른쪽 벽
makeMesh(
  new THREE.BoxGeometry(0.12, ROOM_H, ROOM_D),
  0xe7d5ba,
  room,
  [ROOM_W / 2, ROOM_H / 2, 0]
);

// 걸레받이(포인트 장식)
makeMesh(new THREE.BoxGeometry(ROOM_W, 0.14, 0.06), 0x5a3826, room, [0, 0.07, -ROOM_D / 2 + 0.09]);

// ---------- 오브젝트: 책상 ----------
const desk = new THREE.Group();
desk.position.set(0.4, 0, -1.35);
room.add(desk);

makeMesh(new THREE.BoxGeometry(1.0, 0.06, 0.55), 0xc98a52, desk, [0, 0.72, 0]);
const legOffsets = [
  [0.42, -0.24],
  [-0.42, -0.24],
  [0.42, 0.24],
  [-0.42, 0.24],
];
for (const [lx, lz] of legOffsets) {
  makeMesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), 0x7a4a2a, desk, [lx, 0.35, lz]);
}

// 의자 (아기자기 포인트 2)
const chair = new THREE.Group();
chair.position.set(0.4, 0, -0.55);
room.add(chair);
makeMesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), 0xd1553f, chair, [0, 0.42, 0]);
makeMesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), 0xd1553f, chair, [0, 0.63, 0.19]);
for (const [lx, lz] of [
  [0.17, -0.17],
  [-0.17, -0.17],
  [0.17, 0.17],
  [-0.17, 0.17],
]) {
  makeMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), 0x5a3826, chair, [lx, 0.21, lz]);
}

// ---------- 아이템 증식: 책장 (왼쪽 벽) ----------
const bookshelf = new THREE.Group();
bookshelf.position.set(-1.6, 0, -0.9);
room.add(bookshelf);

// 측판 2개 + 상판 + 하판 (얇은 쪽이 x축, 벽에 붙는 방향)
makeMesh(new THREE.BoxGeometry(0.28, 1.3, 0.05), 0x7a4a2a, bookshelf, [0, 0.65, -0.375]);
makeMesh(new THREE.BoxGeometry(0.28, 1.3, 0.05), 0x7a4a2a, bookshelf, [0, 0.65, 0.375]);
makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x7a4a2a, bookshelf, [0, 1.3, 0]);
makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x8a5a3c, bookshelf, [0, 0, 0]);

// 선반 2단
for (const sy of [0.45, 0.9]) {
  makeMesh(new THREE.BoxGeometry(0.26, 0.04, 0.76), 0x8a5a3c, bookshelf, [0, sy, 0]);
}

// 책 (아랫단에 컬러 박스로 꽂아둠)
const bookColors = [0xd1553f, 0x5a8fd1, 0xe0b23f, 0x6fae5e, 0xb15fd1];
let bookZ = -0.3;
for (let i = 0; i < 5; i++) {
  const h = 0.22 + (i % 3) * 0.05;
  const w = 0.045;
  makeMesh(new THREE.BoxGeometry(w, h, 0.16), bookColors[i], bookshelf, [0.1, 0.02 + h / 2, bookZ]);
  bookZ += 0.16;
}

// ---------- 아이템 증식: 화분 ----------
const plant = new THREE.Group();
plant.position.set(-1.55, 0, 1.15);
room.add(plant);
makeMesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), 0xc9683f, plant, [0, 0.11, 0]);
makeMesh(new THREE.IcosahedronGeometry(0.22, 0), 0x5f9e52, plant, [0, 0.42, 0]);
makeMesh(new THREE.IcosahedronGeometry(0.15, 0), 0x74b463, plant, [0.12, 0.58, 0.05]);

// ---------- 아이템 증식: 벽 액자 (뒷벽) ----------
const frame = new THREE.Group();
frame.position.set(-0.9, 1.55, -1.725);
room.add(frame);
makeMesh(new THREE.BoxGeometry(0.5, 0.38, 0.03), 0x5a3826, frame, [0, 0, 0]);
makeMesh(new THREE.BoxGeometry(0.4, 0.28, 0.01), 0x9db8ff, frame, [0, 0, 0.02]);

// ---------- 아이템 증식: 머그컵 (책상 위) ----------
makeMesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 12), 0xe0793f, desk, [-0.25, 0.79, 0.1]);

// ---------- 아이템 증식: 방석 (러그 옆) ----------
makeMesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16), 0x5a8fd1, room, [0.65, 0.04, 0.95]);

// ---------- 상호작용 오브젝트: 스탠드 조명 ----------
const lamp = new THREE.Group();
lamp.position.set(0.75, 0.75, -1.35);
desk.add(lamp);

makeMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 12), 0x2e2a3a, lamp, [0, 0.01, 0]);
makeMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), 0x3a3448, lamp, [0, 0.13, 0]);

const shadeMat = toonMat(0xffd9a0, { emissive: 0x000000 });
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.13, 12, 1, true), shadeMat);
shade.position.set(0, 0.28, 0);
shade.rotation.x = Math.PI;
addOutline(shade, 0.01);
lamp.add(shade);

const bulbLight = new THREE.PointLight(0xffcf8a, 0, 2.2, 2);
bulbLight.position.set(0, 0.24, 0);
lamp.add(bulbLight);

// ---------- 클릭 상호작용 ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lampOn = false;
let punch = 0; // 애니메이션 진행도

function setPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function onClick(e) {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(lamp.children, true);
  if (hits.length > 0) {
    lampOn = !lampOn;
    bulbLight.intensity = lampOn ? 1.4 : 0;
    shadeMat.emissive.set(lampOn ? 0xffb35a : 0x000000);
    shadeMat.emissiveIntensity = lampOn ? 0.9 : 0;
    punch = 1;
  }
}
renderer.domElement.addEventListener('click', onClick);

// ---------- 리사이즈 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 로딩 완료 처리 ----------
loadingEl.style.opacity = '0';
setTimeout(() => loadingEl.remove(), 400);
hintEl.classList.remove('hidden');
setTimeout(() => hintEl.classList.add('hidden'), 6000);

// ---------- 렌더 루프 ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (punch > 0) {
    punch = Math.max(0, punch - dt * 3.2);
    const s = 1 + Math.sin(punch * Math.PI) * 0.18;
    lamp.scale.setScalar(s);
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
