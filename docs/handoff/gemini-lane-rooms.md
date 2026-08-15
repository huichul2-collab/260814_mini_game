# Gemini 작업 지시서 — Lane: 방 3개 드레싱 (침실A · 작업실 · 침실B)

> 이 문서는 이 프로젝트의 다른 대화 맥락을 전혀 모르는 상태에서 읽는다는 전제로 쓰였다.
> 필요한 배경은 전부 이 안에 있다. 모르는 걸 추측하지 말고, 애매하면 범위를 좁혀서 처리할 것.

## -1. 작업 공간 분리 (반드시 먼저 할 것 — 이거 안 하면 작업이 통째로 날아갈 수 있다)

**`C:\Users\hcyang\claude\claude_project\260814_mini_games` 폴더를 그대로 열어서 작업하지 마라.** 그 폴더는 Claude가 `main` 브랜치에서 동시에 작업 중이다. 같은 폴더에서 브랜치를 전환하면 서로 커밋 안 된 변경사항이 뒤섞이거나 날아가는 사고가 실제로 있었다.

**시작 전에 반드시 별도 폴더에 저장소를 새로 클론해라**:
```
git clone https://github.com/huichul2-collab/260814_mini_game.git C:\Users\hcyang\gemini-workspace\lane-rooms
cd C:\Users\hcyang\gemini-workspace\lane-rooms
git checkout -b gemini/lane-rooms origin/main
```
(경로 이름은 예시고, 다른 레인과 폴더만 겹치지 않으면 된다.)

이 새 클론 폴더 **안에서만** 작업하고, 커밋도 push도 전부 이 폴더에서 해라. 원본 `260814_mini_games` 폴더는 절대 열거나 건드리지 마라.

작업이 끝나면 `git push origin gemini/lane-rooms`까지 하고 끝내라. `main`으로 merge하지 마라(§6 참고).

## 0. 이 프로젝트가 뭔가

취미로 만드는 3D 방/집 탐험 게임. Three.js(r185) + 순수 ES 모듈, **빌드 단계 없음, npm 런타임 의존성 없음**.

방금 M4에서 집이 **거실 + 침실A + 작업실 + 침실B, 총 4칸**으로 커졌다. 좌표의 단일 원본은 `docs/spec/M4-layout.md`이고, `game/src/world/layout.js`(순수 데이터)와 `game/src/world/house.js`(그 데이터로 바닥·벽·문을 기계적으로 만드는 코드)가 이미 완성돼 있다. **바닥·벽·문은 이미 있다** — 이 레인이 할 일은 침실A·작업실·침실B 세 방 안에 가구·소품을 채우는 것뿐이다. 거실(`world/rooms/livingRoom.js`)은 이미 다른 세션이 채워놨다 — 그 파일을 참고용으로 읽어봐도 좋다(수정은 금지).

## 1. 네 작업 범위

**새로 만들 파일 3개** (방마다 하나, 배타 소유):
- `game/src/world/rooms/bedA.js` — `export function createBedA(scene) { ... }`
- `game/src/world/rooms/study.js` — `export function createStudy(scene) { ... }`
- `game/src/world/rooms/bedB.js` — `export function createBedB(scene) { ... }`

**읽기만 허용(수정 금지)**: `game/src/world/layout.js`(방 좌표·문 위치를 여기서 읽어라 — 아래 §2에 이미 뽑아뒀지만, 직접 `import { ROOMS, DOORS } from '../layout.js'`로 가져와도 된다), `game/src/render/meshFactory.js`(`makeMesh` — 소품 만들 때 이거 써라), `game/src/render/materials.js`, `game/src/world/rooms/livingRoom.js`(참고용).

**절대 건드리면 안 되는 파일**: `game/main.js`, `game/index.html`, `game/src/world/layout.js`(쓰기), `game/src/world/house.js`, `game/src/world/rooms/livingRoom.js`(쓰기), `game/src/world/exterior.js`, `game/src/core/*`, `game/src/physics/*`, `game/src/player/*`, `game/src/camera/*`, `game/src/audio/*`, `game/src/assets/*`

