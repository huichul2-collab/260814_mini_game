import * as THREE from 'three';
import { mat } from '../render/materials.js';

/**
 * 방 바깥 지형 및 원경 로우폴리 오브젝트(언덕, 나무) 생성
 * 안개(Fog)가 걸려 원근감을 느낄 수 있는 대상 제공
 */
export function createExterior(scene) {
  const group = new THREE.Group();

  // 1. 넓은 바깥 지면
  // ⚠️ 정점 간격이 80/16=5유닛이라, "반경 4 이내는 평평하게" 하드 컷오프는
  // 원점 정점 딱 하나만 평평하게 남기고 바로 다음 고리(반경 5)부터 최대
  // 0.4유닛까지 접혀버렸다. 방은 반경 ~2.5라 이 첫 고리가 방 바로 바깥,
  // 특히 열린 앞쪽 모서리에 걸려 땅이 방을 침범해 깨진 것처럼 보이는
  // 원인이었다. 하드 컷오프 대신 반경 4~14 사이에서 서서히 커지는
  // 감쇠로 바꿔서 정점 간격과 무관하게 방 주변이 매끈하게 이어지도록 함.
  const groundGeo = new THREE.PlaneGeometry(80, 80, 16, 16);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.hypot(x, y);
    const falloff = Math.min(1, Math.max(0, (dist - 4) / 10));
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

  const treePositions = [
    [-4, -5], [4.5, -4], [-5.5, 3], [5, 4],
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
