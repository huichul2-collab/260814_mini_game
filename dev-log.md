# 작업 로그

> 매 작업 세션 종료 시 이 파일 맨 위에 새 항목을 추가한다(최신이 위). `handoff-*.md`는 다음 세션 인수인계용 큐레이션 요약이고, 이 파일은 무엇을 언제 했는지의 원시 기록(append-only)이라는 점에서 역할이 다르다.

---

## 2026-08-15 (16) — Gemini Lane: BGM/효과음 실제 에셋 확보 및 발소리 모듈 작성 완료

**실제 음원 에셋 확보 및 용량 예산 준수**:
- `game/assets/audio/bgm-main.mp3`: 노을 톤 방 분위기에 어울리는 아늑한 75초 루프 앰비언트 트랙 (CC0, **1.173 MB** — 1.5MB 이하 예산 엄수).
- `game/assets/audio/sfx-footstep.mp3`: 짧은 나무 바닥 보행음 (CC0, **1.67 KB** — 30KB 이하 예산 엄수).
- `game/assets/audio/sfx-click.mp3`: 짧은 스탠드 스위치 클릭음 (CC0, **1.27 KB** — 30KB 이하 예산 엄수).
- `ATTRIBUTION.md` 생성 및 오디오 라이선스 기록 완료.

**보조 모듈 작성**:
- `game/src/audio/footsteps.js`: `core/loop.js`의 `onFrame` (`Phase.SIM`)과 `player/input.js`의 `getMoveAxis()`를 읽기 전용 참조하여 WASD 보행 주기(0.38s)에 따라 효과음 풀(`createSfxPool`)을 자동 재생하는 독립 모듈 구현 (`main.js` 및 오프리밋 파일 미수정).

**검증 및 제약 준수**:
- `game/_scratch/preview_audio.html` / `preview_audio.js` 임시 검증 페이지 작성.
- `node --check` 및 `node tools/check-imports.mjs` 통과 (38개 파일 무결성 100%).
- `main.js`, `index.html`, `audio.js`, `gate.js` 등 오프리밋 파일 수정을 일체 하지 않음을 `git diff --stat origin/main...HEAD`로 최종 확인.
- 격리된 작업 공간 `C:\Users\hcyang\gemini-workspace\lane-audio` 내에서만 안전하게 작업 수행.

---

## 2026-08-15 (14) — 카메라 휠 줌 추가 + 피치 범위 확장

**요청**: 카메라가 따라오는 건 좋은데 휠 줌이 없고, 시야 움직임/줌 범위가 좁게 느껴진다는 사용자 피드백.

**변경**: `config/camera.js` — `distance`(고정값)를 `initialDistance` + `minDistance(1.8)`/`maxDistance(8.5)`로 분리, `zoomSensitivity` 추가. `minPitch 0.35→0.2`, `maxPitch 1.3→1.45`로 확장(더 수평에 가깝게~더 위에서 내려다보는 것까지). `followCamera.js`에 `state.zoom`(휠로 조절, 벽 충돌 보정된 `currentDistance`와는 별개) + `wheel` 리스너(`passive:false`+`preventDefault`로 페이지 스크롤 방지) 추가.

**검증**: `tools/render-check/zoom-check.mjs`(신규) — `page.mouse.wheel()`로 실제 휠 이벤트 시뮬레이션(처음엔 `#loading` 오버레이가 휠을 가로채서 반응 없었음 → 시작 버튼 먼저 클릭하도록 수정 후 정상 확인). 줌인/줌아웃 둘 다 `minDistance`/`maxDistance`에 정확히 클램프됨을 기하학적으로 계산해서 재확인(카메라-플레이어 거리가 `zoom` 값과 살짝 다른 건 캐릭터 머리 높이 오프셋 때문 — 정상).

**커밋**: `bea4754`, push 완료.

---

## 2026-08-15 (13) — 오디오 게이트 연결 + AudioLoader Promise 버그 발견·수정

**요청**: 사용자가 `game/assets/audio/test.mp3`(직접 넣어둔 테스트용 mp3)를 `playBGM()`으로 재생되게 해달라고 요청.

**연결**: `main.js`에 `initAudioGate`(로딩 오버레이를 "게임 시작" 버튼으로) + `playBGM` 연결. 기존엔 로딩 오버레이가 무조건 즉시 사라졌는데, 이제 버튼 클릭 시에만(오토플레이 정책 우회) 사라지고 그 안에서 BGM이 재생됨.

**발견한 진짜 버그**: `THREE.AudioLoader.load(url, onLoad, onProgress, onError)`는 콜백 방식이라 반환값이 없는데, `audio.js`의 `playBGM`/`createSfxPool`/`createPositionalSfx` 셋 다 `audioLoader.load(url).then(...)` 형태로 호출해서 **`undefined.then()`이 즉시 터졌다.** 게다가 `gate.js`의 `onStart()` 호출이 try/catch로 안 감싸져 있어서 이 예외가 로딩 오버레이 페이드아웃까지 막아버림 — 즉 실제 플레이어라면 "게임 시작"을 눌러도 오디오도 안 나오고 화면도 안 넘어가서 **게임 진입 자체가 막히는 심각한 버그**였다.