**`main.js`를 못 건드리는 이유**: 지금 `main.js`는 `createHouse()`와 `createLivingRoom()`만 호출한다. 네가 만든 `createBedA/Study/BedB()`를 실제로 불러서 씬에 연결하는 건 **통합자(Claude)가 나중에 한다.** 너는 함수를 만들고 export만 해두면 된다.

## 2. 방 치수 (layout.js에서 그대로 가져온 값 — 여기서 새로 정하지 마라)

벽 두께 0.12m, 벽 높이 2.3m, 천장 없음(내려다보는 카메라). 아래 "내부"는 벽 중심선 기준 rect에서 벽 두께 절반(0.06m)만큼 안쪽으로 줄인 실제 걸어다닐 수 있는 공간이다.

### 침실 A (`bedA`)
- 내부 X: **[-2.94, 1.94]**, Z: **[-6.94, -3.06]** (5.0 × 4.0m 정도)
- 바닥색은 이미 `0x9a6a45`로 house.js가 칠해놨다 — 다시 안 칠해도 됨
- **문(D1)**: 남쪽 벽(Z≈-3) 위에 X **[-1.15, 0.15]** 구간이 뚫려있다. 이 앞 X[-1.4, 0.4] × Z[-3.3, -2.8] 정도는 가구로 막지 마라(플레이어가 지나다녀야 함)

### 작업실 (`study`)
- 내부 X: **[3.06, 6.94]**, Z: **[-1.94, 2.94]** (4.0 × 5.0m 정도)
- 바닥색 `0x7d5236`
- **문(D2)**: 서쪽 벽(X≈3) 위에 Z **[-0.15, 1.15]** 구간이 뚫려있다. X[2.8, 3.3] × Z[-0.4, 1.4] 정도는 비워둘 것

### 침실 B (`bedB`)
- 내부 X: **[-1.94, 1.94]**, Z: **[3.06, 6.94]** (4.0 × 4.0m 정도)
- 바닥색 `0x9a6a45`
- **문(D3)**: 북쪽 벽(Z≈3) 위에 X **[-0.65, 0.65]** 구간이 뚫려있다. X[-0.9, 0.9] × Z[2.8, 3.3] 정도는 비워둘 것

## 3. 구체적으로 할 것

각 방 함수는 거실(`livingRoom.js`)과 같은 패턴을 따른다: `THREE.Group`을 만들어 `scene`에 추가하고, `makeMesh(geo, color, parent, pos, extraMat, opts)`로 소품을 넣는다. `makeMesh`의 5개 필수 인자(geo, color, parent, pos)는 **절대 순서/개수를 바꾸지 마라** — 6번째 `opts`만 써서 태깅한다.

```js
import * as THREE from 'three';
import { makeMesh } from '../../render/meshFactory.js';

export function createBedA(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // 침대 프레임 예시 — 바닥과 물리적으로 부딪혀야 하는 큰 가구는 solid:true
  makeMesh(new THREE.BoxGeometry(1.4, 0.4, 2.0), 0x7a4a2a, room, [-1.5, 0.2, -5], {}, { solid: true });
  // ... 매트리스, 협탁 등 계속 추가

  return { room };
}
```

**태깅 규칙**(거실과 동일):
- 바닥에 붙어서 플레이어가 부딪혀야 하는 큰 가구(침대, 책상, 옷장 등) → `{ solid: true }`
- 작은 장식 소품(쿠션, 액자, 화분 등) → 태그 없음(장식만)
- **`fadeable`은 넣지 마라** — 그건 카메라 시야를 가리는 벽 전용이고, 가구에는 안 쓴다(지금 이 프로젝트엔 아직 벽 페이드 자체가 구현 안 됐다)

