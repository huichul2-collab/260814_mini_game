# 작업 로그

> 매 작업 세션 종료 시 이 파일 맨 위에 새 항목을 추가한다(최신이 위). `handoff-*.md`는 다음 세션 인수인계용 큐레이션 요약이고, 이 파일은 무엇을 언제 했는지의 원시 기록(append-only)이라는 점에서 역할이 다르다.

---

## 2026-08-16 (20) — gemini/lane-character 리뷰·merge + 검증 스크립트 신규

**리뷰 방식**: 체크아웃 없이 `git show`/`git diff main...origin/gemini/lane-character`로만 리뷰(공유 폴더 체크아웃 사고 방지 — `dev-log.md` (16)(17) 참고). 커밋 1개(`18c2246`), 변경 6개 파일.

**검증(사용자가 이미 확인한 GLB 내용물은 재검증 안 함)**: `createPlayer` 반환 계약 `{root, radius}`가 상위집합(`mixer`/`actions` 추가)으로 유지됨을 확인 — `main.js`가 같은 객체 참조를 `window.__debug.player`로 잡고 있어 GLB 비동기 로드 후 `mixer`가 채워져도 그대로 반영됨(별도 배선 불필요). `restyle()` KEEP 모드가 스키닝 메시에 `material.skinning` 플래그를 안 주는데, r185는 `object.isSkinnedMesh` 기준으로 자동 판정(벤더 소스에서 직접 확인: `skinning:!0===S.isSkinnedMesh`)이라 버그 아님. off-limits(`main.js`/`world/`/`camera/`/`physics/`/`audio/`) 무침범 확인.

**dev-log.md 충돌**: 두 브랜치가 같은 지점((14) 이후)에서 각각 "(15)"를 붙여 갈라짐 — 내용이 서로 달라 번호 중복을 감수하고 둘 다 살림, Lane E merge 때 세운 선례(`(원문, Lane X 작성)` 표기)를 그대로 따름.

**`ATTRIBUTION.md` 오류 수정**: Gemini가 적은 "character-robot.glb 저자: Tom de Smedt"가 틀림. three.js 공식 저장소(`examples/models/gltf/RobotExpressive`) 확인 결과 실제로는 **Tomás Laulhé 제작(CC0 1.0), Don McCurdy가 표정 모프타겟 추가·FBX2GLTF 변환**으로 수정한 것 — 정확한 출처로 교체.

**`tools/render-check/character-check.mjs` 신규**: 헤드리스 Chrome, GLB `mixer` 생성 대기 → 정지 시 `currentAction` 클립명에 'idle' 포함 → W 입력 중 'walk'로 전환 → 캡슐 플레이스홀더가 `root.children`에서 빠졌는지, 4가지 전부 자동 판정. 전부 통과.

**회귀 확인**: `m4-rooms.mjs` 13/13 유지(로봇이 캡슐보다 어깨가 넓지만 충돌 반지름은 `PLAYER.radius` 그대로라 문 통과 영향 없음), `room-tint-check.mjs` 전부 통과(로봇 캐릭터로 바뀐 스크린샷 기준 재확인, Job 1의 색보정 수치 그대로 유효). `tools/check-imports.mjs` 40개 파일 전부 통과.

**관찰(이번 작업 범위 밖, `STATE.md`에 후속 항목으로 기록)**: 로봇이 캡슐보다 시각적으로 크고 둥글어서 스크린샷상 화면을 많이 채움 — 카메라 거리/피치 재튜닝이 필요할 수 있으나 이번 지시 범위에 없어 손대지 않음.

**커밋**: `6e68173`(merge) → `character-check.mjs`/`STATE.md` 커밋으로 이어짐.

---

## 2026-08-16 (19) — (18)의 수용기준이 잘못 설계됨: 조명 우회로 재발, 재작업

**문제**: (18)에서 "방끼리 채널 최대차 ≥12"를 수용기준으로 세웠는데, 이건 방마다
조명 색을 다르게 칠하기만 해도 통과한다 — 실제로 그렇게 통과시켰다. 사용자가
스크린샷 픽셀을 직접 재서 결과를 반박: 바닥 R/G가 화면에서 2.39~2.65인데 재질
원본 R/G는 1.44~1.53(60~70% 왜곡), 거실·작업실은 색으로 구분이 안 됐고(2.39 vs
2.40), 무엇보다 침실A는 오렌지 포인트라이트(강도 4.6, 거실 0.35의 13배)에 씻겨
클리핑 픽셀(채널 255)이 다른 방의 7~14배 — 캐릭터 머리가 타 있었다.

