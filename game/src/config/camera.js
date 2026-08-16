export const CAM = {
  initialYaw: 0, // yaw=0일 때 카메라는 target의 +Z 쪽, 전진(W)은 -Z 방향
  initialPitch: 0.75, // 라디안, 수평선 기준 위로 올라간 각도
  minPitch: 0.2, // 기존 0.35보다 낮춤 — 수평에 더 가깝게 내려다볼 수 있게
  maxPitch: 1.45, // 기존 1.3보다 높임 — 거의 정수리 위에서 보듯 더 위에서도 가능
  initialDistance: 4.5,
  minDistance: 2.0, // 휠 줌인 최소 거리
  maxDistance: 8.0, // 휠 줌아웃 최대 거리 — 기존엔 줌 자체가 없었음. ⚠️ 9.0 이상 몇몇
  // 방(bedA)에서 카메라가 문 개구부를 그대로 관통해 옆방으로 넘어가는
  // 아티팩트가 있음(피치가 고정이라 거리가 늘수록 카메라 높이도 같이
  // 올라가 벽(WALL_H 2.3m) 위로 시야가 넘어가버림, LOS 레이가 문틀
  // 상인방보다 위를 지나가 충돌판정을 놓침). 4.8에서 재현, 4.5까지는 깨끗함.
  zoomSensitivity: 0.0035, // 휠 deltaY 1당 거리 변화량
  headHeight: 1.4,
  followLambda: 10, // smoothTarget이 실제 캐릭터 위치를 따라가는 감쇠 속도
  pullOutLambda: 4, // 벽에서 멀어질 때(복귀) 감쇠 — 당김은 즉시, 복귀는 천천히
  collisionSkin: 0.15,
  dragSensitivity: 0.006,
  // 드래그 시점 회전 반전 — followCamera.js는 이 부호만 읽고 숫자를 직접
  // 흩뿌리지 않는다. true가 기본값(둘 다 반전).
  invertX: false,
  invertY: true,
};

