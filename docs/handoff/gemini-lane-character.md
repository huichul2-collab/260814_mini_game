# Gemini 작업 지시서 — Lane: 걷는 캐릭터 (리깅 + 애니메이션)

> 이 문서는 이 프로젝트의 다른 대화 맥락을 전혀 모르는 상태에서 읽는다는 전제로 쓰였다.
> 필요한 배경은 전부 이 안에 있다. 모르는 걸 추측하지 말고, 애매하면 범위를 좁혀서 처리할 것.

## -1. 작업 공간 분리 (반드시 먼저 할 것 — 이거 안 하면 작업이 통째로 날아갈 수 있다)

**`C:\Users\hcyang\claude\claude_project\260814_mini_games` 폴더를 그대로 열어서 작업하지 마라.** 그 폴더는 Claude가 `main` 브랜치에서 동시에 M4(집 확장) 작업 중이다. 같은 폴더에서 브랜치를 전환하면 서로 커밋 안 된 변경사항이 뒤섞이거나 날아가는 사고가 실제로 있었다.

**시작 전에 반드시 별도 폴더에 저장소를 새로 클론해라**:
```
git clone https://github.com/huichul2-collab/260814_mini_game.git C:\Users\hcyang\gemini-workspace\lane-character
cd C:\Users\hcyang\gemini-workspace\lane-character
git checkout -b gemini/lane-character origin/main
```
(마지막 줄: 이 레인은 새 브랜치라 `origin/main`에서 새로 분기한다. 경로 이름은 예시고, 다른 레인과 폴더만 겹치지 않으면 된다.)

이 새 클론 폴더 **안에서만** 작업하고, 커밋도 push도 전부 이 폴더에서 해라. 원본 `260814_mini_games` 폴더는 절대 열거나 건드리지 마라.

작업이 끝나면 `git push origin gemini/lane-character`까지 하고 끝내라. `main`으로 merge하지 마라(§7 참고).

## 0. 이 프로젝트가 뭔가

취미로 만드는 3D 방/집 탐험 게임. Three.js(r185) + 순수 ES 모듈, **빌드 단계 없음, npm 런타임 의존성 없음**. `game/vendor/`에 필요한 걸 전부 오프라인으로 미리 받아뒀다.

현재 상태: 방 1개, WASD로 걸어다니고(카메라 기준 방향 이동), 원-AABB 충돌, 3인칭 추적 카메라(드래그 회전+휠 줌), 후처리(그레인+색보정+안개). **캐릭터는 아직 캡슐 플레이스홀더다** — `game/src/player/character.js`가 `THREE.CapsuleGeometry` + 정면 표시용 원뿔(노즈콘)로 만들어져 있다. 이걸 실제 리깅된 3D 캐릭터로 교체하는 게 이 레인의 목표다.

**이미 시도해본 것**: `game/assets/glb/cubone.glb`(Poly Pizza에서 받은 CC0 에셋)를 로드해봤는데, **애니메이션 0개·스킨 0개인 정적 메시**라 걷는 캐릭터로 못 썼다(지금은 책상 위 장식 소품으로만 씀). 이 레인에서 다시 이 실수를 반복하지 마라 — **애니메이션/스킨이 있는 에셋인지 먼저 확인**하고 받아라.

## 1. 네 작업 범위

**수정할 파일**: `game/src/player/character.js` (전체 재작성 가능 — 단 아래 §2의 반환 계약은 반드시 지킬 것)

**새로 만들 파일**: 필요하면 `game/src/player/animations.js` 같은 보조 파일 추가 가능(character.js에서 애니메이션 로직만 분리하고 싶다면). 강제는 아님.

**에셋**: `game/assets/glb/`에 새 캐릭터 GLB 추가(파일명은 소문자-케밥, 예: `character-walk.glb`)

**읽기만 허용(수정 금지)**: `game/src/core/loop.js`, `game/src/core/tags.js`, `game/src/config/player.js`, `game/src/player/input.js`(WASD 상태 읽기용, `getMoveAxis()` export됨), `game/src/render/materials.js`, `game/src/assets/loaders.js`, `game/src/assets/restyle.js`, `game/src/assets/normalize.js`

**절대 건드리면 안 되는 파일**: `game/main.js`, `game/index.html`, `game/src/player/controller.js`, `game/src/camera/*`, `game/src/physics/*`, `game/src/world/*`, `game/src/audio/*`

## 2. 반환 계약 (절대 안 깨야 함)