**교훈**: "방끼리 다른가"를 재는 지표는 조명으로 손쉽게 우회 가능하다. 재야 할
것은 "재질 원본색이 화면에 얼마나 살아남는가"다. 방 구분은 조명이 아니라
lane-rooms가 채울 소품의 몫으로 넘긴다.

**`lighting.js`**: `ROOM_LIGHT`(방별 색+강도, 최대 13배 격차)를 제거. 전 방
동일한 따뜻한 백색(`0xfff1de`, 채널 간 편차 25% 이내)에 강도만 방마다
1.2~1.5(±0.3 이내, 최대 1.5)로 미세하게 다르게. `ROOMS`에서 방 중심 좌표를
읽는 구조는 유지(하드코딩 없음).

**`GradeGrainVignetteShader.js`**: `uGain` (1.15,0.92,0.88)→(0.92,1.0,1.25),
`uLift` (0.05,0.04,0.06)→(0.02,0.03,0.08). R을 더 낮추고 B를 크게 올려 바닥
R/G·B/G가 재질 원본 비율에 최대한 가깝게 살아남도록.

**`room-tint-check.mjs` 전면 교체**: "방끼리 구분되는가" 지표를 완전히 버리고
(a) 방별 바닥 R/G ≤1.8 그리고 B/G ≥0.55 (b) 클리핑 픽셀(채널 하나라도 ≥250)
<0.5% (c) 어느 방도 거실 밝기의 60% 미만 아님, 세 가지로 교체.

**샘플 패치도 다시 옮겨야 했다(2차)**: (18)에서 쓰던 캐릭터 바로 옆 패치
(x 250~390, 570~710 / y 430)가 **living 한정으로 캐릭터 발밑 빨간 러그
소품과 겹쳐 오염**되고 있었다(m4-living.png에서 러그가 x~350~650을 덮음) —
이게 living의 R/G·B/G가 유독 비정상이던 진짜 원인. 화면 맨 가장자리(x
40/780)로 옮겼더니 이번엔 비네트가 너무 강해 RGB가 10~40대(거의 검정)로
떨어져 판정에 부적합. 러그 위쪽(y 380, 러그는 y≥420부터)이면서 가장자리보다
안쪽인 지점(x 160/660)으로 절충해서 4방 전부 가구·러그·비네트를 피하는
순수 바닥 샘플을 확보.

**결과**: 전부 통과 — R/G 1.45~1.72(기준 1.8), B/G 0.67~0.81(기준 0.55),
클리핑 전 방 0.00%(기준 0.5%), 밝기 거실의 98~127%(기준 60%). `m4-rooms.mjs`
13/13 유지 확인, 스크린샷 4장 재촬영 후 커밋.

---

## 2026-08-15 (18) — M4 스크린샷 육안 리뷰 지적 2건 수정: 과다 적색 + 방 구분 안 됨

**리뷰(1층, Claude 앱)**: M4 스크린샷 4장을 보고 두 가지 지적 — (1) 색보정 과다 적색(`GradeGrainVignetteShader.js`의 G게인 0.72가 원인으로 지목), (2) `lighting.js`가 원점 방 1개 기준 그대로라 집이 커진 뒤 침실A가 거실보다 어두워 보임. **lane-rooms를 띄우기 전에 고치라**는 명시적 지시.

**수용기준을 스크립트로 못박음**: `tools/render-check/room-tint-check.mjs`(신규) — m4-living/bedA/study/bedB 4장에서 바닥 근처를 샘플링해 (a) 6개 쌍 전부 채널 최대차 >=12, (b) 어느 방도 거실 밝기의 60% 미만 아님을 자동 판정.

**밝기 재검토 결과**: 실측해보니 (2)의 전제(침실A가 거실보다 어두움)는 **베이스라인에서부터 틀렸다** — bedA/study/bedB가 오히려 거실보다 밝거나(120~125%) 비슷했음(directional/hemisphere 라이트는 거리 감쇠가 없어서 애초에 원점-거리 문제가 아니었음). 실제로 실패하던 건 밝기가 아니라 **구분**: bedA와 bedB는 바닥색이 완전히 같아서(`0x9a6a45`) 채널차 2.7밖에 안 났음.

