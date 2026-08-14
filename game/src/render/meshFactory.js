import * as THREE from 'three';
import { scene } from '../core/context.js';
import { mat } from './materials.js';
import { TAG } from '../core/tags.js';

/* ------------------------------------------------------------------ *
 *  makeMesh — 시그니처 동결(로드맵 §2 M0).
 *
 *  기존 5개 인자(geo, color, parent, pos, extraMat)는 절대 바꾸지 않는다.
 *  월드 모듈 25곳 이상이 이 서명으로 호출하고 있어서, 인자를 건드리면
 *  아트 방향이 바뀔 때마다 호출부를 전부 고쳐야 한다. 대신 6번째
 *  선택 인자(opts)만 추가해 충돌/페이드/상호작용 태깅을 붙인다.
 * ------------------------------------------------------------------ */
export function makeMesh(geo, color, parent, pos, extraMat = {}, opts = {}) {
  const mesh = new THREE.Mesh(geo, mat(color, extraMat));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);

  if (opts.solid) mesh.userData[TAG.SOLID] = true;
  if (opts.fadeable) mesh.userData[TAG.FADEABLE] = true;
  if (opts.interactive) mesh.userData[TAG.INTERACTIVE] = true;
  if (opts.roomId) mesh.userData[TAG.ROOM_ID] = opts.roomId;

  (parent || scene).add(mesh);
  return mesh;
}
