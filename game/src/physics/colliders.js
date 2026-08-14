import * as THREE from 'three';
import { TAG } from '../core/tags.js';

/* ------------------------------------------------------------------ *
 *  콜라이더 레지스트리. 월드 모듈은 이 파일을 import하지 않는다 —
 *  makeMesh(...,{solid:true})로 userData만 태깅하고, 씬이 다 조립된 뒤
 *  통합자(main.js)가 rebuildFrom(scene)을 한 번 호출해서 수집한다.
 *  의존 방향은 항상 "world → tags.js"뿐이라 world와 physics가 서로
 *  몰라도 된다.
 * ------------------------------------------------------------------ */

const aabbs = [];
const box = new THREE.Box3();

export function rebuildFrom(root) {
  aabbs.length = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.userData[TAG.SOLID]) return;
    box.setFromObject(o);
    aabbs.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
  });
}

export function getColliders() {
  return aabbs;
}
