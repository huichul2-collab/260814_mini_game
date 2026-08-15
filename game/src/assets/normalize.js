import * as THREE from 'three';

/**
 * ⚠️ 주의: Box3.setFromObject()는 SkinnedMesh(스켈레탈 애니메이션 캐릭터)에 사용 시
 * bind-pose 기준의 엉뚱하게 큰 바운딩 박스가 계산될 수 있습니다.
 * 정적 메시(Static Mesh) 및 일반 3D 에셋에 주로 사용하는 헬퍼입니다.
 */

/**
 * 세로 높이(Y축)를 targetMeters에 맞추어 균일 스케일링
 */
export function fitHeight(root, targetMeters) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const currentHeight = box.max.y - box.min.y;
  if (currentHeight > 0.0001) {
    const scale = targetMeters / currentHeight;
    root.scale.multiplyScalar(scale);
    root.updateMatrixWorld(true);
  }
  return root;
}

/**
 * X, Y, Z 중 가장 긴 변을 targetMeters에 맞추어 균일 스케일링
 */
export function fitSize(root, targetMeters) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.0001) {
    const scale = targetMeters / maxDim;
    root.scale.multiplyScalar(scale);
    root.updateMatrixWorld(true);
  }
  return root;
}

/**
 * 에셋의 XZ 평면 중심을 (0, 0)으로 이동
 */
export function recenterXZ(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
  return root;
}

/**
 * 에셋의 Y 최소값(바닥면)을 0으로 설정하여 지면에 착지
 */
export function dropToFloor(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  return root;
}
