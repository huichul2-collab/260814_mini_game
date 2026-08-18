// 에셋 정적 검증기 — 오디오/GLB가 "진짜"인지, ATTRIBUTION.md가 assets/와
// 1:1로 맞는지를 사람이 듣지 않고도 1차로 걸러낸다. bgm-main.mp3/sfx-footstep.mp3/
// sfx-click.mp3가 전부 Gemini가 합성한 가짜(사인 버스트)였는데 ATTRIBUTION.md에는
// 존재하지 않는 CC0 출처가 적혀 있었던 사건 이후 추가.
//
// 판정으로 exit 1 하지 않는다 — 전부 경고 출력만 하고 사람이 최종 판단한다.
// (오디오 프레임 개수·GLB 청크 파싱 둘 다 근사/휴리스틱이라 오탐 가능성이 있음)
//
// 사용법: node asset-check.mjs [game 폴더 절대경로] [저장소 루트 절대경로]
//   둘 다 생략하면 이 스크립트 위치(tools/) 기준으로 저장소 루트를 잡는다 —
//   cwd에 의존하지 않는다(tools/ 안에서 실행하든 어디서 실행하든 동일).
//   game 폴더만 명시하면 저장소 루트는 그 부모로 가정(ATTRIBUTION.md 위치).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');
const defaultGameDir = path.join(defaultRepoRoot, 'game');

const gameDir = path.resolve(process.argv[2] || defaultGameDir);
const repoRoot = path.resolve(process.argv[3] || (process.argv[2] ? path.join(gameDir, '..') : defaultRepoRoot));

let warnings = 0;
function warn(msg) { warnings++; console.log(`WARN ${msg}`); }
function info(msg) { console.log(`INFO ${msg}`); }
function ok(msg) { console.log(`OK   ${msg}`); }

function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

// ---------------------------------------------------------------------------
// 오디오: ffprobe 메타 + volumedetect + 대역 평탄도(스펙트럼)
// ---------------------------------------------------------------------------
function ffprobeInfo(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries',
    'format=duration,bit_rate:stream=channels,sample_rate,codec_name',
    '-of', 'json', file,
  ], { encoding: 'utf8' });
  const j = JSON.parse(out);
  const stream = (j.streams || [])[0] || {};
  return {
    duration: parseFloat(j.format?.duration || '0'),
    bitRate: parseInt(j.format?.bit_rate || '0', 10),
    channels: stream.channels,
    sampleRate: parseInt(stream.sample_rate || '0', 10),
    codec: stream.codec_name,
  };
}

function runFfmpegStderr(args) {
  // volumedetect는 stderr(정보 로그)에 결과를 찍고 exit 0으로 끝난다.
  // execFileSync는 성공 시 stderr를 돌려줄 방법이 없어서(반환값=stdout,
  // 에러일 때만 e.stderr) spawnSync를 써야 성공/실패 둘 다에서 stderr를 읽는다.
  const res = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  return res.stderr || '';
}

function decodePCM(file) {
  const buf = execFileSync('ffmpeg', [
    '-v', 'error', '-i', file,
    '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '1', '-ar', '44100', '-',
  ], { maxBuffer: 1024 * 1024 * 128 });
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
}

function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

// 반복형 radix-2 FFT (in-place)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWr = 1, curWi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * curWr - im[i + k + len / 2] * curWi;
        const vi = re[i + k + len / 2] * curWi + im[i + k + len / 2] * curWr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nWr = curWr * wr - curWi * wi;
        const nWi = curWr * wi + curWi * wr;
        curWr = nWr; curWi = nWi;
      }
    }
  }
}

