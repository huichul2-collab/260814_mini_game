# Gemini 작업 지시서 — Lane E: 에셋 파이프라인 + 오디오

> 이 문서는 이 프로젝트의 다른 대화 맥락을 전혀 모르는 상태에서 읽는다는 전제로 쓰였다.
> 필요한 배경은 전부 이 안에 있다. 모르는 걸 추측하지 말고, 애매하면 범위를 좁혀서 처리할 것.

## 0. 이 프로젝트가 뭔가

취미로 만드는 3D 방/집 탐험 게임. Three.js(r185) + 순수 ES 모듈, **빌드 단계 없음, npm 런타임 의존성 없음**.
`game/vendor/`에 three.js와 필요한 애드온을 전부 오프라인으로 미리 받아뒀다. `GLTFLoader`, `BufferGeometryUtils`, `SkeletonUtils`는 이미 `game/vendor/jsm/`에 있다 — **새로 vendoring할 필요 없음**. `<script type="importmap">`이 `three` / `three/addons/`를 `vendor/`로 매핑해준다.

현재 상태: 방 1개, 소품 몇 개(손코딩 프리미티브), flat 셰이딩. 외부 3D 에셋(GLB)을 불러와 게임에 넣는 파이프라인이 아직 없다. 오디오도 전혀 없다.

## 1. 이미 있는 GLB 에셋 — 네가 처리해야 할 실제 리스크

`game/glb/Cubone by Tipatat Chennavasin - cc7gCdKaQYU.glb` 파일이 있다. **이 파일명은 실전 배포 시 문제가 되는 실제 사례다**: 공백, 대문자, 하이픈이 섞여 있다. Windows에서는 파일시스템이 대소문자를 구분 안 해서 문제없이 열리지만, 최종 배포처(itch.io, Linux 기반)에서는 **404가 난다.**

이 프로젝트의 규칙: **에셋은 반드시 소문자-케밥(kebab-case) ASCII 파일명으로.**

**네가 할 일**: `game/assets/glb/` 디렉터리를 새로 만들고, 그 파일을 `game/assets/glb/cubone.glb`로 옮겨라(기존 `game/glb/` 폴더는 삭제). 앞으로 추가할 오디오/텍스처도 `game/assets/audio/`, `game/assets/tex/`에 같은 규칙으로 넣어라.

이 GLB를 이미 파싱해본 결과: **애니메이션 0개, 스킨 0개(정적 메시), 압축 확장자 없음(무압축), `TEXCOORD_0` 있음(UV 있음, 텍스처 적용 가능), 재질명이 `mat11`/`mat13`/`mat18`처럼 의미 없는 자동생성 이름.** → 걷는 캐릭터로는 못 쓰고, 정적 소품이나 텍스처 실습용으로만 쓸 것. 재질명 기반 매핑이 안 먹으니 아래 restyle.js의 색상 폴백 로직이 실제로 중요하다.

## 2. 네 작업 범위 (Lane E — "에셋/오디오")

**새로 만들 파일**
- `game/src/assets/loaders.js`
- `game/src/assets/restyle.js`
- `game/src/assets/normalize.js`
- `game/src/audio/audio.js`
- `game/src/audio/gate.js`

**파일 이동**
- `game/glb/Cubone by...glb` → `game/assets/glb/cubone.glb` (기존 `game/glb/` 폴더 삭제)

**절대 건드리면 안 되는 파일**:
- `game/main.js`, `game/index.html`
- `game/src/core/*` (단, `context.js`가 export하는 `camera`/`scene`/`renderer`를 **import해서 읽는 건** 허용 — 그 파일 자체를 수정하지만 말 것)
- `game/src/render/materials.js`, `game/src/render/meshFactory.js`
- `game/src/world/*`
- `game/src/render/post/*` (다른 레인 소유)

네 코드는 `main.js`에 아직 연결되지 않은 **독립 모듈**이어야 한다. 함수를 어떻게 호출할지는 통합할 때 결정한다.

