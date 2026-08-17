import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';
import { CLOCK_TIME } from '../../../story.js';

/* ------------------------------------------------------------------ *
 *  거실 시계 — 도형(원판+테두리+바늘 2개), GLB 아님. 바늘 각도를 정확한
 *  숫자로 지정해야 해서 도형이 필수다(docs/spec/M9-escape.md §7, §10.3).
 *
 *  ⚠️ three.js에서 시계방향 회전은 rotation.z = -각도(라디안)다. 부호를
 *  반대로 넣으면 8시25분이 3시35분처럼 보인다. computeHandAngles()를
 *  escape-flow.mjs가 그대로 가져다 써서 실제 렌더 각도와 대조한다 —
 *  이 함수 밖에서 각도를 다시 계산하지 않는다(그러면 두 곳에 같은 공식이
 *  적히고, 하나만 고치면 어긋난다).
 * ------------------------------------------------------------------ */
export function computeHandAngles(hour, minute) {
  const hourDeg = (hour % 12) * 30 + minute * 0.5;
  const minuteDeg = minute * 6;
  return {
    hourAngleRad: -(hourDeg * Math.PI) / 180,
    minuteAngleRad: -(minuteDeg * Math.PI) / 180,
  };
}

// 바늘 하나 = 회전 피벗(Group) + 그 안에서 위로(+Y) 뻗은 박스. 박스 중심을
// length/2만큼 올려서 피벗(원점)이 바늘의 "아래 끝"이 되게 한다 — 그래야
// pivot.rotation.z를 돌렸을 때 시계 중심을 축으로 도는 것처럼 보인다.
function makeHand(parent, length, width, thickness, color, angleRad, name) {
  const pivot = new THREE.Group();
  pivot.name = name;
  makeMesh(new THREE.BoxGeometry(width, length, thickness), color, pivot, [0, length / 2, 0]);
  pivot.rotation.z = angleRad;
  parent.add(pivot);
  return pivot;
}

export function makeClock(id) {
  const clock = new THREE.Group();
  if (id) clock.userData[TAG.INTERACTIVE] = id;

  // 테두리(뒤) + 판(앞) — 둘 다 원래 원통의 "옆면"이 아니라 "평평한 면"이
  // 보여야 하므로 rotation.x=π/2로 눕힌다(원통 축이 +Y→+Z가 됨). 이 그룹은
  // furnitureLoader가 rotY만큼 다시 돌려서 실제로는 벽 쪽을 바라보게 된다
  // (docs/spec/M9-escape.md §10.4 — pos+rotY=π/2 조합으로 서벽에 밀착).
  const rim = makeMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), 0x2e2a3a, clock, [0, 0, -0.025]);
  rim.rotation.x = Math.PI / 2;
  const face = makeMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24), 0xe8ddc8, clock, [0, 0, 0.005]);
  face.rotation.x = Math.PI / 2;

  const { hourAngleRad, minuteAngleRad } = computeHandAngles(CLOCK_TIME.hour, CLOCK_TIME.minute);
  const handsGroup = new THREE.Group();
  handsGroup.position.z = 0.035; // 판 앞으로 나와서 겹쳐 보이게
  clock.add(handsGroup);

  makeHand(handsGroup, 0.13, 0.02, 0.01, 0x2e2a3a, hourAngleRad, 'hourHand');
  makeHand(handsGroup, 0.19, 0.015, 0.01, 0x2e2a3a, minuteAngleRad, 'minuteHand');

  return clock;
}
