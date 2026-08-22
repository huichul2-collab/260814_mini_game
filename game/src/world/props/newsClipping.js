import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';

/* ------------------------------------------------------------------ *
 *  신문 스크랩 3장(docs/spec/M9-escape.md §12.7) — props/cabinet.js의
 *  makeLockedCabinet()이 자식으로 붙인다. 순수 장식 조형(기본 도형,
 *  GLB 금지 — §12.8)이라 개별 TAG.INTERACTIVE가 없다: 내용은 3D에서
 *  낱장을 클릭해서가 아니라 캐비닛을 열었을 때 뜨는 열람 UI
 *  (ui/clippingsModal.js)가 story.js NEWS_CLIPPINGS를 그대로 읽어
 *  보여준다 — 여기서는 "종이 3장이 삐죽 나와 있다"는 실루엣만 만든다.
 *  개봉 전 숨김(visible=false)은 부모(cabinet.js)가 그룹 단위로 맡는다.
 * ------------------------------------------------------------------ */
export function makeNewsClippings() {
  const group = new THREE.Group();
  const paperColor = 0xe8dcc0;

  [-0.08, 0, 0.08].forEach((dx, i) => {
    const clip = makeMesh(new THREE.BoxGeometry(0.2, 0.14, 0.008), paperColor, group, [dx, i * 0.01, 0]);
    clip.rotation.z = (i - 1) * 0.1;
  });

  return group;
}