## 3. 구체적으로 만들 것

### 3.1 `game/src/assets/loaders.js` — 공유 LoadingManager

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const manager = new THREE.LoadingManager();
// manager.onProgress / onLoad / onError 는 export해서 다른 모듈이 구독 가능하게

const gltfLoader = new GLTFLoader(manager);
export const texLoader = new THREE.TextureLoader(manager);
export const audioLoader = new THREE.AudioLoader(manager);

export function loadGLTF(url) { /* Promise로 감싸기 */ }
export function loadTexture(url, { colorSpace = THREE.SRGBColorSpace } = {}) {
  // ⚠️ 아래 3.2 sRGB 함정 참고 — 기본값을 SRGBColorSpace로 둘 것
}
export { manager };
```

**⚠️ sRGB 함정 (실제로 만나게 될 버그)**: `THREE.TextureLoader`로 직접 불러온 **색상(컬러/알베도) 텍스처**는 `texture.colorSpace`를 손으로 `THREE.SRGBColorSpace`로 지정해야 한다. 안 하면 색이 탁하고 물빠져 보인다. `GLTFLoader`는 GLTF 안에 내장된 베이스컬러 텍스처에 한해 이 처리를 자동으로 해준다 — 즉 **"GLTF는 잘 나오는데 내가 따로 붙인 PNG만 이상하다"** 는 증상이 나오면 이거다. 반대로 노멀맵/러프니스맵/메탈니스맵은 **선형(linear)이라 `colorSpace`를 건드리면 안 된다.** `loadTexture()`의 두 번째 인자로 용도를 구분해서 호출하는 쪽이 명시하게 만들어라.

### 3.2 `game/src/assets/restyle.js` — 재질 3가지 모드 + 진단 도구

```js
export const Restyle = { KEEP: 'keep', TINT: 'tint', REPLACE: 'replace' };

export function restyle(root, { mode, paletteMap = {}, palette = [] }) {
  // root.traverse()로 모든 Mesh 순회. mesh.material이 배열일 수 있음(Array.isArray 체크 필수 —
  // 멀티 머티리얼 GLTF가 흔하다)
}

export function logMaterials(root) {
  // 각 재질의 name, type, color, map 유무, uv 속성 유무를 console.log로 출력
  // — 새 GLB를 받을 때마다 제일 먼저 이걸 돌려서 뭐가 들어있는지 확인하는 용도
}
```

**세 모드의 정확한 의미**:
- **KEEP**: 구워진 텍스처(`map`)는 유지하되, `MeshStandardMaterial`이면 **`MeshLambertMaterial`로 강등**하고 `map`/`color`/`transparent`/`alphaTest`/`side`/`vertexColors`를 옮겨 담아라. 이 프로젝트는 이 게임의 조명을 전부 Lambert 기준으로 맞춰뒀다(1.의 `game/src/render/materials.js`, 너는 안 건드리지만 알아둬야 함). PBR(Standard/Physical) 재질을 그대로 두면 밝기·대비가 어긋나서 불러온 모델만 "붙여넣은 것처럼" 튄다.
- **TINT**: KEEP과 동일하되 `material.color`를 팔레트 색으로 덮어써라. `color`는 셰이더에서 `map`에 곱해지는 값이라, 텍스처의 명암 디테일은 유지되면서 색조만 바뀐다. **버텍스 컬러로 색을 넣은 에셋**(무료 로우폴리 팩에 흔함, `map` 없이 `geometry.attributes.color`만 있는 경우)에 특히 적합한 모드다.
- **REPLACE**: `map` 등 텍스처 전부 버리고 단색 재질로 교체. 색 결정은 이 순서로 폴백해라:
  1. `paletteMap[원본재질이름]`에 명시적 매핑이 있으면 그거
  2. 없으면 원본 `material.color`와 HSL 거리로 가장 가까운 팔레트 색
  3. 그것도 안 되면(색 정보 자체가 없으면) **재질 이름을 해시해서** 팔레트에서 결정적으로 하나 고르기 — **`Math.random()`을 쓰지 마라.** 난수를 쓰면 새로고침마다 모델 색이 바뀌어서 버그처럼 보인다.

**1.에서 이미 확인했듯, `mat11`/`mat13` 같은 무의미한 이름이 실제로 나온다** — 즉 폴백 ②③이 장식이 아니라 실제로 타는 경로다. `paletteMap`에만 의존하지 말고 ②③을 꼭 제대로 구현해라.

### 3.3 `game/src/assets/normalize.js`

```js
export function fitHeight(root, targetMeters) { /* Box3.setFromObject → 균일 스케일 */ }
export function fitSize(root, targetMeters) { /* 가장 긴 변 기준 */ }
export function recenterXZ(root) { /* 중심을 원점으로 */ }
export function dropToFloor(root) { /* y-min을 0으로 */ }
```
무료 로우폴리 에셋은 단위(cm/m)와 정면 방향이 제각각이다. 이게 없으면 에셋마다 매직넘버를 손으로 계속 맞춰야 한다.

**주의**: `Box3.setFromObject`를 스킨드 메시(SkinnedMesh, 애니메이션 캐릭터)에 쓰면 bind-pose 기준의 엉뚱하게 큰 범위가 나올 수 있다. 지금 있는 GLB는 스킨이 없으니 상관없지만, 이 함수를 쓰는 쪽에 주석으로 이 사실을 남겨둬라.

### 3.4 `game/src/audio/audio.js`

```js
import * as THREE from 'three';
import { camera } from '../core/context.js'; // 읽기 전용 import는 허용