`main.js`와 `controller.js`가 이미 `createPlayer()`를 이렇게 쓰고 있다:
```js
const player = createPlayer(scene, [x, y, z]);  // main.js
// player.root.position  ← controller.js가 매 프레임 직접 수정(이동)
// player.radius          ← physics/resolve.js가 충돌 반지름으로 씀
```
**`createPlayer(scene, spawn)`의 시그니처와, 반환 객체에 최소한 `{ root, radius }`가 있어야 하는 조건은 절대 바꾸지 마라.** `root`는 `THREE.Group`이어야 하고(controller.js가 `.position`을 직접 대입함), `radius`는 숫자(충돌 반지름, `config/player.js`의 `PLAYER.radius = 0.22`를 그대로 쓰면 됨 — 시각적 모델 크기와 충돌 반지름은 별개라 모델이 정확히 0.44m 폭일 필요는 없음).

추가 필드(예: `mixer`, `playAnimation` 같은 걸 반환 객체에 더 넣는 것)는 자유롭게 해도 된다 — 다른 코드가 안 쓸 뿐 깨지지 않는다.

## 3. 구체적으로 할 것

### 3.1 애니메이션 있는 캐릭터 에셋 확보

**요구사항**: glTF/GLB 포맷, 최소 걷기(walk) 애니메이션 클립 포함(가만히 서있는 idle도 있으면 더 좋음), 스킨(리깅) 있음.

**추천 소스** (CC0 또는 유사 관대한 라이선스, glTF로 바로 쓸 수 있는 것 우선 — Blender 같은 3D 변환 툴이 없다는 전제로 골라야 한다):
- Quaternius(quaternius.com) — CC0, 로우폴리 휴먼/캐릭터 팩에 걷기 애니메이션이 흔히 포함됨. 이 프로젝트 톤(로우폴리)과도 잘 맞음.
- Kenney(kenney.nl) — CC0, 애니메이션 포함 캐릭터 팩 있음.
- Mixamo(mixamo.com) — 매우 풍부하지만 **FBX로만 내보내지고 glTF 변환에 Blender가 필요**해서 이 환경엔 안 맞을 가능성이 큼. glTF 직접 다운로드 옵션이 있는지 먼저 확인하고, 없으면 후순위로.

받은 파일이 실제로 애니메이션/스킨을 갖고 있는지 **다운로드 직후 바로 검증해라** (Node로 GLB 헤더만 파싱, 렌더링 불필요):
```js
const fs = require('fs');
const b = fs.readFileSync('파일경로.glb');
const len = b.readUInt32LE(8);
const chunkLen = b.readUInt32LE(12);
const json = JSON.parse(b.slice(20, 20 + chunkLen).toString('utf8'));
console.log('animations:', (json.animations || []).length);
console.log('skins:', (json.skins || []).length);
console.log('clip names:', (json.animations || []).map(a => a.name));
```
`animations`와 `skins`가 둘 다 0보다 커야 한다. 0이면 다른 에셋을 찾아라 — cubone.glb 때 이미 겪은 실수다.

### 3.2 `character.js` 재작성

```js
import { loadGLTF } from '../assets/loaders.js';
import { fitHeight, dropToFloor } from '../assets/normalize.js';
import { restyle, Restyle } from '../assets/restyle.js';
import { PLAYER } from '../config/player.js';

export function createPlayer(scene, spawn = [0, 0, 0]) {
  const root = new THREE.Group();
  root.position.set(spawn[0], 0, spawn[2]);
  scene.add(root);

  const player = { root, radius: PLAYER.radius, mixer: null, actions: {} };

  // GLB는 비동기 로드 — 로드되기 전까지는 캡슐 같은 임시 표시(선택)나
  // 빈 root만 있어도 무방하다(움직임 로직은 root만 있으면 정상 동작).
  loadGLTF('./assets/glb/<파일명>.glb').then((gltf) => {
    const model = gltf.scene;
    fitHeight(model, PLAYER.height);
    dropToFloor(model);
    restyle(model, { mode: Restyle.KEEP }); // 또는 TINT/REPLACE — 톤 맞춰서 골라라
    root.add(model);

    if (gltf.animations && gltf.animations.length) {
      player.mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        player.actions[clip.name] = player.mixer.clipAction(clip);
      }
      // 클립 이름은 에셋마다 제각각이다('Walk', 'walk', 'Armature|Walk' 등) —
      // 대소문자 무시 + 부분일치로 찾는 헬퍼를 만들어 써라. 하드코딩 금지.
    }
  });

  return player;
}
```