**튜닝 과정(비단조적이었음, 나중을 위해 기록)**:
1. 첫 샘플 좌표(화면 하단 모서리)가 비네트 감쇠 구간이라 조명을 세게 조정해도 측정치가 예측과 반대로 움직임 → 캐릭터 좌우 화면 중앙 쪽으로 샘플 위치 이동해서 해결.
2. 방마다 포인트라이트(색조만 다르게) 추가 → bedA/bedB 여전히 거의 안 갈라짐(1.4) → 두 색 다 R=255로 포화시켜서 R이 기여를 못 하고 있었음. R까지 서로 다르게 벌림.
3. 그러자 living이 bedA 또는 bedB 중 하나와 번갈아 겹침(측정치가 조정마다 요동) — living 바닥(`0x8a5a3c`)이 이미 따뜻한 갈색이라, 어느 방향으로 강하게 채색해도 결국 비슷한 warm 영역으로 수렴. → **living은 포인트라이트를 약하게(0.35) 둬서 기존 hemi/key/fill 그대로 두고, 나머지 3개 방만 강하게(4.6) 채색**해서 해결.
4. `layout.js`의 `ROOMS`를 읽어서 방 중심 좌표를 얻음(하드코딩 없음).

**최종 결과**: 6쌍 전부 통과(최소차 14.7), 밝기 전부 거실의 88~118%. `m4-rooms.mjs`를 매 조정마다 재실행해서 13/13이 계속 유지되는 것 확인(조명/색보정은 충돌·이동 로직과 무관하다는 걸 재확인).

**색보정**: `uGain` (1.25,0.72,0.85)→(1.15,0.92,0.88), `uLift` (0.06,0.02,0.08)→(0.05,0.04,0.06). G가 덜 깎여서 과다 적색 해소, 따뜻한 톤은 유지.

**스크린샷 4장 재촬영 후 커밋**: `.gitignore`에 `m4-living/bedA/study/bedB.png` 예외 추가 — 1층(Claude 앱)이 코드 실행 없이 파일만 읽고 리뷰할 수 있어야 하므로.

**커밋**: `6881db5`. `gemini/lane-rooms`는 아직 미착수 상태였어서 별도 조치 불필요.

---

## 2026-08-15 (17) — M4 집 구조 완료: 3층 운영체계로 첫 스펙 기반 구현

**새 운영 구조 등장**: 이번 작업부터 `docs/STATE.md`가 도입되고, 지시가 "Claude 앱(1층, 결정·스펙) → Claude Code CLI(2층, 구현) → Gemini(3층, 배타 소유 레인)" 3층 구조로 명시됨. `docs/spec/M4-layout.md`(Claude 앱이 작성, 14835자)가 좌표의 단일 원본 — 방 4칸(거실6×6 + 침실A5×4 + 작업실4×5 + 침실B4×4), 벽 17개, 문 3개(중심·폭·잔여조각까지 전부 숫자로 확정)를 표로 못박고 "스펙이 틀렸다고 판단되면 코드가 아니라 스펙을 먼저 고쳐라"는 규칙까지 명시.

**0단계**: 로컬에 있던 미push 커밋(`7473b22`, 스펙+STATE.md)을 먼저 push — 다른 표면이 스펙을 볼 수 있게.

