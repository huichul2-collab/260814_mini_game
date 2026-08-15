export const CAM = {
  initialYaw: 0, // yaw=0일 때 카메라는 target의 +Z 쪽, 전진(W)은 -Z 방향
  initialPitch: 0.75, // 라디안, 수평선 기준 위로 올라간 각도
  minPitch: 0.2, // 기존 0.35보다 낮춤 — 수평에 더 가깝게 내려다볼 수 있게
  maxPitch: 1.45, // 기존 1.3보다 높임 — 거의 정수리 위에서 보듯 더 위에서도 가능
  initialDistance: 4.0,
  minDistance: 1.8, // 휠 줌인 최소 거리
  maxDistance: 8.5, // 휠 줌아웃 최대 거리 — 기존엔 줌 자체가 없었음
  zoomSensitivity: 0.0035, // 휠 deltaY 1당 거리 변화량
  headHeight: 1.4,
  followLambda: 10, // smoothTarget이 실제 캐릭터 위치를 따라가는 감쇠 속도
  pullOutLambda: 4, // 벽에서 멀어질 때(복귀) 감쇠 — 당김은 즉시, 복귀는 천천히
  collisionSkin: 0.15,
  dragSensitivity: 0.006,
};