// 로그 스케일 대역(32개, 20Hz~Nyquist*0.95)으로 파워를 묶은 뒤 그 위에서
// spectral flatness(기하평균/산술평균)를 구한다. 원시 FFT 빈 단위로 직접
// 계산하면 무음에 가까운 고주파 빈이 수천 개씩 끼어들어(수치 바닥이
// 10^-9 근처) 진짜 광대역음까지 거의 0으로 뭉개진다 — 대역으로 묶고
// 피크 대비 -40dB를 바닥으로 클리핑해야 "사인 버스트 vs 실제 녹음"이
// 안정적으로 갈린다. (자체 구현이라 이 스크립트 밖의 다른 분석 도구가
// 낸 절대값과는 스케일이 다를 수 있음 — 상대 비교/문턱값 용도로만 쓸 것.)
function spectralFlatness(file, { sr = 44100, nBands = 32, floorDb = 40 } = {}) {
  const pcm = decodePCM(file);
  if (pcm.length < 64) return null; // 너무 짧아 분석 불가
  const N = Math.min(nextPow2(pcm.length), 16384);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const usable = Math.min(pcm.length, N);
  for (let i = 0; i < usable; i++) {
    const w = usable > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (usable - 1)) : 1;
    re[i] = pcm[i] * w;
  }
  fft(re, im);
  const half = N / 2;
  const binHz = sr / N;
  const fMin = 20, fMax = (sr / 2) * 0.95;
  const edges = [];
  for (let b = 0; b <= nBands; b++) edges.push(fMin * (fMax / fMin) ** (b / nBands));
  const bandPower = new Array(nBands).fill(0);
  const bandCount = new Array(nBands).fill(0);
  for (let k = 1; k < half; k++) {
    const f = k * binHz;
    if (f < fMin || f > fMax) continue;
    let b = 0;
    while (b < nBands - 1 && f >= edges[b + 1]) b++;
    bandPower[b] += re[k] * re[k] + im[k] * im[k];
    bandCount[b]++;
  }
  const bands = [];
  for (let b = 0; b < nBands; b++) if (bandCount[b] > 0) bands.push(bandPower[b] / bandCount[b]);
  if (bands.length < 4) return null;
  const maxP = Math.max(...bands);
  if (maxP <= 0) return 0;
  const floor = maxP * 10 ** (-floorDb / 10);
  const clipped = bands.map((p) => Math.max(p, floor));
  let sumLog = 0, sumLin = 0;
  for (const p of clipped) { sumLog += Math.log(p); sumLin += p; }
  const gm = Math.exp(sumLog / clipped.length);
  const am = sumLin / clipped.length;
  return am > 0 ? gm / am : 0;
}

const FLATNESS_WARN_THRESHOLD = 0.02;

function checkAudioFile(file) {
  const rel = path.relative(repoRoot, file);
  const size = fs.statSync(file).size;
  let meta;
  try {
    meta = ffprobeInfo(file);
  } catch (e) {
    warn(`${rel}: ffprobe 실패 — ${e.message.split('\n')[0]}`);
    return;
  }
  info(`${rel}: ${meta.duration.toFixed(2)}s, ${Math.round(meta.bitRate / 1000)}kbps, ${meta.channels}ch, ${meta.sampleRate}Hz, ${meta.codec}, ${fmtBytes(size)}`);

  const volOut = runFfmpegStderr(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const meanMatch = volOut.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
  const maxMatch = volOut.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
  if (meanMatch && maxMatch) {
    info(`${rel}: mean=${meanMatch[1]}dB max=${maxMatch[1]}dB`);
    if (parseFloat(maxMatch[1]) < -40) warn(`${rel}: max_volume ${maxMatch[1]}dB — 사실상 무음일 수 있음`);
  } else {
    warn(`${rel}: volumedetect 출력 파싱 실패`);
  }

  let flat = null;
  try {
    flat = spectralFlatness(file);
  } catch (e) {
    warn(`${rel}: 스펙트럼 분석 실패 — ${e.message.split('\n')[0]}`);
  }
  if (flat !== null) {
    info(`${rel}: 대역 평탄도(자체 지표)=${flat.toFixed(4)}`);
    if (flat < FLATNESS_WARN_THRESHOLD) {
      warn(`${rel}: 평탄도 ${flat.toFixed(4)} < ${FLATNESS_WARN_THRESHOLD} — 협대역/합성음(사인파 등) 의심, 실제 녹음인지 사람이 들어서 확인할 것`);
    }
  }

  const encoderMatch = volOut.match(/encoder\s*:\s*([^\n\r]+)/);
  if (encoderMatch) info(`${rel}: encoder 태그="${encoderMatch[1].trim()}"`);
}

// ---------------------------------------------------------------------------
// GLB: 애니메이션/스킨 개수, TEXCOORD 유무, 크기
// ---------------------------------------------------------------------------
function inspectGLB(file) {
  const buf = fs.readFileSync(file);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error('glTF magic 불일치 — 손상된 GLB');
  const version = buf.readUInt32LE(4);
  const totalLength = buf.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let binLength = 0;
  while (offset < totalLength && offset < buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) { // 'JSON'
      json = JSON.parse(chunkData.toString('utf8'));
    } else if (chunkType === 0x004e4942) { // 'BIN\0'
      binLength = chunkData.length;
    }
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error('JSON 청크를 못 찾음');
  const animations = (json.animations || []).length;
  const skins = (json.skins || []).length;
  let hasTexcoord = false;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (Object.keys(prim.attributes || {}).some((k) => k.startsWith('TEXCOORD'))) hasTexcoord = true;
    }
  }
  return { version, animations, skins, hasTexcoord, binLength };
}

