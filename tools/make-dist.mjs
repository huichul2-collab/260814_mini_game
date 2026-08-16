// itch.io 업로드용 zip 생성기 — 수동 압축 실수 방지.
//
// ⚠️ itch.io는 zip 루트에 index.html이 있어야 실행된다. game/ 폴더를
// 통째로 압축하면(예: 탐색기에서 game 폴더 우클릭 → 압축) zip 안이
// game/index.html이 되어버려 itch.io가 실행 파일을 못 찾는다 — 반드시
// game/ "안의 내용물"을 압축해야 한다. 이 스크립트는 그 실수가 구조적으로
// 안 나게, game/ 밑 항목들을 개별로 나열해서 zip 루트에 바로 넣는다.
//
// 제외 대상:
//   - _scratch/  : 개발용 프리뷰, 배포물 아님
//   - .claude/   : 로컬 세션 설정, 배포물 아님(프로젝트 .gitignore와 동일 기준)
//   - *_source.* : AI 생성 원본 등 배포 불필요 대용량 파일. game/ 밖
//                  (_assets_source/)으로 이미 옮겨져 있어야 정상이지만,
//                  누군가 실수로 game/ 안에 다시 넣어도 여기서 한 번 더 막는다.
//
// Windows 전용(다른 tools/*.mjs와 동일하게 PowerShell Compress-Archive를 씀 —
// 이 프로젝트가 오프라인/무빌드 원칙이라 npm zip 패키지를 새로 안 들인다).
//
// 사용법: node tools/make-dist.mjs [출력 zip 경로]
//   기본 출력: <저장소 루트>/dist/game-dist.zip
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const gameDir = path.join(repoRoot, 'game');
const outZip = path.resolve(process.argv[2] || path.join(repoRoot, 'dist', 'game-dist.zip'));

const EXCLUDE_NAMES = new Set(['_scratch', '.claude']);

if (!fs.existsSync(path.join(gameDir, 'index.html'))) {
  console.error(`ERROR ${gameDir}\\index.html이 없음 — gameDir 경로 확인 필요`);
  process.exit(1);
}

function findSourceLeftovers(dir, found) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (EXCLUDE_NAMES.has(name)) continue;
      findSourceLeftovers(full, found);
    } else if (/_source\.[a-z0-9]+$/i.test(name)) {
      found.push(full);
    }
  }
}
const leftovers = [];
findSourceLeftovers(gameDir, leftovers);
if (leftovers.length) {
  console.error('ERROR game/ 안에 배포 제외 대상(*_source.*)이 남아있음 — 저장소 밖(_assets_source/)으로 옮긴 뒤 다시 실행할 것:');
  for (const f of leftovers) console.error(`  ${path.relative(repoRoot, f)} (${(fs.statSync(f).size / 1024 / 1024).toFixed(2)}MB)`);
  process.exit(1);
}

const topLevel = fs.readdirSync(gameDir).filter((name) => !EXCLUDE_NAMES.has(name));
if (!topLevel.length) {
  console.error('ERROR 압축할 항목이 없음');
  process.exit(1);
}

console.log(`game 폴더: ${gameDir}`);
console.log('포함 항목(zip 루트에 그대로 들어감):');
for (const name of topLevel) console.log(`  ${name}`);
console.log('제외 항목:', [...EXCLUDE_NAMES].join(', '));
console.log('');

fs.mkdirSync(path.dirname(outZip), { recursive: true });
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

const psPaths = topLevel.map((name) => `'${path.join(gameDir, name).replace(/'/g, "''")}'`).join(',');
const psCmd = `Compress-Archive -LiteralPath @(${psPaths}) -DestinationPath '${outZip.replace(/'/g, "''")}' -Force`;

try {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { stdio: 'inherit' });
} catch (e) {
  console.error('ERROR Compress-Archive 실패:', e.message);
  process.exit(1);
}

const size = fs.statSync(outZip).size;
const sizeMB = size / 1024 / 1024;
console.log('');
console.log(`OK   ${outZip} (${sizeMB.toFixed(2)}MB)`);
if (sizeMB > 15) {
  console.log(`WARN 15MB를 넘음 — 뭔가 딸려 들어갔을 가능성(예: node_modules, *_source.*). 위 "포함 항목" 목록을 확인할 것.`);
}
process.exit(0);
