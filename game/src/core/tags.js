/* ------------------------------------------------------------------ *
 *  userData 태그 계약 (로드맵 §3, §4.2)
 *
 *  world · physics · camera 모듈은 서로 import하지 않는다. 대신 월드
 *  모듈이 메시를 만들 때 이 키들로 userData만 태깅하고, physics/camera
 *  모듈은 씬을 traverse해서 태그만 읽는다. 의존 화살표는 항상
 *  "world → tags.js"뿐이라 두 모듈이 같은 파일을 두고 충돌할 일이 없다.
 *
 *  - SOLID       physics: 콜라이더 레지스트리에 포함 (걷다가 부딪히는 벽/가구)
 *  - FADEABLE    camera : 시야를 가리면 반투명 처리 대상 (주로 벽)
 *  - INTERACTIVE player : 클릭/레이캐스트 상호작용 대상
 *  - ROOM_ID     world  : 어느 방 소속인지 — 방 점유 판정(occupancy)용
 * ------------------------------------------------------------------ */
export const TAG = Object.freeze({
  SOLID: 'solid',
  FADEABLE: 'fadeable',
  INTERACTIVE: 'interactive',
  ROOM_ID: 'roomId',
});
