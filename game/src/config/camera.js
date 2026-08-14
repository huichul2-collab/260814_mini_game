export const CAM = {
  initialYaw: 0, // yaw=0일 때 카메라는 target의 +Z 쪽, 전진(W)은 -Z 방향
  initialPitch: 0.75, // 라디안, 수평선 기준 위로 올라간 각도
  minPitch: 0.35,
  maxPitch: 1.3,
  distance: 4.0,
  headHeight: 1.4,
  followLambda: 10, // smoothTarget이 실제 캐릭터 위치를 따라가는 감쇠 속도
  pullOutLambda: 4, // 벽에서 멀어질 때(복귀) 감쇠 — 당김은 즉시, 복귀는 천천히
  collisionSkin: 0.15,
  dragSensitivity: 0.006,
};