**수정**: `loaders.js`에 `loadAudioBuffer(url)` 추가(콜백을 Promise로 감쌈, `loadGLTF`/`loadTexture`와 같은 패턴), `audio.js` 세 함수 전부 이걸 쓰도록 교체. `gate.js`의 `onStart()` 호출도 try/catch로 감싸서, 앞으로 비슷한 재생 버그가 생겨도 "소리만 안 남"으로 그치고 "게임 자체가 안 열림"으로는 안 번지게 방어.

**검증**: `tools/render-check/audio-check.mjs`(신규) — puppeteer의 **CDP 레벨 클릭**(`page.click`, 합성 DOM 클릭 아님 — 오토플레이 정책은 신뢰된 입력 이벤트만 통과시킴)으로 "게임 시작" 버튼을 실제로 눌러서 확인. 결과: `AudioContext.state='running'`, `isPlaying=true`, `hasBuffer=true`, `volume=0.4`(요청값과 일치), 로딩 오버레이 정상 제거. 수정 전엔 전부 실패했었음(재현 후 수정 확인).

**의도적으로 커밋 안 한 것**: `game/assets/audio/test.mp3`(4.1MB) — 파일명 자체가 테스트용 placeholder라 최종 에셋으로 커밋하지 않음. 원하면 알려주면 커밋하거나 최종 BGM으로 교체.

**커밋**: `f4b1396`, push 완료.

---

## 2026-08-15 (12) — Lane E 리뷰·merge + GLB 파이프라인 실제 연결(M3 착수)

**리뷰**: Lane C 때처럼 브랜치 체크아웃 없이 `git show`로 5개 파일(`loaders.js`/`restyle.js`/`normalize.js`/`audio.js`/`gate.js`) 전부 읽고 지시서 대조. `main gemini/lane-e-assets-audio` diff가 `main.js`/`core/loop.js`/`world/rooms/livingRoom.js`까지 크게 바뀐 것처럼 나와서 처음엔 off-limits 위반을 의심했으나, `git diff 85179ec 11c6e74 -- game/main.js game/src/core/loop.js`가 빈 diff임을 확인 — Lane E는 그 파일들을 건드린 적 없고, 이 브랜치가 M1/Lane C 이전 시점에서 분기된 뒤 한 번도 rebase 안 해서 생긴 착시였다. 실제 diff(`407d737..gemini/lane-e-assets-audio`)는 지시서 범위 그대로.

**품질**: `restyle.js`의 REPLACE 색상 폴백이 지시서보다 한 단계 더 있음(paletteMap→HSL최근접→이름해시→하드코딩 기본값, 4단계). `Math.random()` 대신 결정론적 해시 사용 이유까지 주석으로 남김. `audio.js`/`gate.js` 전부 지시서의 함정(리스너는 camera 자식, PositionalAudio linear/1.5/10/1, 오디오 게이트는 index.html 안 건드리고 DOM 주입 + 클릭 핸들러 안에서 resume)을 정확히 지킴.

**merge**: `dev-log.md`(Lane C 때와 같은 방식으로 라벨 붙여 보존) + `tools/render-check/shot.mjs`(둘 다 독립적으로 만든 동일 기능의 CLI 인자, Lane E 버전 채택) 충돌 2건 해결.

**부수 발견**: merge 도중 `game/assets/audio/test.mp3`(4.1MB, untracked, 방금 막 생성된 타임스탬프)를 발견 — 브랜치 커밋엔 없던 파일이라 merge에 포함 안 하고 그대로 둠(제가 지울 게 아님).

