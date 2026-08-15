import * as THREE from 'three';
import { mat } from '../render/materials.js';

/**
 * 방 바깥 지형 및 원경 로우폴리 오브젝트(언덕, 나무) 생성
 * 안개(Fog)가 걸려 원근감을 느낄 수 있는 대상 제공
 */
export function createExterior(scene) {
  const group = new THREE.Group();

  // 1. 넓은 바깥 지면
  // M4(docs/spec/M4-layout.md §5.1)로 집이 원점 반경 2.5m → 9.9m(모서리
  // (7,7))까지 커졌다. 감쇠 시작 반경을 4에서 그대로 두면 집 모서리에서
  // 변위가 최대 0.236m까지 커져서 바닥(두께 0.12)을 뚫고 올라온다.
  // → 11로 올림(9.9 < 11, 여유 1.1m). 정점 간격(80/16=5)보다 큰 반경을
  // 평탄하게 유지하는 게 핵심 — 이 규칙을 어겨서 반경 4 때 실제로
  // `4464d4e` 버그(땅이 방 모서리를 침범)가 났었다.
  const groundGeo = new THREE.PlaneGeometry(80, 80, 16, 16);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.hypot(x, y);
    const falloff = Math.min(1, Math.max(0, (dist - 11) / 10));
    pos.setZ(i, Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.4 * falloff);
  }
  groundGeo.computeVertexNormals();

  const groundMat = mat(0x3d5240); // 어두운 숲/풀빛 톤(기존보다 밝혀서 현재 조명에서 완전히 까매 보이지 않게)
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  group.add(ground);

  // 2. 바깥 원경 언덕 (Cone / Icosahedron 로우폴리)
  const hillMat = mat(0x212d24);
  const hillMat2 = mat(0x35283c); // 멀리 보이는 노을빛 산 자락

  const hillData = [
    { x: -18, z: -15, scale: [8, 5, 8] },
    { x: 12, z: -22, scale: [12, 7, 12] },
    { x: 22, z: -10, scale: [10, 6, 10] },
    { x: -25, z: 8, scale: [14, 8, 14] },
    { x: 18, z: 15, scale: [10, 6, 10] },
    { x: -10, z: -28, scale: [16, 9, 16] },
  ];

  const hillGeo = new THREE.ConeGeometry(1, 1, 6);
  hillData.forEach((h, i) => {
    const hill = new THREE.Mesh(hillGeo, i % 2 === 0 ? hillMat : hillMat2);
    hill.position.set(h.x, h.scale[1] / 2 - 0.1, h.z);
    hill.scale.set(...h.scale);
    hill.rotation.y = (i * 0.7) % Math.PI;
    group.add(hill);
  });

  // 3. 로우폴리 나무들
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.2, 5);
  const leavesGeo = new THREE.ConeGeometry(0.7, 1.8, 5);
  const trunkMat = mat(0x4a3222);
  const leavesMat = mat(0x384a32);

  // M4로 집 bbox가 X[-3,7]·Z[-7,7]까지 커지면서, 그걸 1.5m 확장한
  // X[-4.5,8.5]·Z[-8.5,8.5] 안에 있던 [-4,-5]/[4.5,-4]/[5,4] 세 그루는
  // 집 안/집 코앞에 박힌다 — 삭제(docs/spec/M4-layout.md §5.1).
  const treePositions = [
    [-5.5, 3],
    [-8, -8], [7, -9], [-10, 5], [9, 7],
    [-12, -3], [11, -2], [-3, -12], [2, -14]
  ];

  treePositions.forEach(([x, z]) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.6;
    tree.add(trunk);

    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 1.8;
    tree.add(leaves);

    tree.position.set(x, -0.1, z);
    const s = 0.8 + Math.random() * 0.5;
    tree.scale.set(s, s, s);
    group.add(tree);
  });

  scene.add(group);
  return group;
}
