/* ------------------------------------------------------------------ *
 *  game/story.js — ⭐ 대사·설명 전용 파일. 이 파일만 고치면 게임 속
 *  오브젝트 설명과 오프닝 대사가 바뀐다. 코드는 다른 파일에 있다.
 *
 *  OBJECTS의 키는 '방id.오브젝트id' 형식이다(예: 'living.desk').
 *  방id/오브젝트id는 각 방 파일(livingRoom.js 등)이 소품에 붙인 태그와
 *  정확히 같아야 한다 — tools/render-check/interaction-check.mjs가 이
 *  대응을 자동 검사한다(오타·누락은 검증 스크립트가 FAIL로 잡는다).
 * ------------------------------------------------------------------ */

export const OBJECTS = {
  'living.desk': { name: '책상', text: '오래 써서 반질반질해진 나무 책상.' },
  'living.chair': { name: '의자', text: '앉으면 삐걱 소리가 날 것 같다.' },
  'living.bookshelf': { name: '책장', text: '책이 몇 권 꽂혀 있다.' },
  'living.plant': { name: '화분', text: '누군가 꾸준히 물을 준 흔적이 있다.' },
  'living.frame': { name: '액자', text: '낡은 사진이 걸려 있다.' },
  'living.rug': { name: '러그', text: '푹신하고 붉은 러그.' },
  'living.lamp': { name: '스탠드 조명', text: '클릭하면 켜지고 꺼진다.' },
  'living.cushion': { name: '방석', text: '바닥에 놓인 방석.' },
};

// M9-A 시점에는 자리만 만들어둔다 — 오프닝 연출은 M9-B 이후 붙는다.
// 채워둔 두 줄은 예시이며, 실제 오프닝 도입 시 이 배열을 그대로 쓰거나
// 바꿔써도 된다.
export const INTRO = ['일어나 보니 모르는 공간이었다.', '여기서 나가야 한다.'];
