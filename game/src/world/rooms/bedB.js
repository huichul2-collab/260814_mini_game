import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';

/**
 * 침실 B (남쪽 방) 가구 및 소품 배치
 * 경계 (벽 중심선): X [-2, 2], Z [3, 7]
 * 내부 (걸어다니는 영역): X [-1.94, 1.94], Z [3.06, 6.94]
 * 문 D3: Z ≈ 3, X [-0.65, 0.65] (북쪽 벽) -> 진입 통로 X[-0.9, 0.9] * Z[2.8, 3.3] 비움
 * 
 * @param {THREE.Scene} scene 
 * @returns {{ room: THREE.Group }}
 */
export function createBedB(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // 1. 싱글 침대 그룹 (동쪽 벽 안쪽 밀착: X = 1.35, Z = 5.2)
  const bed = new THREE.Group();
  bed.position.set(1.35, 0, 5.2);
  room.add(bed);

  // 침대 헤드보드
  makeMesh(new THREE.BoxGeometry(1.05, 0.8, 0.1), 0x5a3826, bed, [0, 0.4, -0.95], {}, { solid: true });
  // 침대 프레임 (solid: true)
  makeMesh(new THREE.BoxGeometry(1.0, 0.36, 1.9), 0x6e4023, bed, [0, 0.18, 0], {}, { solid: true });
  // 매트리스
  makeMesh(new THREE.BoxGeometry(0.94, 0.2, 1.8), 0xffffff, bed, [0, 0.46, 0.02]);
  // 이불/이불커버 (따뜻한 붉은 주황 포인트 톤)
  makeMesh(new THREE.BoxGeometry(0.96, 0.05, 1.1), 0xd1553f, bed, [0, 0.585, 0.35]);
  // 베개
  makeMesh(new THREE.BoxGeometry(0.48, 0.09, 0.32), 0x5a8fd1, bed, [0, 0.605, -0.65]);

  // 2. 침대 협탁 (침대 북쪽: X = 1.35, Z = 3.9 — 문 진입 통로 Z <= 3.3 밖)
  const nightstand = new THREE.Group();
  nightstand.position.set(1.35, 0, 3.9);
  room.add(nightstand);

  makeMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), 0x8a5a3c, nightstand, [0, 0.21, 0], {}, { solid: true });
  // 아날로그 탁상시계 소품
  makeMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), 0xe0b23f, nightstand, [0, 0.435, 0]);

  // 3. 서랍장 / 서랍 체스트 (남쪽 벽 안쪽 밀착: Z_center = 6.65, X = -1.1)
  const dresser = new THREE.Group();
  dresser.position.set(1.25, 0, 6.65);
  room.add(dresser);

  makeMesh(new THREE.BoxGeometry(0.95, 0.85, 0.45), 0x8a5a3c, dresser, [0, 0.425, 0], {}, { solid: true });
  // 서랍 라인 & 손잡이
  for (const dy of [0.22, 0.45, 0.68]) {
    makeMesh(new THREE.BoxGeometry(0.85, 0.02, 0.01), 0x5a3826, dresser, [0, dy, -0.226]);
    makeMesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), 0xe6c875, dresser, [0, dy, -0.235]);
  }
  // 서랍장 위 장식 수평 액자 / 화장품 상자
  makeMesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), 0x5f9e52, dresser, [0.25, 0.91, 0]);

  // 4. 대형 관엽 화분 (서쪽 벽 안쪽: X = -1.55, Z = 4.3)
  const plant = new THREE.Group();
  plant.position.set(-1.55, 0, 4.3);
  room.add(plant);

  makeMesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12), 0xc9683f, plant, [0, 0.13, 0], {}, { solid: true });
  makeMesh(new THREE.IcosahedronGeometry(0.24, 0), 0x5f9e52, plant, [0, 0.44, 0]);
  makeMesh(new THREE.IcosahedronGeometry(0.17, 0), 0x74b463, plant, [-0.08, 0.58, 0.05]);

  // 5. 침실 B 포근한 사각형 러그 (방 중앙부: X = -0.1, Z = 5.2)
  makeMesh(new THREE.BoxGeometry(1.3, 0.01, 1.3), 0x5a8fd1, room, [-0.1, 0.01, 5.2]);

  return { room };
}
