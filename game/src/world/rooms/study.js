import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';

/**
 * 작업실 (동쪽 방) 가구 및 소품 배치
 * 경계 (벽 중심선): X [3, 7], Z [-2, 3]
 * 내부 (걸어다니는 영역): X [3.06, 6.94], Z [-1.94, 2.94]
 * 문 D2: X ≈ 3, Z [-0.15, 1.15] (서쪽 벽) -> 진입 통로 X[2.8, 3.3] * Z[-0.4, 1.4] 비움
 * 
 * @param {THREE.Scene} scene 
 * @returns {{ room: THREE.Group }}
 */
export function createStudy(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // 1. 대형 작업 책상 그룹 (북쪽 벽 안쪽 밀착: Z_center = -1.55, X = 5.5)
  const desk = new THREE.Group();
  desk.position.set(5.5, 0, -1.55);
  room.add(desk);

  // 책상 상판 (solid: true)
  makeMesh(new THREE.BoxGeometry(1.4, 0.06, 0.65), 0x5a3826, desk, [0, 0.72, 0], {}, { solid: true });
  // 다리 4개
  const legOffsets = [
    [0.62, -0.26],
    [-0.62, -0.26],
    [0.62, 0.26],
    [-0.62, 0.26],
  ];
  for (const [lx, lz] of legOffsets) {
    makeMesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), 0x333333, desk, [lx, 0.35, lz]);
  }

  // 책상 위 소품: 노트북 (열린 형태)
  makeMesh(new THREE.BoxGeometry(0.32, 0.015, 0.22), 0x333333, desk, [-0.2, 0.76, 0]);
  makeMesh(new THREE.BoxGeometry(0.32, 0.2, 0.015), 0x444444, desk, [-0.2, 0.85, -0.1]);
  // 책상 위 소품: 서적 더미
  makeMesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), 0xd1553f, desk, [0.35, 0.81, 0.05]);

  // 2. 사무용 의자 (책상 앞: X = 5.5, Z = -0.9)
  const chair = new THREE.Group();
  chair.position.set(5.5, 0, -0.9);
  room.add(chair);

  makeMesh(new THREE.BoxGeometry(0.44, 0.06, 0.44), 0x3a5f8a, chair, [0, 0.45, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.44, 0.45, 0.05), 0x3a5f8a, chair, [0, 0.68, -0.2]);
  makeMesh(new THREE.CylinderGeometry(0.03, 0.22, 0.42, 8), 0x222222, chair, [0, 0.21, 0]);

  // 3. 대형 책장 (동쪽 벽 안쪽 밀착: X = 6.65, Z = 0.8)
  const bookshelf = new THREE.Group();
  bookshelf.position.set(6.65, 0, 0.8);
  room.add(bookshelf);

  // 책장 외각 프레임 (solid: true)
  makeMesh(new THREE.BoxGeometry(0.38, 1.85, 1.1), 0x7a4a2a, bookshelf, [0, 0.925, 0], {}, { solid: true });
  // 책장 안쪽 선반 홈 표현 (어두운 내부 톤)
  makeMesh(new THREE.BoxGeometry(0.36, 1.75, 1.02), 0x5a3826, bookshelf, [-0.02, 0.925, 0]);

  // 선반 위 알록달록한 책 배치
  const bookColors = [0xd1553f, 0x5a8fd1, 0x5f9e52, 0xe0b23f, 0xb15fd1];
  for (let s = 0; s < 3; s++) {
    const sy = 0.45 + s * 0.45;
    let bz = -0.4;
    for (let i = 0; i < 5; i++) {
      const bh = 0.2 + (i % 3) * 0.04;
      makeMesh(new THREE.BoxGeometry(0.24, bh, 0.05), bookColors[(i + s) % bookColors.length], bookshelf, [-0.02, sy + bh / 2, bz]);
      bz += 0.16;
    }
  }

  // 4. 휴식용 1인용 소파 & 티 테이블 (남서쪽 구역: X = 4.2, Z = 2.45)
  const lounge = new THREE.Group();
  lounge.position.set(4.2, 0, 2.45);
  room.add(lounge);

  // 1인용 소파 (solid: true)
  makeMesh(new THREE.BoxGeometry(0.75, 0.4, 0.7), 0x5f9e52, lounge, [0, 0.2, 0], {}, { solid: true });
  makeMesh(new THREE.BoxGeometry(0.75, 0.45, 0.16), 0x5f9e52, lounge, [0, 0.525, 0.27]);
  // 티 테이블
  makeMesh(new THREE.CylinderGeometry(0.24, 0.22, 0.45, 16), 0xc98a52, room, [5.15, 0.225, 2.45], {}, { solid: true });

  // 5. 작업실 바닥 영역 러그 (X = 5.2, Z = 0.3)
  makeMesh(new THREE.BoxGeometry(1.5, 0.01, 1.8), 0xd4a373, room, [5.2, 0.01, 0.3]);

  return { room };
}
