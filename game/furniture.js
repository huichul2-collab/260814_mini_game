/* ------------------------------------------------------------------ *
 *  game/furniture.js — ⭐ 방별 가구 및 소품 배치 데이터 파일
 *
 *  가구의 좌표, 회전, 종류(type)를 관리합니다.
 *  각 배치 항목 필드 설명:
 *    - id    : 상호작용 ID (story.js OBJECTS 키와 1:1 대응, 없는 소품은 null)
 *    - room  : 가구가 위치할 방 ID ('living', 'bedA', 'study', 'bedB')
 *    - type  : 가구 조형 함수 타입 ('desk', 'chair', 'bookshelf', 'plant',
 *              'frame', 'rug', 'lamp', 'cushion', 'doubleBed', 'nightstand',
 *              'wardrobe', 'circleRug', 'pictureFrame', 'studyDesk',
 *              'officeChair', 'largeBookshelf', 'armchair', 'teaTable',
 *              'rectRug', 'singleBed', 'smallNightstand', 'dresser',
 *              'largePlant', 'squareRug')
 *    - pos   : 월드 좌표 [X, Y, Z] (단위: 미터)
 *    - rotY  : Y축 수평 회전각 (단위: 라디안, 기본값: 0)
 * ------------------------------------------------------------------ */

export const FURNITURE = [
  // ---------- 거실 (living) ----------
  { id: 'living.rug', room: 'living', type: 'rug', pos: [0.2, 0.02, 0.9], rotY: 0 },
  { id: 'living.desk', room: 'living', type: 'desk', pos: [0.4, 0, -2.66], rotY: 0 },
  { id: 'living.lamp', room: 'living', type: 'lamp', pos: [0.75, 0.75, -2.66], rotY: 0 },
  { id: 'living.chair', room: 'living', type: 'chair', pos: [0.4, 0, -1.75], rotY: 0 },
  { id: 'living.bookshelf', room: 'living', type: 'bookshelf', pos: [-2.75, 0, 1.8], rotY: 0 },
  { id: 'living.plant', room: 'living', type: 'plant', pos: [-2.75, 0, 1.15], rotY: 0 },
  { id: 'living.frame', room: 'living', type: 'frame', pos: [1.0, 1.55, -2.88], rotY: 0 },
  { id: 'living.cushion', room: 'living', type: 'cushion', pos: [0.9, 0.04, 1.5], rotY: 0 },

  // ---------- 침실 A (bedA) ----------
  { id: null, room: 'bedA', type: 'doubleBed', pos: [-1.3, 0, -5.84], rotY: 0 },
  { id: null, room: 'bedA', type: 'nightstand', pos: [-0.3, 0, -6.6], rotY: 0 },
  { id: null, room: 'bedA', type: 'wardrobe', pos: [1.5, 0, -5.0], rotY: 0 },
  { id: null, room: 'bedA', type: 'circleRug', pos: [-0.5, 0.01, -4.5], rotY: 0 },
  { id: null, room: 'bedA', type: 'pictureFrame', pos: [0.8, 1.5, -6.92], rotY: 0 },

  // ---------- 작업실 (study) ----------
  { id: null, room: 'study', type: 'studyDesk', pos: [5.5, 0, -1.55], rotY: 0 },
  { id: null, room: 'study', type: 'officeChair', pos: [5.5, 0, -0.9], rotY: 0 },
  { id: null, room: 'study', type: 'largeBookshelf', pos: [6.65, 0, 0.8], rotY: 0 },
  { id: null, room: 'study', type: 'armchair', pos: [4.2, 0, 2.45], rotY: 0 },
  { id: null, room: 'study', type: 'teaTable', pos: [5.15, 0.225, 2.45], rotY: 0 },
  { id: null, room: 'study', type: 'rectRug', pos: [5.2, 0.01, 0.3], rotY: 0 },

  // ---------- 침실 B (bedB) ----------
  { id: null, room: 'bedB', type: 'singleBed', pos: [1.35, 0, 5.2], rotY: 0 },
  { id: null, room: 'bedB', type: 'smallNightstand', pos: [1.35, 0, 3.9], rotY: 0 },
  { id: null, room: 'bedB', type: 'dresser', pos: [1.25, 0, 6.65], rotY: 0 },
  { id: null, room: 'bedB', type: 'largePlant', pos: [-1.55, 0, 4.3], rotY: 0 },
  { id: null, room: 'bedB', type: 'squareRug', pos: [-0.1, 0.01, 5.2], rotY: 0 },
];