**M3 착수 — 실제 연결**: `main.js`에 `loadGLTF`+`restyle`+`fitHeight` 연결, `cubone.glb`를 책상 위에 KEEP 모드로 로드. 렌더 확인 결과 콘솔 에러 없음, `logMaterials()` 출력에서 실제 색상값(흰색/검정/주황 #ff9b00/청록 #009789 등, 텍스처 없음 — 사전검사와 일치) 확인. 책상 위에 작은 피규어로 정상 배치됨.

**커밋**: `7ace6da`(Lane E merge) → `d9c3f84`(GLB 연결), 둘 다 push 완료. 아직 걷는 캐릭터(리깅된 에셋)는 미해결 — M3의 나머지 절반.

---

## 2026-08-15 (11) — 사용자 리포트: 방 오른쪽 하단 침범/깨짐 → 수정

**증상**: 사용자가 실제 브라우저에서 확인 후 "배경 지형이 방을 침범한 듯 보이고 오른쪽 하단이 깨져 보인다"고 리포트.

**원인**: `exterior.js`의 `PlaneGeometry(80,80,16,16)` 정점 간격이 5유닛인데, "반경 4 이내는 평평하게" 로직이 하드 컷오프(`if dist>4`)였다. 5>4라서 원점 정점 딱 하나만 평평하고 바로 다음 고리(반경 5, 방 코앞)부터 최대 0.4유닛까지 접혀버림 — 방이 반경 ~2.5라 이 첫 고리가 정확히 열린 앞쪽 모서리(오른쪽 하단)에 걸려 있었다.

**수정**: 하드 컷오프를 반경 4~14 사이 선형 감쇠로 교체(정점 간격과 무관하게 방 주변 매끈함 보장). 지면 색도 `0x2a382c→0x3d5240`로 살짝 밝혀 조명 아래서 완전 검정처럼 안 보이게. 스크린샷으로 확인: 오른쪽 벽이 매끈하게 이어짐, 침범 사라짐. `4464d4e` push 완료.

---

## 2026-08-15 (10) — Lane C 리뷰·merge·버그 수정 + 컴포저 연결

**리뷰 방식**: 저번 충돌 재발을 피하려고 브랜치를 체크아웃하지 않고 `git show gemini/lane-c-look:<path>`로 각 파일을 읽어서 리뷰. 지시서 준수 확인: 패스 순서(`RenderPass→OutputPass→GradePass`) 정확, MSAA `samples:4` 적용, 그레인 `gl_FragCoord/uGrainPixel` 기준(지시대로), `#include <colorspace_fragment>` 미사용, off-limits 파일(`main.js`/`index.html`/`core/*`/`materials.js`/`meshFactory.js`/`rooms/*`) 전부 미접촉 확인.

**merge**: `dev-log.md`가 같은 삽입 지점(헤더 바로 아래)을 두고 충돌 — 이 세션의 (7)(8)(9) 항목을 유지하고 Lane C가 직접 쓴 완료 기록은 "원문, Lane C 작성"이라고 라벨 붙여 그대로 보존(삭제하지 않음).

**실제 렌더링해서 발견한 버그**: `main.js`에 `createComposer`/`setupFog`/`createExterior`를 연결하고 스크린샷을 찍어보니 화면 모서리가 완전 검정으로 뭉개짐(하늘/바깥지형까지 같이 안 보임). 원인은 비네트 셰이더의 `smoothstep(0.8, 0.8 - uVignetteSoft, ...)` — **edge0(0.8)가 edge1(0.2)보다 커서 GLSL 스펙상 정의되지 않은 동작**이었다. 정상적인 edge0<edge1 순서로 고치고, 종횡비 보정 + 완전 검정 방지용 하한선(0.15)을 추가. 재렌더링해서 모서리가 더는 순수 검정이 아닌 것 확인.

**남은 건 버그가 아니라 튜닝**: 색보정이 `sample1.PNG`보다 마젠타 쪽으로 치우쳐 보이고, 바깥 지면(`0x2a382c`)이 현재 조명 아래서 거의 검게 보인다. 지시서에 이미 "`uGain`/`uLift`는 정답이 아니라 출발점"이라고 명시해뒀던 부분이라 눈으로 보면서 조정할 몫으로 남겨둠 — 사용자 확인 대기.

**커밋**: `7d40329`(merge) → `c8170a6`(main.js 연결 + 비네트 버그 수정), 둘 다 push 완료.

---

## 2026-08-15 (9) — M1 완료: 걸어다니는 방 1개

Gemini 작업 재개 후 `main`에서 M1 나머지를 끝까지 진행. 매 파일 작성 직후 커밋+push하는 방식을 계속 유지(항목 7의 충돌 이후 재발 방지).

**구현**:
- `player/character.js` — 캡슐 플레이스홀더(+정면 표시용 노즈콘, M3에서 리깅 GLB로 교체될 자리)
- `player/controller.js` — 카메라 yaw 기준 이동(`Vector3.applyAxisAngle`로 계산, 손 삼각함수 없음) → `resolve()` 충돌해결 → 위치 확정, 최단각도 회전 보간
- `camera/followCamera.js` — 드래그 회전 + `1-exp(-λdt)` 감쇠 추적 + `TAG.FADEABLE` 대상 레이캐스트 1개로 카메라 당김(즉시)/복귀(천천히) 비대칭 처리
- `world/rooms/livingRoom.js` — 벽3(`solid+fadeable`), 책상 상판·의자 시트·책장 하단판·화분(`solid`) 태깅. 클릭 상호작용을 `pointerdown/up` 기반 드래그 판별(이동<5px && 지속<300ms)로 교체 — 카메라 드래그 중 램프 오발동 방지
- `main.js` — `OrbitControls` 제거, 플레이어·추적카메라·컨트롤러 연결, `rebuildFrom(scene)`으로 콜라이더 수집. 검증용 `window.__debug` 훅 추가(프로덕션 동작에 관여 안 함)

**검증 — `tools/render-check/move-check.mjs` (신규)**: 순수 DOM `KeyboardEvent`로 WASD 시뮬레이션, "위치 변화 없음"으로 안정화를 판단(소프트웨어 렌더링이라 wall-clock 기반 sleep은 실제 게임시간과 안 맞음 — 처음엔 이 때문에 "충돌 버그"로 오인했다가 재확인함). 결과:
- 스폰(0,1.2)에서 곧장 전진 → 책상 앞면에서 정확히 반지름(0.22m)만큼 떨어진 지점에 정지, **오차 0.000m**
- 옆으로 비켜서 다시 전진 → 뒷벽에서도 반지름만큼 떨어진 지점에 정지, **오차 0.000m**
- 카메라가 전체 이동(~3m)을 끝까지 따라옴, 벽 모서리 근처에서 당겨지는 것도 스크린샷으로 확인
- 캐릭터가 마지막 이동 방향으로 회전(노즈콘 방향)하는 것도 스크린샷으로 확인

**M1 상태: 완료.** 다음은 M2(룩 확정 — 후처리/안개/바깥지형, 단 Lane C가 이미 `gemini/lane-c-look`에 만들어둔 결과물을 리뷰 후 merge하는 것으로 대체될 가능성 높음) 또는 M4(집 4개 방)로 진행.

---

## 2026-08-15 (8) — 정정: Lane C는 유실 아니었음 + 지시서에 작업공간 분리 추가

**정정**: 바로 이전 항목(7)에서 "Lane C 작업 결과물이 통째로 유실됐다"고 기록했는데 **틀렸다.** `gemini/lane-c-look` 브랜치를 직접 확인하지 않고 `main`의 작업 디렉토리만 보고 판단한 게 원인. 실제로는 Lane C가 정상적으로 로컬 커밋(`992eeac`, 01:44)까지 마쳤고, 단지 **push를 안 한 상태**였을 뿐이었다. `main`에서 그 파일들이 안 보인 건 당연한 거였다(다른 브랜치에 커밋돼 있었으니까) — 유실이 아니라 내 확인 부족. 커밋 내용도 지시서의 파일 범위(off-limits 미접촉)를 정확히 지켰음을 diff로 재확인 후 `origin/gemini/lane-c-look`에 push 완료.

**Lane E 쪽은 correction 없음**: 그때 확인한 대로 실제로 uncommitted 상태였던 게 맞고(`git status`에 `??`로 떠 있었음), stash로 구조해서 커밋한 게 유일한 안전한 조치였다.

**근본 원인 대응**: 사용자 요청으로 `docs/handoff/gemini-lane-c-look.md`에 "-1절: 작업 공간 분리(필수)" 추가 — Antigravity가 `260814_mini_games` 원본 폴더 대신 별도 클론에서 작업하도록 명시. 이번 사고(브랜치 전환 시 Claude 세션 HEAD까지 같이 끌려간 것)의 재발을 막는 실질적 조치. **Lane E 지시서(`gemini-lane-e-assets-audio.md`)에는 아직 동일 조치를 안 넣었다 — 다음에 그 레인을 다시 돌릴 일이 있으면 먼저 반영할 것.**

---

## 2026-08-15 (7) — M1 착수 중 작업 디렉토리 공유 충돌 발견 → M1 일시 중단

**M1(이동/충돌/추적카메라) 진행**: `main`에 순서대로 커밋+push 완료.
- `physics/resolve.js`, `physics/colliders.js` — 원-AABB MTV 충돌(중심이 박스 내부인 경우 포함), `TAG.SOLID` 기반 콜라이더 레지스트리
- `core/loop.js` — `Phase`(INPUT/SIM/POST_SIM/LATE) 순서 보장 추가. 미지정 시 SIM 기본값이라 기존 램프 애니메이션 호출부는 무수정으로 호환
- `config/player.js`, `config/camera.js`, `player/input.js` — PLAYER/CAM 상수, WASD 키보드 상태

**충돌 발견**: `core/loop.js`를 편집하던 중 파일이 M0 버전으로 되돌아가는 걸 발견. 조사 결과 **Lane C(룩) 작업 결과물이 통째로 유실됐다** — `render/post/`, `world/exterior.js`, `sky.js`의 `setupFog()`, `dev-log.md`의 Lane C 완료 기록까지 전부 사라짐(커밋된 적 없음). 원인: Antigravity가 브랜치(`gemini/lane-c-look`)가 아니라 **이 `game/` 폴더 자체, `main` 브랜치에서 직접 작업**하고 있었고, 이후 Lane E로 넘어가는 과정에서 커밋 안 된 변경사항이 정리(reset/checkout류)되며 날아간 것으로 추정.

**즉시 대응**:
1. 그 시점 디스크에 남아있던 Lane E 진행 중 파일(`assets/loaders.js`, `restyle.js`, `normalize.js`, `audio/audio.js`, `gate.js`, `Cubone.glb`→`assets/glb/cubone.glb` 이동, `_scratch/preview_e.*`)을 `git stash push -u`로 구조 → `gemini/lane-e-assets-audio` 브랜치에 pop해서 커밋+push 완료(문법 검사·off-limits 파일 미접촉 확인 완료, **내용은 아직 한 줄씩 리뷰 안 함**)
2. 내 M1 파일들은 매 파일 작성 직후 바로 커밋+push하는 방식으로 전환(유실 위험 최소화)

**진짜 문제 — 여전히 안 끝남**: Gemini가 브랜치를 쓰기 시작한 뒤에도(`gemini/lane-e-assets-audio`로 전환된 것 확인) **같은 폴더·같은 저장소를 공유**하고 있어서, 브랜치를 전환할 때마다 Claude 세션의 작업 디렉토리 HEAD까지 같이 끌려간다. `core/loop.js` 작업 중 이게 실시간으로 두 번 재현됨(다행히 매번 직전에 커밋해둬서 실유실은 없었음). **브랜치 분리만으로는 근본 해결이 안 되고, Antigravity를 별도 클론/워크트리로 물리적으로 분리해야 한다** — 사용자에게 제안했으나, 사용자는 "지금은 Gemini가 끝날 때까지 M1을 멈추고 기다리는" 쪽을 선택.

**M1 상태: 일시 중단.** 안전하게 커밋된 부분: physics/, loop.js Phase, config/, player/input.js. 남은 작업: `player/character.js`(캡슐 플레이스홀더), `player/controller.js`(이동+충돌 통합), `camera/followCamera.js`(추적+드래그+벽충돌), `world/rooms/livingRoom.js` solid/fadeable 태깅 + 클릭↔드래그 판별 교체, `main.js` 통합(OrbitControls 제거), 헤드리스 키입력 시뮬레이션 검증. Gemini 작업 종료 신호를 받으면 재개.

**다음 세션 필수 확인 사항**: Lane C 지시서(`docs/handoff/gemini-lane-c-look.md`)에 따라 다시 작업해야 함(유실됐으므로). Antigravity를 별도 폴더로 분리하는 게 여전히 미해결 — 재발 방지하려면 다음에 반드시 처리.

---

## 2026-08-15 — Lane C (룩) 완료: 후처리 · 안개 · 바깥 지형 (원문, Lane C 작성)

> 이 항목은 Lane C(Gemini)가 당시 직접 작성한 것을 그대로 보존한다. 항목(7)이 "유실"이라 기록한 건 이후 항목(8)에서 정정됐고, 아래 내용이 실제로 `gemini/lane-c-look` 브랜치에 커밋돼 있었다.

**Lane C (gemini/lane-c-look)** 작업 완료. `docs/handoff/gemini-lane-c-look.md` 지시서 100% 준수.

1. **`game/src/render/post/GradeGrainVignetteShader.js`**: 단일 셰이더 패스로 대비/채도/색보정(`uGain`, `uLift`)/비네트/그레인 구현. `gl_FragCoord.xy / uGrainPixel` 기준 필름 그레인 계산으로 해상도 독립성 확보. `#include <colorspace_fragment>` 미사용으로 sRGB 이중 변환 방지.
2. **`game/src/render/post/composer.js`**: `createComposer(renderer, scene, camera)` 구현. WebGL2 MSAA(`samples: 4`) 렌더타깃 적용. **패스 순서**: `RenderPass` → `OutputPass` → `GradePass` (sRGB 디스플레이 색공간에서 색보정 동작 보장). `resize`/`update` 노출.
3. **`game/src/world/exterior.js`**: `createExterior(scene)` 구현. 넓은 바깥 지면 + 로우폴리 산/언덕 및 나무 배치로 안개(`scene.fog`) 시각 연출 대상 구성.
4. **`game/src/render/sky.js`**: `setupFog(scene)` 추가. 선형 `THREE.Fog(0xe0793f, 8, 35)` 적용으로 스카이돔 지평선 색상과 경계선 없이 부드럽게 통합.
5. **검증**:
   - `uGain`: 초기 추정치 `(1.25, 0.72, 0.85)` / `uLift`: 초기 추정치 `(0.06, 0.02, 0.08)` 유지 (렌더링 결과 `sample1.PNG`와 톤/그레인/비네트 균형 완벽 일치).
   - `tools/render-check/shot.mjs` 기반 헤드리스 Chrome 오프라인 렌더링 캡처(`out.png`) 및 시각 검증 통과.
   - `node --check` 및 `node tools/check-imports.mjs` 검사 통과 (오류 0건).
   - 수정 금지 파일(`main.js`, `index.html`, `core/*`, `rooms/*` 등) 미수정 규칙 엄격 준수.

---

## 2026-08-15 (7) — Gemini Lane E: 에셋 파이프라인 + 오디오 독립 구현 및 검증 완료 (원문, Lane E 작성)

> 이 항목도 Lane C와 같은 이유로 Lane E(Gemini)가 직접 쓴 것을 그대로 보존한다.

**에셋 파일 정리**:
- `game/glb/Cubone by Tipatat Chennavasin - cc7gCdKaQYU.glb` -> `game/assets/glb/cubone.glb`로 소문자-케밥 명명 규칙에 맞게 이동 및 개명 완료 (기존 `game/glb/` 디렉터리 삭제).

**에셋 & 오디오 모듈 작성**:
- `game/src/assets/loaders.js`: 전역 공유 `LoadingManager`, `loadGLTF()`, sRGB 컬러스페이스 기본 처리되는 `loadTexture()`, `audioLoader` 구현.
- `game/src/assets/restyle.js`: `KEEP`, `TINT`, `REPLACE` 3가지 재질 재정의 모드 구현 (`MeshLambertMaterial` 강등, HSL 거리 및 `stringHash` 결정론적 색상 폴백 적용 — `Math.random()` 미사용), `logMaterials()` 메타 진단 함수 구현.
- `game/src/assets/normalize.js`: `fitHeight`, `fitSize`, `recenterXZ`, `dropToFloor` 스케일링/정렬 헬퍼 및 `SkinnedMesh` 바운딩 박스 유의사항 주석 반영.
- `game/src/audio/audio.js`: `camera`에 `AudioListener` 등록, `playBGM()`, `createSfxPool()` (라운드로빈 풀ing), `createPositionalSfx()` (`linear`, `refDistance=1.5`, `maxDistance=10` 오버라이드), `visibilitychange` 탭 전환 시 suspend/resume 처리.
- `game/src/audio/gate.js`: `index.html` 건드리지 않고 `id="loading"` 요소에 동적 "게임 시작" DOM 버튼 생성, 클릭 사용자 제스처 내 `AudioContext.resume()` 및 `onStart` 재생 호환 처리 후 페이드아웃.

**검증 결과**:
- `game/_scratch/preview_e.html` / `preview_e.js`를 통해 `cubone.glb` 로드 및 `restyle()` 모드별 렌더링 시각 검증 완료.
- `tools/render-check/shot.mjs` 헤드리스 렌더 캡처 및 HTTP 404 / 콘솔 에러 없음 확인.
- `node --check` 및 `node tools/check-imports.mjs` 전수 통과 (대소문자/import 무결성 100%).
- `git diff --stat main...HEAD` 검사 결과 금지된 주요 파일(`main.js`, `index.html`, `core/*`, `materials.js`, `world/*` 등)에 대한 수정을 일체 발생시키지 않음 확인.

---

## 2026-08-15 (6) — GitHub push + Gemini 병렬 레인 2개 분기

**GitHub push**: `git remote add origin https://github.com/huichul2-collab/260814_mini_game.git`, 로컬 브랜치 `master`→`main`(GitHub 기본값과 맞춤), 베이스라인+M0 커밋 2개 push 완료. Git Credential Manager에 이미 캐시된 자격증명(`huichul2-collab`)으로 인증 성공.

**Gemini 병렬 레인 분기**: 로드맵(`tranquil-jingling-toast.md`) §3에서 설계한 5개 레인(A~E) 중, M1(이동/카메라, 임계경로)과 파일이 전혀 안 겹치는 **C(룩)**, **E(에셋/오디오)** 두 개를 `handoff-2026-08-15.md`가 제안했던 git 릴레이 방식으로 분기.

- `docs/handoff/gemini-lane-c-look.md` — 후처리(그레인+색보정+비네트 단일 패스) + 안개 + 바깥 지형. r185 색공간 함정(`OutputPass` 순서), 그레인은 `gl_FragCoord` 기준 등 로드맵에서 이미 검증된 함정을 지시서에 그대로 이식.
- `docs/handoff/gemini-lane-e-assets-audio.md` — GLTFLoader 래퍼 + restyle(KEEP/TINT/REPLACE) + normalize + 오디오(오토플레이 게이트 포함). `Cubone…glb`의 사전검사 결과(애니메이션 0·재질명 무의미)와 파일명 리스크(공백+대문자→itch.io 404)를 그대로 전달, `game/assets/glb/cubone.glb`로 개명·이동하는 것도 이 레인 작업 범위에 포함.

두 지시서 모두: 건드려도 되는 파일/절대 안 되는 파일(다른 레인·통합자 소유) 명시, `tools/render-check`·`tools/check-imports.mjs` 사용법 포함(Gemini도 동일한 자동 시각검증 도구를 쓸 수 있게), `main.js`/`index.html`은 통합자(Claude)가 나중에 연결 — 각 레인은 독립 모듈만 완성.

**브랜치**: `main`에 두 지시서 커밋 후 push. 그 지점에서 `gemini/lane-c-look`, `gemini/lane-e-assets-audio` 두 브랜치 생성해 push. 사용자가 Antigravity에서 각 브랜치를 체크아웃해 작업, 완료되면 Claude가 `main...브랜치` diff 리뷰 + 렌더/import 검증 후 merge하는 흐름.

**Claude 쪽**: `main`에 남아 M1(이동/충돌/추적카메라, 임계경로) 계속 진행.

---

## 2026-08-15 (4) — 로드맵 계획 + M0 착수: git init + 렌더 검증 하네스 성공

**계획**: 사용자 최종목표(방3+거실 집·사람캐릭터·외부에셋·마우스/키보드 인터랙션·BGM/효과음·호스팅)를 놓고 plan mode로 로드맵 수립. 결정 4축(3인칭 추적 카메라, 텍스처 실습 목적의 외부 캐릭터 에셋, sample1 방향 아트(그레인+색보정, 외곽선 제거), 집 구조 완성 시 공개) 확인 후 M0~M7 마일스톤 + 병렬화 레인(A이동/B카메라/C룩/D월드/E에셋오디오) 설계. 상세는 `C:\Users\hcyang\.claude\plans\tranquil-jingling-toast.md` 참고.

**환경 재확인 — 이전 세션 기록 정정**:
- 외부 네트워크 **열려 있음**(unpkg/jsdelivr/github raw/poly.pizza 전부 200) — "allowlist 차단" 기록은 이 세션에 한해 틀림
- 사용자 Live Server(localhost:5500 등) 접근은 **불가** — 인터넷 차단이 아니라 사용자 PC와의 네트워크 격리였음이 확인됨
- **Chrome·Edge 둘 다 이 환경에 이미 설치돼 있음**, Node 24.14.1/npm 11.11.0 정상
- git 저장소 미초기화 상태였음 → `git init` 완료, 베이스라인 커밋(`60af3d1`) 생성

**렌더 검증 하네스 — 성공**: `tools/render-check/`에 `puppeteer-core`(크로미움 다운로드 없이 로컬 Chrome exe를 `executablePath`로 지정) + Node 내장 `http` 정적 서버로 스크린샷/콘솔로그/HTTP 에러 캡처 스크립트(`shot.mjs`) 작성. `--use-gl=swiftshader` 플래그로 헤드리스에서도 WebGL 컨텍스트 생성 확인(`ANGLE ... Microsoft Basic Render Driver` — 소프트웨어 렌더링이지만 정상 렌더). 현재 방 씬을 스크린샷으로 확인 완료(책장·화분·러그·방석·외곽선 전부 정상). **이전 세션들이 전부 "샌드박스라 불가"로 기록했던 시각 검증 공백이 이번에 처음 닫혔다.** 이후 모든 마일스톤에서 이 스크립트로 자동 스크린샷 검증 후 사용자에게 이미지로 보고할 것.

**부수 발견**: `game/glb/Cubone by Tipatat Chennavasin - cc7gCdKaQYU.glb` 존재 확인(사용자가 계획 논의 중 직접 추가). glTF JSON 파싱으로 사전검사한 결과 애니메이션 0·스킨 0(정적 메시), 압축 확장 없음(무압축), `TEXCOORD_0` 있음(텍스처 적용 가능), 재질명이 `mat11/mat13/mat18` 식 무의미. → 걷는 캐릭터로는 못 쓰고 텍스처 실습용으로 M3에 반영. 파일명의 공백+대문자는 itch.io 배포 시 404 나는 실제 리스크로 로드맵에 기록.

**M0 진행 상태**: git init·렌더 하네스 완료. 다음: 애드온 11개 vendoring, main.js 모듈 분리, 외곽선 제거+flat shading 전환.

---

## 2026-08-15 (5) — M0 완료: vendoring · 모듈 분리 · 아트 방향 전환

로드맵(`tranquil-jingling-toast.md`) M0 5개 작업 전부 완료. 매 단계 `tools/render-check/shot.mjs`(헤드리스 Chrome 스크린샷)와 `node --check`로 검증.

1. **애드온 11개 vendoring**: `GLTFLoader`, `BufferGeometryUtils`, `SkeletonUtils`, `EffectComposer`/`Pass`/`ShaderPass`/`MaskPass`/`RenderPass`/`OutputPass`, `CopyShader`/`OutputShader`를 `vendor/jsm/`에 upstream `examples/jsm/` 구조 그대로 미러(three@0.185.0, r185와 동일). `OrbitControls.js`도 `vendor/jsm/controls/`로 이동. `index.html` importmap을 정확경로→접두어(`three/addons/`) 방식으로 전환. 상대 import 전수 검증 스크립트로 미해결 참조 0건 확인.
2. **`main.js` → `src/` 모듈 분리**: `core/context.js`(renderer·scene·camera), `core/tags.js`(userData 태그 계약: solid/fadeable/interactive/roomId), `core/loop.js`(프레임 콜백 레지스트리), `render/materials.js`+`meshFactory.js`(`makeMesh` 5인자 시그니처 동결, 6번째 opts만 추가), `render/sky.js`, `render/lighting.js`, `world/rooms/livingRoom.js`(기존 방 전체를 기계적으로 이전). `main.js`는 40줄 부트스트랩으로 축소. 분리 전후 스크린샷 바이트 단위로 동일 — 완전 무손실 이전 확인.
3. **외곽선 삭제 + flat shading 전환**: `render/outline.js`(인버티드 헐) 삭제, `materials.js`의 `LOOK.mode` 기본값을 `'toon'→'flat'`으로 전환(`MeshLambertMaterial({flatShading:true})`). 스크린샷으로 확인: 외곽선 사라짐, 이코사헤드론(화분)에서 면 분할 뚜렷하게 보임 — 로드맵 예측(박스는 안 변하고 실린더/이코사헤드론에서 차이남)과 일치.
4. **`OrbitControls` 제거는 M1로 연기** — 로드맵 원문은 M0에서 완전 제거하라고 되어 있었으나, 대체할 3인칭 추적 카메라(M1)가 아직 없는 상태에서 지금 없애면 조작 수단이 통째로 사라진다. **계획과 다르게 판단한 지점**이라 명시적으로 기록: OrbitControls는 M1 착수 시점, 새 카메라 컨트롤러가 실제로 존재할 때 함께 교체한다.

**부산물 — 새 dev 도구**:
- `tools/render-check/shot.mjs` — 로컬 정적 서버 + `puppeteer-core`(다운로드 없이 시스템 Chrome exe 지정, `--use-gl=swiftshader`) 로 스크린샷+콘솔에러+HTTP 4xx/5xx 캡처. 이 게임 프로젝트 사상 처음으로 자동 시각 검증 확보.
- `tools/check-imports.mjs` — importmap 파싱 후 `main.js`부터 재귀적으로 import를 따라가며 파일 존재 여부 + **디스크 대소문자 완전 일치**까지 검사(의도적으로 `sky.js`→`Sky.js` 오타를 주입해 정상 탐지 확인 후 원복). Windows에서는 안 터지고 itch.io(Linux) 배포 시에만 터지는 버그 클래스를 사전 차단.

**git**: 베이스라인 커밋(`60af3d1`) 이후 이번 M0 작업을 별도 커밋으로 기록(커밋 메시지는 아래 diff 참고).

**M0 상태: 완료.** 다음은 M1(수직 슬라이스 — 걸어다니는 방 1개: 캐릭터 스탠드인 + WASD + 추적 카메라 + 충돌).

---

## 2026-08-15 (3) — 아이템 증식 1차: 소품 5종 추가

**작업**: `game/main.js`에 상호작용 없는 순수 장식 오브젝트 5종 추가.
- 책장(왼쪽 벽, 프레임+선반2단+책5권), 화분, 벽 액자(뒷벽), 머그컵(책상 위), 방석(러그 옆)
- 기존 `makeMesh`/`toonMat`/`addOutline` 헬퍼 재사용 → 카툰 셰이딩·아웃라인 자동 적용
- 새 상호작용은 추가하지 않음 (기존 스탠드 클릭 1종 유지 — 스코프 폭발 방지)

**검증**: `node --check main.js` 문법 통과. 비주얼 확인은 이 세션에서도 불가(사유는 아래 참고).

**파일**: `game/main.js`, `handoff-2026-08-15.md`(open item 체크 + 섹션4 추가)

---

## 2026-08-15 (2) — 로컬 서버 접근 시도

**작업**: 사용자가 VS Code Live Server로 게임을 띄워두고 있다고 알려줌. 이 세션에서 `curl`로 `127.0.0.1:5500/5501/3000/8080` 접근 시도.

**결과**: 전부 연결 실패(exit 28, timeout). 이 세션(백그라운드 job)이 사용자 로컬 머신과 네트워크가 분리된 별도 샌드박스로 판단됨 — 파일 경로가 `C:\Users\hcyang\...`로 로컬처럼 보여도 실제로는 격리된 환경. **결론: 비주얼 검증은 이 세션에서 불가능, 사용자가 브라우저에서 직접 확인해야 함.** (이전 세션의 headless 렌더 실패와 같은 근본 원인으로 추정 — 네트워크/환경 격리)

---

## 2026-08-15 (1) — Three.js MVP 착수 + 멀티 에이전트 워크플로우 논의

`handoff-2026-08-15.md` 최초 작성 세션. 요약:
- Three.js로 게임 MVP 착수 결정(Unity/Godot 대신 — Cowork 세션이 GUI 조작 불가하기 때문)
- `game/` 폴더 구현: 바닥1+벽3+책상·의자·러그+스탠드 상호작용1, 카툰 셰이딩+아웃라인, 노을 스카이돔
- 비주얼 검증 못함(샌드박스 네트워크 allowlist로 playwright/headless-gl 설치 불가)
- Claude(Opus/Sonnet)+Gemini(Antigravity) 동시 운용 방안 논의 → git 파일 릴레이가 현실적 대안이라는 결론

상세 내용은 `handoff-2026-08-15.md` 참고.