**구현(전부 지시받은 순서·범위 그대로, 스펙 이탈 없음)**:
1. `world/layout.js` — ROOMS(4)/WALLS(17)/DOORS(3) 순수 데이터. D1/D2/D3 개구부 계산이 스펙 §4 표와 정확히 일치함을 손으로 검산.
2. `world/house.js` — layout.js만 읽어서 바닥(`roomId` 태그)·벽(문 있는 벽은 좌/우+상인방 3분할, 상인방은 `solid` 없이 `fadeable`만)을 기계적으로 생성. 좌표 하드코딩 0개.
3. `world/rooms/livingRoom.js` — 바닥/벽3개/걸레받이 삭제(house.js 소관으로 이관), 소품 7종을 스펙 §5.2 표 좌표로 재배치(방이 3.6→6.0m로 커지면서 벽 안쪽면 ±1.74→±2.94).
4. `world/exterior.js` — 지면 감쇠 반경 4→11(집 반경이 2.5→9.9m로 커져서, 정점간격보다 큰 평탄반경 유지 규칙에 따라), 집 안에 박히는 나무 3그루 삭제(9그루 남음).
5. `main.js` — `createHouse()` 연결, 조립 순서를 스펙 §5.3대로, 스폰 `[0,0,1.2]→[0,0,1.5]`.
6. `tools/layout-check.mjs`(신규) — 순수 node, 브라우저 불필요. 7개 검사(축정렬/문폭/개구부포함/방비중첩/연결성/스폰여유/외곽선폐합) 전부 구현 후 **일부러 문폭을 깨서 검사기가 실제로 잡아내는지 확인**(D1 width 1.3→0.3 → FAIL 확인 → 원복 → 다시 전부 PASS).
7. `tools/render-check/m4-rooms.mjs`(신규) — 헤드리스 Chrome, 실제 WASD 키입력 시뮬레이션으로 방 4개 중앙 도달 + 문 가장자리(개구부 A측 +0.25m 안쪽, 반지름 대비 여유 0.03m) 통과까지 검증.

**과정에서 발견한 진짜 사고 2건**:
- **또 index.lock/HEAD.lock 충돌**: layout.js 커밋 직전 `index.lock`(16:52, 당시 18:17 — 85분 전) 발견, `git.exe` 프로세스 없음 확인 후 안전하게 제거. 곧이어 같은 타임스탬프의 `HEAD.lock`도 발견(같은 죽은 프로세스의 잔여물) — 제거 후 커밋 정상 진행. 새 데이터 유실은 없었음(`git add`는 이미 성공한 상태였음).
- **m4-rooms.mjs 첫 실행에서 13개 중 8개 연쇄 실패**: "bedA→living" 구간에서 (-0.07,-3.05)에 멈추고 이후 모든 구간이 그 자리에서 이어받아 똑같이 실패. 원인 추적 결과 **게임 버그가 아니라 테스트 웨이포인트 설계 문제** — 거실 중앙(0,0)이 D1 문의 반지름 감안 안전폭 X[-0.93,-0.07] 밖(0.07m 초과)이라, 문 안에서 곧장 중앙을 노리면 그리디 워커가 문틀 오른쪽 끝에 정확히 접선으로 붙어버림. 모든 "방→거실" 복귀를 "문 통과 직후 안전 경유지 → 진짜 중앙" 2단계 경로로 바꿔서 해결, 13/13 전부 통과.

**수용기준 9개(스펙 §7) 결과**:
| # | 기준 | 결과 |
|---|---|---|
| 1 | layout.js 숫자가 스펙 §2·§3·§4와 완전히 일치 | ✅ (D1/D2/D3 개구부 계산 손검산 일치) |
| 2 | house.js가 좌표 하드코딩 안 함 | ✅ |
| 3 | layout-check.mjs 7항목 전부 통과 | ✅ (부정테스트로 검사기 자체도 검증) |
| 4 | m4-rooms.mjs 방4개 도달+문가장자리 통과 | ✅ 13/13 (1차 8실패 → 원인 규명 후 수정) |
| 5 | check-imports.mjs + node --check 전체 통과 | ✅ (40개 파일) |
| 6 | 지면이 방 바닥을 안 뚫음(스크린샷 4장 육안) | ✅ |
| 7 | 나무가 집 안에 없음 | ✅ (3그루 삭제, 9그루 남음, 프로그램적으로 카운트 확인) |
| 8 | 콜라이더 개수 로그(예상 40~50, 100 초과 시 문제) | ⚠️ 실측 24개 — 스펙 추정(43)보다 적지만, 상인방 9개가 설계대로 non-solid라 그런 것(스펙이 "벽조각≈23"에 상인방까지 섞어 계산한 것으로 추정). 100 초과 아니므로 문제 없음, 정직하게 차이 기록 |
| 9 | 3개 문서 갱신 | ✅ 이 항목 |

**M4c(방 3개 드레싱) 레인 분기**: `docs/handoff/gemini-lane-rooms.md` 작성(작업공간 분리 섹션 처음부터 포함, 방별 내부 치수·문 회피구역을 스펙에서 미리 뽑아서 제공) → `gemini/lane-rooms` 브랜치 생성+push.

