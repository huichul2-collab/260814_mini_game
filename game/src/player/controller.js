import * as THREE from 'three';
import { onFrame, Phase } from '../core/loop.js';
import { getMoveAxis, isJumpPressed } from './input.js';
import { resolve } from '../physics/resolve.js';
import { getColliders } from '../physics/colliders.js';
import { PLAYER } from '../config/player.js';

/* ------------------------------------------------------------------ *
 *  입력(카메라 기준 축) → 충돌 해결 → 위치 확정, 을 SIM phase에서 처리.
 *  followCamera.js와 정확히 같은 컨벤션을 쓴다: yaw=0일 때 전진(W)은
 *  -Z 방향. 두 파일 다 THREE.Vector3.applyAxisAngle로 회전을 계산해서
 *  손으로 삼각함수 부호를 맞추다 실수하는 걸 피한다.
 * ------------------------------------------------------------------ */
const UP = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

export function initController(player, getYaw) {
  let facing = 0;
  let yVel = 0;
  let yPos = 0;

  onFrame((dtRaw) => {
    // 탭 복귀 등으로 dt가 급증하면 한 프레임에 벽을 관통할 수 있어 클램프한다.
    const dt = Math.min(dtRaw, 1 / 30);
    const axis = getMoveAxis();

    if (axis.x !== 0 || axis.z !== 0) {
      const yaw = getYaw();
      _forward.set(0, 0, -1).applyAxisAngle(UP, yaw);
      _right.set(1, 0, 0).applyAxisAngle(UP, yaw);
      _move.set(0, 0, 0)
        .addScaledVector(_forward, -axis.z)
        .addScaledVector(_right, axis.x);
      if (_move.lengthSq() > 1e-6) _move.normalize();

      player.root.position.x += _move.x * PLAYER.speed * dt;
      player.root.position.z += _move.z * PLAYER.speed * dt;

      const targetFacing = Math.atan2(_move.x, _move.z);
      let diff = targetFacing - facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // 최단 각도로
      facing += diff * (1 - Math.exp(-PLAYER.turnLambda * dt));
      player.root.rotation.y = facing;
    }

    // B-5. 점프 물리 (지면 접촉 yPos<=0 시에만 발동, XZ 충돌은 Y와 독립)
    if (isJumpPressed() && yPos <= 0) {
      yVel = PLAYER.jumpSpeed;
    }

    if (yPos > 0 || yVel > 0) {
      yVel += PLAYER.gravity * dt;
      yPos += yVel * dt;
      if (yPos <= 0) {
        yPos = 0;
        yVel = 0;
      }
    }
    player.root.position.y = yPos;

    resolve(player.root.position, player.radius, getColliders(), 3);
  }, Phase.SIM);
}

