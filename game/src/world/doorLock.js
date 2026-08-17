import * as THREE from 'three';
import { makeMesh } from '../render/meshFactory.js';
import { TAG } from '../core/tags.js';
import { WALLS, DOORS, WALL_T, DOOR_H } from './layout.js';
import { LOCKS } from '../../story.js';

/* ------------------------------------------------------------------ *
 *  문 잠금 패널 — 개구부를 막는 판 하나. "문 = 콜라이더 공백"이라는
 *  house.js 설계를 깨지 않는 유일한 방법이다(docs/spec/M9-escape.md §10.2).
 *  자물쇠를 별도 오브젝트로 만들지 않는다 — 패널 자체가 클릭 대상이다.
 *
 *  좌표를 하드코딩하지 않는다 — layout.js의 WALLS/DOORS에서 doorId로
 *  찾아 house.js의 buildWallPiece와 똑같은 계산을 한다. D1/D3/D4도
 *  story.js의 LOCKS에 데이터 한 줄만 추가하면 코드 수정 없이 그대로
 *  동작한다.
 * ------------------------------------------------------------------ */
function createDoorLock(scene, doorId, interactiveId) {
  const wall = WALLS.find((w) => w.doorId === doorId);
  const door = DOORS[doorId];
  if (!wall || !door) {
    console.warn(`[doorLock] layout.js에 doorId=${doorId} 없음`);
    return null;
  }

  const openStart = door.center - door.width / 2;
  const openEnd = door.center + door.width / 2;
  const mid = (openStart + openEnd) / 2;
  const yCenter = DOOR_H / 2;

  const geo =
    wall.axis === 'x'
      ? new THREE.BoxGeometry(door.width, DOOR_H, WALL_T)
      : new THREE.BoxGeometry(WALL_T, DOOR_H, door.width);
  const pos = wall.axis === 'x' ? [mid, yCenter, wall.at] : [wall.at, yCenter, mid];

  const group = new THREE.Group();
  group.position.set(pos[0], pos[1], pos[2]);
  group.userData[TAG.INTERACTIVE] = interactiveId;
  scene.add(group);

  const panelMesh = makeMesh(geo, 0x5a3826, group, [0, 0, 0], {}, { solid: true, fadeable: true });

  // 장식 다이얼 — solid 없음. 플레이어가 다가오는 쪽 면(더 낮은 좌표 쪽)에
  // 살짝 튀어나오게 붙인다. 원통 축을 벽 두께 방향(패널 법선)으로 눕힌다.
  const dialThickness = 0.03;
  const dialOffset = WALL_T / 2 + dialThickness / 2;
  const dial = makeMesh(new THREE.CylinderGeometry(0.07, 0.07, dialThickness, 16), 0x2e2a3a, group, [0, 0, 0]);
  dial.position.y = 1.1 - yCenter; // 패널 중앙(y=yCenter) 기준 절대높이 1.1m
  if (wall.axis === 'x') {
    dial.rotation.x = Math.PI / 2; // 원통 축을 Z로
    dial.position.z = -dialOffset;
  } else {
    dial.rotation.z = Math.PI / 2; // 원통 축을 X로
    dial.position.x = -dialOffset;
  }

  // probe.js가 raycast로 찾은 group(userData._unlockPanel)에서 직접 호출한다
  // — 별도 레지스트리를 안 두는 이유는 클릭 시점에 이미 정확한 group
  // 레퍼런스를 쥐고 있기 때문이다. rebuildFrom(scene)은 호출부(probe.js,
  // 통합자 쪽 로직) 책임으로 남긴다 — world 모듈이 physics/colliders.js를
  // import하지 않는다는 원칙(colliders.js 파일 상단 주석) 때문이다.
  group.userData._unlockPanel = () => {
    group.visible = false;
    panelMesh.userData[TAG.SOLID] = false;
  };

  return { group, panelMesh, doorId };
}

export function initDoorLocks(scene) {
  const locks = {};
  for (const doorId of Object.keys(LOCKS)) {
    const lock = createDoorLock(scene, doorId, `lock_${doorId}`);
    if (lock) locks[doorId] = lock;
  }
  return locks;
}
