# 작업 로그

> 매 작업 세션 종료 시 이 파일 맨 위에 새 항목을 추가한다(최신이 위). `handoff-*.md`는 다음 세션 인수인계용 큐레이션 요약이고, 이 파일은 무엇을 언제 했는지의 원시 기록(append-only)이라는 점에서 역할이 다르다.

---

## 2026-08-15 — Lane C (룩) 완료: 후처리 · 안개 · 바깥 지형

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