**톤 맞추기**: 거실 색 팔레트를 참고해라(주황/갈색 계열 나무, 빨강 포인트, 로우폴리 프리미티브 — `THREE.BoxGeometry`/`CylinderGeometry`/`IcosahedronGeometry` 조합). `sample1.PNG`(프로젝트 루트)도 참고. 외부 GLB 에셋을 가져와도 되지만 필수는 아니다 — 가져온다면 `game/src/assets/restyle.js`의 `restyle()`로 톤을 맞춰라(이 파일은 이미 완성돼 있고 읽기 전용으로 쓸 수 있다).

**방마다 컨셉 제안(강제 아님, 참고용)**:
- **침실 A**: 침대(더블 정도 크기) + 협탁 + 러그. 조용한 톤.
- **작업실**: 책상(거실 책상과는 다른 배치/색) + 책장 + 의자. 거실에 이미 책상이 있으니 "다른 용도의 작업 공간" 느낌으로.
- **침실 B**: 침대(싱글, 침실A와 다른 색/배치) + 화분 or 옷장.

**스코프 경고**: 방 하나당 소품 5~8개 정도가 적당하다. 너무 많이 채우면 리뷰가 오래 걸리고, 이후 M6(아이템 증식)에서 어차피 더 추가한다.

## 4. 검증 방법

`main.js`를 못 건드리니, 네가 만든 방을 실제로 보려면 `game/_scratch/` 안에 임시 테스트 페이지를 만들어라(다른 레인들도 이 패턴을 썼다):

```
game/_scratch/preview_rooms.html
game/_scratch/preview_rooms.js
```
`preview_rooms.js`에서 `core/context.js`의 `scene`/`camera`/`renderer`를 가져오고, `createHouse(scene)` + 네가 만든 `createBedA/Study/BedB(scene)`를 직접 호출해서 카메라를 해당 방 쪽으로 대충 놓고 스크린샷을 찍어봐라.

헤드리스 Chrome 스크린샷 도구가 이미 있다(로컬 Chrome 그대로 사용, 별도 다운로드 없음):
```
cd tools/render-check
node shot.mjs "<game 폴더 절대경로>" "./out.png" 2000
```

커밋 전에:
```
node --check game/src/world/rooms/bedA.js
node --check game/src/world/rooms/study.js
node --check game/src/world/rooms/bedB.js
node tools/check-imports.mjs "<game 폴더 절대경로>"
```
(네 파일들은 아직 아무도 안 부르니 `check-imports.mjs`의 그래프엔 안 잡힌다 — `node --check`로 문법만 확인하면 충분하다.)

## 5. 완료 기준

- [ ] `bedA.js`/`study.js`/`bedB.js` 3개 파일, 각각 `createBedA/Study/BedB(scene)` export
- [ ] 가구가 §2의 문 개구부를 막지 않음(직접 걸어서 확인은 통합자가 하겠지만, 좌표 계산으로 미리 피해라)
- [ ] 가구가 §2의 "내부" 범위를 벗어나 벽을 뚫지 않음
- [ ] 큰 가구는 `{ solid: true }` 태깅, 작은 장식은 미태깅
- [ ] `makeMesh` 5개 필수 인자 순서 그대로 유지
- [ ] off-limits 파일(`main.js`, `layout.js` 쓰기, `house.js`, `livingRoom.js` 쓰기 등) 미접촉 — `git diff --stat main...HEAD`로 확인
- [ ] `node --check`, `check-imports.mjs` 통과
- [ ] `dev-log.md` 맨 위에 항목 추가(방별로 뭘 넣었는지, 소품 개수)

## 6. Git 작업 방식

`-1절`에서 만든 별도 클론 안에서, `gemini/lane-rooms` 브랜치에만 커밋해라. `main`으로 merge하거나 강제 push하지 마라. 끝나면 push만 하고 두면 리뷰 후 병합된다.