**커밋 흐름**: `7473b22`(push만) → `d84b0cd`(layout.js) → `82728e1`(house.js) → `a60c694`(livingRoom.js) → `11ed0e2`(exterior.js) → `ec74891`(main.js) → `08c9c33`(layout-check.mjs) → `a2d9073`(m4-rooms.mjs) → `4fa629e`(collider-count.mjs) → `964a265`(gemini-lane-rooms.md).

**M4 상태: 구조 완료.** 남은 건 방 3개 드레싱(레인 대기 중), 벽 페이드(이제 착수 가능), 걷는 캐릭터·BGM/SFX(레인 대기 중).

---

## 2026-08-15 (16) — CRLF 노이즈 .gitattributes로 고정 + 공유 디렉토리 충돌 재발 확인

**사용자 리포트**: `git status`에 21개 파일이 modified로 뜨는데 `git diff -w`로는 실제 변경 0줄(순수 CRLF/LF 노이즈), 그리고 `.git/index.lock`이 방금 생성돼 있다고 알려줌 — 지우기 전에 다른 프로세스가 이 폴더를 쓰고 있는지 확인부터 하라고 명시적으로 경고.

**조사**: `git.exe` 프로세스는 없었지만 **Antigravity 프로세스 6개가 실행 중**이었음. 사용자에게 확인 요청 → "아니요, 다 끝났거나 다른 레포에서 돎"이라는 답변을 받은 직후, **바로 그 순간** `handoff-2026-08-15.md`·`dev-log.md`·`livingRoom.js`·`audio.js`·`gate.js`·`main.js` 등 여러 파일이 동시에 옛날 버전으로 되돌아가는 알림이 연달아 발생. `git branch --show-current`로 확인해보니 **HEAD가 `gemini/lane-e-assets-audio`의 예전 커밋(`11c6e74`)으로 바뀌어 있었다** — 사용자 답변과 반대로, 뭔가(Antigravity로 추정)가 실제로 이 순간 그 브랜치를 체크아웃하고 있었다.

**피해 확인**: `main`으로 즉시 checkout해서 확인한 결과 **커밋 손실은 없었다** — `git log`가 마지막 커밋(`983d69c`)까지 정상, `dev-log.md`도 entry 15까지 전부 있었음. 브랜치는 서로의 히스토리를 지우지 않으므로, 이번엔 HEAD/워킹트리만 잠깐 다른 브랜치로 끌려간 것뿐 실유실은 없었음. `index.lock`도 그 사이 자연히 사라짐(체크아웃 완료).

**`.gitattributes` 추가**: `* text=auto eol=lf` + 바이너리(png/jpg/glb/mp3/wav/ico) 명시. `core.autocrlf=true`(사용자 전역 설정)가 `.gitattributes` 없이 체크아웃마다 LF→CRLF로 바꿔치기해서 생긴 문제였음. `git add --renormalize .`로 재정규화해봤는데 **바뀔 파일이 0개** — 즉 repo에 저장된 실제 내용은 이미 LF로 일관됐고, 노이즈는 순전히 워킹 디렉토리/체크아웃 시점 현상이었다는 게 확인됨. 이제 `eol=lf`가 앞으로 이 파일들은 체크아웃 OS 설정과 무관하게 항상 LF로 고정.

**결론**: `handoff-2026-08-15.md`의 오케스트레이션 섹션이 문서화한 공유 디렉토리 충돌이 **레인 브랜치를 도입하고 지시서에 작업공간 분리를 넣은 뒤에도 재발**했다. Antigravity 쪽에서 무엇이 이 체크아웃을 트리거했는지는 이 세션에서 확인 불가 — 사용자가 Antigravity 로그/백그라운드 태스크를 직접 확인해야 원인을 알 수 있음.

**커밋**: `4637b9b`, push 완료.

---

## 2026-08-15 (15) — 남은 작업 정리 + Gemini 레인 2개 추가 분기

**현황 정리**: M0~M2 완료, M3 절반(에셋+오디오 파이프라인 완성, 정적 소품 1개 시연). 남은 것: M4(집 4개 방, 임계경로), 벽 페이드(M4 이후), 걷는 캐릭터(리깅 에셋), 소품 추가, BGM/SFX 실제 에셋, 룩 튜닝, M5 배포(M4 게이트).

