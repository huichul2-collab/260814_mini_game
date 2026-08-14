// import 그래프 검증기 (로드맵 §6-2).
// 빌드 단계가 없는 순수 ES 모듈 프로젝트라 import 오타가 런타임까지
// 조용히 통과한다. 이 스크립트는 index.html의 importmap을 파싱하고
// main.js부터 정적 import를 따라가며:
//   ① 모든 specifier가 실제 파일로 해석되는지
//   ② 파일명 대소문자·공백이 디스크와 정확히 일치하는지 (Windows는
//      대소문자를 무시하므로 로컬에선 안 터지고 itch.io(Linux)에서만 터짐)
// 를 검사한다.
//
// 사용법: node check-imports.mjs <game 폴더 절대경로>
import fs from 'node:fs';
import path from 'node:path';

const gameDir = path.resolve(process.argv[2] || '.');
const indexHtml = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');

const importmapMatch = indexHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!importmapMatch) {
  console.error('FAIL: index.html에서 <script type="importmap"> 못 찾음');
  process.exit(1);
}
const importmap = JSON.parse(importmapMatch[1]).imports || {};

const mainMatch = indexHtml.match(/<script type="module" src="([^"]+)"/);
if (!mainMatch) {
  console.error('FAIL: index.html에서 진입점 <script type="module" src="..."> 못 찾음');
  process.exit(1);
}
const entryFile = path.resolve(gameDir, mainMatch[1]);

// 실제 디스크 대소문자와 정확히 일치하는지 세그먼트 단위로 검증.
// fs.existsSync는 Windows에서 대소문자를 무시하므로 이것만으론 부족하다.
function resolveExactCase(absPath) {
  const rel = path.relative(gameDir, absPath);
  if (rel.startsWith('..')) return { exists: false, reason: 'gameDir 바깥' };
  const segments = rel.split(path.sep).filter(Boolean);
  let cur = gameDir;
  for (const seg of segments) {
    let entries;
    try {
      entries = fs.readdirSync(cur);
    } catch {
      return { exists: false, reason: `디렉터리 없음: ${cur}` };
    }
    if (!entries.includes(seg)) {
      const ci = entries.find((e) => e.toLowerCase() === seg.toLowerCase());
      if (ci) return { exists: false, reason: `대소문자 불일치: 요청="${seg}" 실제="${ci}" (경로: ${cur})` };
      return { exists: false, reason: `파일 없음: "${seg}" (경로: ${cur})` };
    }
    cur = path.join(cur, seg);
  }
  return { exists: true };
}

function resolveSpecifier(spec, fromFile) {
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return path.resolve(path.dirname(fromFile), spec);
  }
  // importmap 정확 일치
  if (importmap[spec]) return path.resolve(gameDir, importmap[spec]);
  // importmap 접두어(trailing slash) 일치
  for (const [key, val] of Object.entries(importmap)) {
    if (key.endsWith('/') && spec.startsWith(key)) {
      return path.resolve(gameDir, val, spec.slice(key.length));
    }
  }
  return null; // bare specifier가 importmap에 없음
}

// 압축(minified) 번들은 `import{...}from"..."` 처럼 키워드 뒤에 공백이 없다.
// \s* 로 완화해야 three.module.js 같은 vendor 파일도 제대로 훑는다.
const IMPORT_RE = /(?:^|\n)\s*import\s*(?:[\s\S]*?\s*from\s*)?['"]([^'"]+)['"]|(?:^|\n)\s*export\s*(?:[\s\S]*?\s*from\s*)?['"]([^'"]+)['"]/g;

function extractSpecifiers(src) {
  const specs = [];
  let m;
  const re = new RegExp(IMPORT_RE);
  while ((m = re.exec(src))) {
    specs.push(m[1] || m[2]);
  }
  return specs;
}

const visited = new Set();
const problems = [];
const queue = [entryFile];

while (queue.length) {
  const file = queue.pop();
  if (visited.has(file)) continue;
  visited.add(file);

  const check = resolveExactCase(file);
  if (!check.exists) {
    problems.push(`진입 파일 자체가 없음: ${file} (${check.reason})`);
    continue;
  }

  const src = fs.readFileSync(file, 'utf8');
  for (const spec of extractSpecifiers(src)) {
    const resolved = resolveSpecifier(spec, file);
    if (!resolved) {
      problems.push(`${path.relative(gameDir, file)} → "${spec}" : importmap에 없는 bare specifier`);
      continue;
    }
    const res = resolveExactCase(resolved);
    if (!res.exists) {
      problems.push(`${path.relative(gameDir, file)} → "${spec}" : ${res.reason}`);
      continue;
    }
    if (resolved.endsWith('.js') || resolved.endsWith('.mjs')) queue.push(resolved);
  }
}

console.log(`검사한 파일: ${visited.size}개`);
if (problems.length === 0) {
  console.log('OK: 모든 import가 실제 파일로, 대소문자까지 정확히 해석됨');
  process.exit(0);
} else {
  console.log(`FAIL: 문제 ${problems.length}건`);
  for (const p of problems) console.log('  -', p);
  process.exit(1);
}