### 3.3 이동 상태에 따라 idle ↔ walk 전환

`controller.js`를 건드리지 말고, **이 파일 안에서 자체적으로** `core/loop.js`의 `onFrame`에 등록해서 처리해라:
```js
import { onFrame, Phase } from '../core/loop.js';
import { getMoveAxis } from './input.js';

// createPlayer() 안, return 전에:
onFrame((dt) => {
  if (player.mixer) player.mixer.update(dt);

  const axis = getMoveAxis();
  const moving = axis.x !== 0 || axis.z !== 0;
  // moving 여부에 따라 walk 액션 재생/idle로 크로스페이드
  // (THREE.AnimationAction.crossFadeTo 또는 단순 play/stop으로 시작해도 됨)
}, Phase.SIM);
```
이렇게 하면 `controller.js`를 전혀 안 건드리고도 이동에 반응하는 애니메이션을 만들 수 있다. `getMoveAxis()`는 `player/input.js`가 이미 export하고 있다(읽기 전용 사용 허용).

### 3.4 리깅 에셋을 못 구했을 때의 대안 (허용됨)

정말 적당한 무료 리깅 에셋을 못 찾으면, **정적 메시를 절차적으로 흔들어 걷는 척**하는 것도 완료로 인정한다:
- 이동 중일 때 `root`나 모델의 로컬 위치/회전을 `Math.sin(time*속도)`로 상하 바운스 + 좌우 살짝 기울임을 주는 식
- 이건 진짜 대안이지 실패가 아니다 — 완료 기준(§6)에 "리깅 애니메이션 또는 절차적 걷기 중 하나"라고 명시해뒀다.

## 4. 검증 방법

헤드리스 Chrome 스크린샷 도구가 이미 있다(로컬 Chrome 그대로 사용, 별도 다운로드 없음):
```
cd tools/render-check
node shot.mjs "<game 폴더 절대경로>" "./out.png" 2500
```

**움직임/애니메이션 확인**: `main.js`를 고치지 않고, `game/_scratch/preview_char.html` + `.js` 같은 임시 파일을 만들어서 캐릭터만 따로 로드해 확인해도 되고, 아니면 순수 DOM `KeyboardEvent`(`window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW'}))`)로 실제 게임 흐름에서 W를 눌러보고 스크린샷을 여러 장 찍어서(0.3초 간격 등) 애니메이션이 프레임마다 바뀌는지 확인해도 된다. `#loading` 오버레이가 화면을 덮고 있으니, 게임을 실제로 조작하려면 먼저 `#audio-start-btn`을 클릭해야 한다(puppeteer면 CDP 클릭 `page.click()` 사용 — 합성 DOM 클릭은 오디오 게이트 통과가 안 될 수 있지만 캐릭터 움직임 자체는 클릭 없이도 될 수도 있다, 안 되면 클릭부터 하고 테스트).

커밋 전에:
```
node --check game/src/player/character.js
node tools/check-imports.mjs "<game 폴더 절대경로>"
```

## 5. 라이선스

CC0가 아니라 CC-BY류를 쓰게 되면, 프로젝트 루트에 `ATTRIBUTION.md`(없으면 새로 만들어라)에 에셋명·제작자·라이선스·출처 URL을 한 줄 추가해라.

## 6. 완료 기준

- [ ] 리깅+애니메이션 있는 캐릭터 에셋 확보(또는 §3.4 절차적 대안), GLB 사전검사로 animations/skins > 0 확인
- [ ] `character.js`가 `{ root, radius }` 반환 계약 유지
- [ ] `PLAYER.height`(1.7m)로 스케일 맞춤, 바닥에 발이 닿음(뜨거나 파묻히지 않음)
- [ ] W를 누르면 걷는 모션(또는 절차적 흔들림)이 보이고, 멈추면 idle(또는 정지)로 돌아감
- [ ] `controller.js`/`main.js`/`camera/*` 등 off-limits 파일 미접촉 — `git diff --stat main...HEAD`로 확인
- [ ] `node --check`, `check-imports.mjs` 통과
- [ ] `dev-log.md` 맨 위에 항목 추가(어떤 에셋을 어디서 구했는지, 라이선스, 애니메이션 클립 이름들)

## 7. Git 작업 방식

`-1절`에서 만든 별도 클론 안에서, `gemini/lane-character` 브랜치에만 커밋해라. `main`으로 merge하거나 강제 push하지 마라. 끝나면 push만 하고 두면 리뷰 후 병합된다.