export const listener = new THREE.AudioListener();
camera.add(listener); // 반드시 camera의 자식으로 — scene에 직접 추가하지 말 것

export function playBGM(url, { volume = 0.5, loop = true } = {}) { /* ... */ }

export function createSfxPool(url, size = 4) {
  // Audio 객체 하나는 동시에 1개 인스턴스만 재생 가능 — play() 중에 다시 play()하면 처음부터 리셋된다.
  // 발소리처럼 빠르게 반복되는 소리는 3~4개 라운드로빈 풀이 필요하다.
}

export function createPositionalSfx(url, mesh, opts = {}) {
  // PositionalAudio의 기본값(refDistance=1, inverse 모델)은 방 스케일(3~6m)에 안 맞아서
  // 문간에서 소리가 거의 안 들린다. 반드시 이렇게 덮어써라:
  //   .setDistanceModel('linear')
  //   .setRefDistance(1.5)
  //   .setMaxDistance(10)
  //   .setRolloffFactor(1)
}
```

- 오디오 포맷은 `.mp3` 하나만 지원하면 된다(브라우저 호환성 문제없음). 지금 프로젝트에 실제 오디오 파일은 없다 — **오디오 에셋을 직접 구해서 넣는 건 선택사항이다.** 필수는 위 함수들이 문법적으로 맞고, 파일이 없을 때도 에러 없이 우아하게 넘어가는 것.
- 탭이 백그라운드로 가면 `AudioContext`를 suspend, 돌아오면 resume하는 로직도 여기 넣어라(`document.visibilitychange`). 배경 탭에서 BGM이 계속 나오면 사용자가 링크를 닫아버리는 1순위 이유다.

### 3.5 `game/src/audio/gate.js` — 오토플레이 정책 우회

브라우저는 **사용자 제스처 전에는 `AudioContext`를 항상 suspended 상태로 둔다.** 페이지 로드와 동시에 BGM을 트는 건 불가능하다.

`index.html`에는 이미 `id="loading"` 오버레이 div가 있다(너는 `index.html`을 못 건드린다 — 대신 **JS로 그 엘리먼트 내부를 DOM 조작**해서 버튼을 넣어라):

```js
export function initAudioGate(loadingEl, onStart) {
  // 1. loadingEl 안에 "시작하기" 버튼을 DOM으로 만들어 추가
  // 2. 버튼 클릭 시:
  //    - THREE.AudioContext.getContext() 로 컨텍스트 가져와서 suspended면 await resume()
  //    - onStart() 콜백 호출 (BGM 재생은 이 콜백 안에서, 통합 시점에 연결)
  //    - loadingEl을 페이드아웃
}
```
**버퍼는 이 클릭 핸들러 호출 전에 이미 디코드가 끝나 있어야 한다.** iOS Safari는 제스처와 **같은 태스크** 안에서 `play()`가 호출돼야 재생을 허용한다 — 미리 로딩 오버레이가 떠 있는 동안 오디오를 디코드해두고, 클릭 핸들러에서는 `play()`만 부르는 구조가 그래서 필요하다. (오버레이를 먼저 닫고 전역 첫 클릭을 나중에 후킹하는 방식은 데스크톱 Chrome에서만 되고 Safari/iframe에서 조용히 실패한다 — 하지 마라.)

## 4. 검증 방법

헤드리스 Chrome 스크린샷 도구가 이미 있다(별도 다운로드 없음, 로컬 Chrome/Edge 그대로 사용):
```
cd tools/render-check
node shot.mjs "<game 폴더 절대경로>" "./out.png" 2000
```
콘솔 에러/HTTP 4xx/5xx까지 같이 출력된다. GLB 경로를 잘못 옮기면 여기서 404로 바로 드러난다.

`main.js`를 고치지 않고 네 파이프라인을 직접 눈으로 확인하고 싶으면, `game/_scratch/preview.html` + `preview.js` 같은 임시 파일을 만들어서 `loadGLTF()` → `restyle()` 세 모드를 각각 렌더링해 스크린샷으로 비교해봐도 된다. 커밋에 남겨도 되고 마지막에 지워도 된다.

`logMaterials()`는 Node에서 GLTFLoader를 직접 돌리긴 어렵다(브라우저 API 의존) — 위 임시 preview 페이지의 콘솔 출력으로 확인해라. 스크린샷 도구가 콘솔 로그도 캡처해서 보여준다.

커밋 전에:
```
node --check game/src/assets/loaders.js   # 새로 만든 파일마다
node tools/check-imports.mjs "<game 폴더 절대경로>"
```

## 5. 완료 기준

- [ ] `game/assets/glb/cubone.glb`로 이동 완료, `game/glb/` 삭제, 파일명에 공백/대문자 없음
- [ ] `loaders.js`: 공유 LoadingManager + GLTF/텍스처/오디오 로더, 텍스처 sRGB 처리
- [ ] `restyle.js`: KEEP/TINT/REPLACE 세 모드 + `logMaterials()`, 색상 해시 폴백에 `Math.random()` 안 씀
- [ ] `normalize.js`: fitHeight/fitSize/recenterXZ/dropToFloor
- [ ] `audio.js`: listener가 camera의 자식, SFX 풀링, PositionalAudio 기본값 덮어씀, 탭 전환 suspend/resume
- [ ] `gate.js`: 클릭 전 디코드 완료 + 클릭 시 resume→play, index.html 파일 자체는 안 건드림
- [ ] `node --check`, `check-imports.mjs` 통과
- [ ] "절대 건드리면 안 되는 파일"을 안 건드렸는지 `git diff --stat main...HEAD`로 확인
- [ ] `dev-log.md` 맨 위에 항목 하나 추가 (무엇을 했는지, cubone.glb 사전검사에서 뭘 확인했는지 등)

## 6. Git 작업 방식

이 브랜치(`gemini/lane-e-assets-audio`)에서만 커밋해라. `main`으로 merge하거나 강제 push하지 마라 — 작업이 끝나면 그대로 두면 리뷰 후 병합된다. 커밋 메시지는 뭘 했는지 한두 줄로.
