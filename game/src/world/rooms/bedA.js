import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';

/**
 * 침실 A (북쪽 방) 가구 및 소품 배치
 * 경계 (벽 중심선): X [-3, 2], Z [-7, -3]
 * 내부 (걸어다니는 영역): X [-2.94, 1.94], Z [-6.94, -3.06]
 * 문 D1: Z ≈ -3, X [-1.15, 0.15] (남쪽 벽) -> 진입 통로 X[-1.4, 0.4] * Z[-3.3, -2.8] 비움
 * 
 * @param {THREE.Scene} scene 
 * @returns {{ room: THREE.Group }}
 */
export function createBedA(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // 1. 더블 침대 그룹 (북쪽 벽 안쪽 밀착: Z_center = -5.84, X = -1.3)
  const bed = new THREE.Group();
  bed.position.set(-1.3, 0, -5.84);
  room.add(bed);

  // 침대 헤드보드
  makeMesh(new THREE.BoxGeometry(1.5, 0.85, 0.1), 0x6e4023, bed, [0, 0.425, -0.95], {}, { solid: true });
  // 침대 프레임 (대형 가구 -> solid: true)
  makeMesh(new THREE.BoxGeometry(1.4, 0.38, 1.9), 0x7a4a2a, bed, [0, 0.19, 0], {}, { solid: true });
  // 매트리스
  makeMesh(new THREE.BoxGeometry(1.32, 0.22, 1.8), 0xf2ebe1, bed, [0, 0.49, 0.02]);
  // 이불/이불커버 (파란색 세련된 톤)
  makeMesh(new THREE.BoxGeometry(1.34, 0.05, 1.2), 0x5a8fd1, bed, [0, 0.61, 0.3]);
  // 베개 2개
  makeMesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), 0xffffff, bed, [-0.33, 0.65, -0.65]);
  makeMesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), 0xffffff, bed, [0.33, 0.65, -0.65]);

  // 2. 협탁 및 스탠드 조명 (침대 옆: X = -0.3, Z = -6.6)
  const nightstand = new THREE.Group();
  nightstand.position.set(-0.3, 0, -6.6);
  room.add(nightstand);

  makeMesh(new THREE.BoxGeometry(0.42, 0.45, 0.42), 0x7a4a2a, nightstand, [0, 0.225, 0], {}, { solid: true });
  // 협탁 서랍 손잡이
  makeMesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), 0xe6c875, nightstand, [0, 0.28, 0.22]);
  // 테이블 스탠드
  makeMesh(new THREE.CylinderGeometry(0.06, 0.08, 0.02, 12), 0x333333, nightstand, [0, 0.46, 0]);
  makeMesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8), 0x444444, nightstand, [0, 0.57, 0]);
  makeMesh(new THREE.ConeGeometry(0.08, 0.12, 12), 0xffd9a0, nightstand, [0, 0.7, 0]);

  // 3. 대형 옷장 (동쪽 벽 안쪽 밀착: X = 1.5, Z = -5.0)
  const wardrobe = new THREE.Group();
  wardrobe.position.set(1.5, 0, -5.0);
  room.add(wardrobe);

  makeMesh(new THREE.BoxGeometry(0.58, 1.85, 1.1), 0x6e4023, wardrobe, [0, 0.925, 0], {}, { solid: true });
  // 옷장 손잡이
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, wardrobe, [-0.3, 0.95, -0.15]);
  makeMesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), 0xe6c875, wardrobe, [-0.3, 0.95, 0.15]);

  // 4. 침실 러그 (방 중앙부: X = -0.5, Z = -4.5)
  makeMesh(new THREE.CylinderGeometry(0.9, 0.9, 0.01, 24), 0xe8c89b, room, [-0.5, 0.01, -4.5]);

  // 5. 벽 액자 (북쪽 벽 안쪽면: Z = -6.92, X = -1.3)
  const pictureFrame = new THREE.Group();
  pictureFrame.position.set(-1.3, 1.5, -6.92);
  room.add(pictureFrame);
  makeMesh(new THREE.BoxGeometry(0.7, 0.5, 0.03), 0x5a3826, pictureFrame, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.6, 0.4, 0.01), 0x5f9e52, pictureFrame, [0, 0, 0.02]);

  return { room };
}