function checkGLBFile(file) {
  const rel = path.relative(repoRoot, file);
  const size = fs.statSync(file).size;
  try {
    const g = inspectGLB(file);
    info(`${rel}: glTF v${g.version}, 애니메이션 ${g.animations}개, 스킨 ${g.skins}개, TEXCOORD ${g.hasTexcoord ? '있음' : '없음'}, BIN청크 ${fmtBytes(g.binLength)}, 파일 ${fmtBytes(size)}`);
    if (g.animations === 0) warn(`${rel}: 애니메이션 0개 — 정적 메시(캐릭터로 쓴다면 확인 필요)`);
    if (!g.hasTexcoord) warn(`${rel}: TEXCOORD 없음 — 텍스처 매핑 불가능한 지오메트리일 수 있음`);
  } catch (e) {
    warn(`${rel}: GLB 파싱 실패 — ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// assets/ 안에 허용 확장자 외 파일 — 엉뚱한 파일이 섞여 들어오는 걸 잡는다.
// (Citrix .ica 원격접속 설정 파일이 game/assets/audio/에 섞여 들어온 사고
// 이후 추가 — .gitignore로 커밋은 막지만, 그전에 애초에 왜 이 폴더에
// 있는지를 사람이 알아채도록 여기서도 경고한다.)
// ---------------------------------------------------------------------------
const ALLOWED_ASSET_EXTS = new Set(['.mp3', '.ogg', '.glb', '.png', '.jpg']);

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function checkForeignFiles(assetsDir) {
  if (!fs.existsSync(assetsDir)) return;
  const files = walkFiles(assetsDir);
  const foreign = files.filter((f) => !ALLOWED_ASSET_EXTS.has(path.extname(f).toLowerCase()));
  for (const f of foreign) {
    warn(`${path.relative(repoRoot, f)}: 허용 확장자(${[...ALLOWED_ASSET_EXTS].join(' ')}) 외 파일 — assets/에 있을 이유가 있는지 확인할 것`);
  }
  if (foreign.length === 0) ok(`assets/ 안 파일 ${files.length}개 전부 허용 확장자`);
}

// ---------------------------------------------------------------------------
// ATTRIBUTION.md ↔ assets/ 1:1 대응
// ---------------------------------------------------------------------------
function checkAttribution(assetFiles) {
  const attrPath = path.join(repoRoot, 'ATTRIBUTION.md');
  if (!fs.existsSync(attrPath)) {
    warn(`ATTRIBUTION.md 없음 (찾은 위치: ${attrPath})`);
    return;
  }
  const text = fs.readFileSync(attrPath, 'utf8');
  for (const f of assetFiles) {
    const base = path.basename(f);
    if (!text.includes(base)) {
      warn(`ATTRIBUTION.md: ${path.relative(repoRoot, f)} 언급 없음 — 출처 미기재`);
    }
  }
  // ATTRIBUTION.md가 언급하는 파일명 중 실제로 assets/에 없는 것(허깨비 출처 라인).
  // 확장자는 assets/에 실제로 쓰이는 것만 검사 대상으로 삼는다 — 안 그러면
  // "원본 파일명은 switch1.ogg였다" 같은 출처 설명(리네임 전 이름)까지
  // "존재하지 않는 파일"로 잘못 잡아낸다.
  const assetBasenames = new Set(assetFiles.map((f) => path.basename(f)));
  const usedExts = new Set(assetFiles.map((f) => path.extname(f).slice(1).toLowerCase()));
  const extAlt = [...usedExts].join('|') || 'never-matches';
  const fileRefPattern = new RegExp(`\\b([\\w.-]+\\.(?:${extAlt}))\\b`, 'gi');
  let m;
  const mentioned = new Set();
  while ((m = fileRefPattern.exec(text))) mentioned.add(m[1]);
  for (const name of mentioned) {
    if (!assetBasenames.has(name)) {
      warn(`ATTRIBUTION.md: "${name}" 언급되지만 assets/에 실제 파일이 없음 — 존재하지 않는 출처이거나 경로가 바뀐 파일`);
    }
  }
  if (![...mentioned].some((n) => assetBasenames.has(n))) return;
  ok(`ATTRIBUTION.md 존재, ${assetFiles.length}개 에셋 중 대응 확인 시도함`);
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------
console.log(`game 폴더: ${gameDir}`);
console.log(`저장소 루트: ${repoRoot}`);
console.log('');

const audioDir = path.join(gameDir, 'assets', 'audio');
const glbDir = path.join(gameDir, 'assets', 'glb');

const audioFiles = fs.existsSync(audioDir)
  ? fs.readdirSync(audioDir).filter((f) => /\.(mp3|ogg|wav)$/i.test(f)).map((f) => path.join(audioDir, f))
  : [];
const glbFiles = fs.existsSync(glbDir)
  ? fs.readdirSync(glbDir).filter((f) => /\.glb$/i.test(f)).map((f) => path.join(glbDir, f))
  : [];

// 오디오+GLB 둘 다 0개면 십중팔구 game 폴더 경로를 잘못 잡은 것이다(예: cwd가
// tools/일 때 인자 없이 실행하면 예전엔 game/의 부모를 game으로 착각했다).
// 경로가 틀렸는데도 "검사할 게 없어서 경고 없음"으로 조용히 통과하면 거짓
// 안전 신호라 exit 1로 명확히 실패시킨다.
if (audioFiles.length === 0 && glbFiles.length === 0) {
  console.error(`ERROR 오디오/GLB 파일을 하나도 못 찾음 — game 폴더 경로가 잘못됐을 가능성이 높다.`);
  console.error(`ERROR   확인한 경로: ${audioDir}`);
  console.error(`ERROR             ${glbDir}`);
  process.exit(1);
}

console.log('--- 오디오 ---');
for (const f of audioFiles) checkAudioFile(f);

console.log('');
console.log('--- GLB ---');
for (const f of glbFiles) checkGLBFile(f);

console.log('');
console.log('--- assets/ 허용 확장자 검사 ---');
checkForeignFiles(path.join(gameDir, 'assets'));

console.log('');
console.log('--- ATTRIBUTION.md 대응 ---');
checkAttribution([...audioFiles, ...glbFiles]);

console.log('');
console.log(warnings === 0 ? '경고 없음' : `경고 ${warnings}건 — 최종 판단은 사람이 할 것`);
process.exit(0);
