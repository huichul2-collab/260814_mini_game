import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';
import { TAG } from '../../core/tags.js';

/* ------------------------------------------------------------------ *
 *  열쇠 조각 — 서재/공방/보관소 3곳에서 재사용(docs/spec/M9-escape.md §11.2).
 *  형상은 하나뿐이고 id(호출자가 넘기는 '방id.keyPieceN')로만 구분한다.
 * ------------------------------------------------------------------ */
export function makeKeyPiece(id) {
  const keyPiece = new THREE.Group();
  if (id) keyPiece.userData[TAG.INTERACTIVE] = id;

  makeMesh(new THREE.BoxGeometry(0.14, 0.02, 0.05), 0xe6c875, keyPiece, [0, 0, 0]);
  makeMesh(new THREE.BoxGeometry(0.05, 0.02, 0.08), 0xe6c875, keyPiece, [0.07, 0, 0]);

  return keyPiece;
}
