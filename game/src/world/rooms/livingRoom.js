import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { toonMat } from '../../render/materials.js';
import { onFrame } from '../../core/loop.js';
import { createSfxPool } from '../../audio/audio.js';

/* ------------------------------------------------------------------ *
 *  거실 소품 전용 파일 (M4). 바닥·벽·문은 house.js(layout.js 데이터
 *  기반)가 만들고, 이 파일은 더 이상 구조를 만들지 않는다.
 *
 *  방이 3.6m → 6.0m(docs/spec/M4-layout.md §2 living)로 커지면서 벽
 *  안쪽면이 ±1.74 → ±2.94로 이동했다. 벽에 붙어 있던 소품 좌표는 전부
 *  스펙 §5.2 표 그대로 옮겼다 — 여기서 새로 계산하지 않는다.
 * ------------------------------------------------------------------ */
export function createLivingRoom(scene, camera, renderer) {
  const room = new THREE.Group();
  scene.add(room);

  // 러그 (아기자기 포인트 1) — 방이 커진 만큼 확대
  makeMesh(new THREE.CylinderGeometry(1.1, 1.1, 0.02, 24), 0xd1553f, room, [0.2, 0.02, 0.9]);

  // ---------- 오브젝트: 책상 ----------
  const desk = new THREE.Group();
  desk.position.set(0.4, 0, -2.55);
  room.add(desk);

  // 책상 상판만 solid로 태깅 — 다리 사이 틈은 무시하고 상판 XZ 풋프린트를
  // 그대로 콜라이더로 쓴다(물리는 Y를 안 보므로 이 근사가 충분하다).
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

  // 의자 (아기자기 포인트 2)
  const chair = new THREE.Group();
  chair.position.set(0.4, 0, -1.75);
  room.add(chair);
  makeMesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), 0xd1553f, chair, [0, 0.42, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), 0xd1553f, chair, [0, 0.63, 0.19]);
  for (const [lx, lz] of [
    [0.17, -0.17],
    [-0.17, -0.17],
    [0.17, 0.17],
    [-0.17, 0.17],
  ]) {
    makeMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), 0x5a3826, chair, [lx, 0.21, lz]);
  }

  // ---------- 아이템 증식: 책장 ----------
  const bookshelf = new THREE.Group();
  bookshelf.position.set(-2.75, 0, 1.8);
  room.add(bookshelf);

  makeMesh(new THREE.BoxGeometry(0.28, 1.3, 0.05), 0x7a4a2a, bookshelf, [0, 0.65, -0.375]);
  makeMesh(new THREE.BoxGeometry(0.28, 1.3, 0.05), 0x7a4a2a, bookshelf, [0, 0.65, 0.375]);
  makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x7a4a2a, bookshelf, [0, 1.3, 0]);
  makeMesh(new THREE.BoxGeometry(0.28, 0.05, 0.8), 0x8a5a3c, bookshelf, [0, 0, 0], {}, { solid: true });

  for (const sy of [0.45, 0.9]) {
    makeMesh(new THREE.BoxGeometry(0.26, 0.04, 0.76), 0x8a5a3c, bookshelf, [0, sy, 0]);
  }

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
  plant.position.set(-2.75, 0, 1.15);
  room.add(plant);
  makeMesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), 0xc9683f, plant, [0, 0.11, 0], {}, { solid: true });
  makeMesh(new THREE.IcosahedronGeometry(0.22, 0), 0x5f9e52, plant, [0, 0.42, 0]);
  makeMesh(new THREE.IcosahedronGeometry(0.15, 0), 0x74b463, plant, [0.12, 0.58, 0.05]);

  // ---------- 아이템 증식: 벽 액자 (뒷벽 안쪽면에 밀착) ----------
  const frame = new THREE.Group();
  frame.position.set(1.0, 1.55, -2.88);
  room.add(frame);
  makeMesh(new THREE.BoxGeometry(0.5, 0.38, 0.03), 0x5a3826, frame, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.4, 0.28, 0.01), 0x9db8ff, frame, [0, 0, 0.02]);

  // ---------- 아이템 증식: 머그컵 (책상 위) ----------
  makeMesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 12), 0xe0793f, desk, [-0.25, 0.79, 0.1]);

  // ---------- 아이템 증식: 방석 ----------
  makeMesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16), 0x5a8fd1, room, [0.9, 0.04, 1.5]);

  // ---------- 상호작용 오브젝트: 스탠드 조명 ----------
  // ⚠️ desk.add(lamp)라서 lamp.position은 desk 로컬 좌표다. M4에서 책상을
  // (0.4,0,-1.35)→(0.4,0,-2.55)로 옮길 때 이 좌표를 안 고쳐서 desk 오프셋이
  // 두 번(데스크+램프) 더해져 램프가 거실 북벽(Z=-3)을 뚫고 침실A 쪽 허공에
  // 떠 있던 회귀가 있었다. 책상 상판 윗면은 로컬 y=0.75(상판 중심 0.72 +
  // 두께 0.06의 절반) — 램프는 상판 위 오른쪽(x=0.35, 상판 절반폭 0.5 안쪽)에 앉는다.
  const lamp = new THREE.Group();
  lamp.position.set(0.35, 0.75, 0);
  desk.add(lamp);

  makeMesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 12), 0x2e2a3a, lamp, [0, 0.01, 0]);
  makeMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), 0x3a3448, lamp, [0, 0.13, 0]);

  const shadeMat = toonMat(0xffd9a0, { emissive: 0x000000 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.10, 0.10, 12, 1, false), shadeMat);
  shade.position.set(0, 0.26, 0);
  lamp.add(shade);

  const bulbLight = new THREE.PointLight(0xffcf8a, 0, 2.2, 2);
  bulbLight.position.set(0, 0.24, 0);
  lamp.add(bulbLight);

  // ---------- 클릭 상호작용 ----------
  // 'click' 이벤트를 그대로 쓰면 카메라를 드래그로 회전시키다 우연히
  // 램프 위에서 손을 뗄 때마다 오발동한다. pointerdown→pointerup 사이
  // 이동 거리/시간을 직접 재서 "드래그가 아니었을 때만" 클릭으로 친다.
  // followCamera.js도 자기 드래그 판별을 독립적으로 갖고 있고, 여기선
  // 그걸 import하지 않는다 — world 모듈이 camera 모듈을 몰라야 하므로.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clickSfx = createSfxPool('./assets/audio/sfx-click.mp3', 2, { volume: 0.8 });
  let lampOn = false;
  let punch = 0;
  let downX = 0;
  let downY = 0;
  let downT = 0;

  function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e) {
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
  }

  function onPointerUp(e) {
    const movedDist = Math.hypot(e.clientX - downX, e.clientY - downY);
    const heldMs = performance.now() - downT;
    if (movedDist >= 5 || heldMs >= 300) return; // 드래그였다 — 상호작용 무시

    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(lamp.children, true);
    if (hits.length > 0) {
      lampOn = !lampOn;
      bulbLight.intensity = lampOn ? 1.4 : 0;
      shadeMat.emissive.set(lampOn ? 0xffb35a : 0x000000);
      shadeMat.emissiveIntensity = lampOn ? 0.9 : 0;
      punch = 1;
      clickSfx.play();
    }
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  onFrame((dt) => {
    if (punch > 0) {
      punch = Math.max(0, punch - dt * 3.2);
      const s = 1 + Math.sin(punch * Math.PI) * 0.18;
      lamp.scale.setScalar(s);
    }
  });

  return { room, desk, chair, lamp };
}