**병렬화 분석**: A(이동/충돌)·B(카메라)가 이미 끝나서 임계경로가 M4 하나로 좁혀짐. 걷는 캐릭터(`player/character.js`만 건드림)와 BGM/SFX 실제 에셋(`audio/`+에셋 소싱)은 M4와 파일이 전혀 안 겹치는 완전 독립 작업이라 병렬 분기 대상으로 선정. 벽 페이드는 M4의 문 있는 벽 구조가 먼저 나와야 실제 테스트가 되므로 M4 이후로 미룸. 소품 추가도 방 배치 좌표가 M4로 다 바뀌므로 M4 이후가 합리적.

**분기**: `docs/handoff/gemini-lane-character.md`, `docs/handoff/gemini-lane-audio-content.md` 신규 작성 — **이번엔 처음부터 "-1. 작업 공간 분리" 섹션 포함**(지난 세션 충돌의 교훈, 사후 추가가 아니라 시작부터 반영). `gemini/lane-character`, `gemini/lane-audio-content` 브랜치 생성해 push.

- **캐릭터 레인**: `cubone.glb`가 애니메이션/스킨 0개라 못 썼던 실수를 지시서에 명시하고, GLB 사전검사 코드까지 넣어줌(animations/skins > 0 확인). 리깅 에셋 확보 실패 시 절차적 걷기 애니메이션을 정식 대안으로 인정. `createPlayer()`의 `{root, radius}` 반환 계약(controller.js/physics가 의존)을 명시적으로 동결.
- **오디오 콘텐츠 레인**: `test.mp3`(4.1MB)가 예산(BGM ≤1.5MB) 초과 사례임을 명시. `footsteps.js`는 `core/loop.js`+`player/input.js` 읽기 전용만으로 자체 등록 가능하게 설계해서 `main.js`/`controller.js` 안 건드리고도 발소리 기능을 완성할 수 있게 함(실제 연결은 통합자 몫).

**Claude 쪽**: `main`에 남아 M4(집 4개 방, 배포 게이트 걸린 임계경로) 착수.

---

## 2026-08-15 (15) — Gemini Lane: 걷는 캐릭터 (리깅 + 애니메이션) 구현 및 검증 완료 (원문, Lane Character 작성)

**캐릭터 GLB 에셋 확보 및 사전검사**:
- Three.js 공식 오픈소스 `RobotExpressive.glb` (Tom de Smedt / three.js contributors, CC0 / MIT) 선택 후 `game/assets/glb/character-robot.glb`로 저장.
- GLB 헤더 사전검사로 animations: 14, skins: 2, clip names: ['Walking', 'Idle', 'Standing', 'Running', ...] 확보 확인 (animations/skins > 0 검증 완료).
- `ATTRIBUTION.md` 생성 및 출처 정보 기록.

**`character.js` 모듈 재작성**:
- `createPlayer(scene, spawn)` 반환 계약 `{ root, radius: PLAYER.radius }` (root: THREE.Group, radius: number) 100% 준수.
- `PLAYER.height`(1.7m) 스케일 맞춤 (`fitHeight`), 바닥 접지 (`dropToFloor`), 조명 톤 정렬 (`restyle` KEEP 모드 적용).
- `THREE.AnimationMixer` 연결 및 대소문자/부분일치 키워드 탐색(`findClip`) 기반 `walk`, `idle` 액션 자동 바인딩.
- `core/loop.js`의 `onFrame` (`Phase.SIM`)에서 `player/input.js`의 `getMoveAxis()` (WASD) 상태에 따라 idle ↔ walk 애니메이션 모션 크로스페이드 전환 처리 (`controller.js` 미수정).

**검증 및 가이드라인 준수**:
- `game/_scratch/preview_char.html` / `preview_char.js` 스크래치 테스트 및 `tools/render-check/shot.mjs` 헤드리스 렌더링 스크린샷 캡처 완료.
- `node --check` 및 `node tools/check-imports.mjs` 통과 (38개 파일 대소문자/import 100% 무결성).
- off-limits 파일(`main.js`, `index.html`, `controller.js`, `world/*`, `camera/*`, `physics/*`, `audio/*`) 수정을 일체 하지 않음을 `git diff --stat origin/main...HEAD`로 최종 확인.
- 격리된 작업 공간 `C:\Users\hcyang\gemini-workspace\lane-character` 내에서만 안전하게 작업 수행.

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
