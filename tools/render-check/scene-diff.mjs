#!/usr/bin/env node
// scene-dump.mjs가 만든 JSON 두 개를 비교한다 — 추가/삭제/변경 항목을
// 정확히 짚어낸다. 짝짓기 키는 "월드좌표+geometry.type"이다: 순수
// 리팩터링(같은 소품이 같은 자리에)이면 모든 항목이 완전히 같은 키로
// 매칭돼 차이가 0으로 나온다. 좌표가 달라진 항목은 한쪽에서 REMOVED,
// 다른 쪽에서 ADDED로 짝 없이 나타난다(같은 물체가 옮겨졌다는 뜻 —
// 두 항목을 나란히 보면 사람이 바로 알아볼 수 있다).
import fs from 'node:fs';
import path from 'node:path';

const fileA = process.argv[2];
const fileB = process.argv[3];
if (!fileA || !fileB) {
  console.error('사용법: node scene-diff.mjs <A.json> <B.json>');
  process.exit(2);
}
if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
  console.error(`FAIL: 파일 없음 — ${fileA} / ${fileB} (먼저 scene-dump.mjs로 덤프를 생성해라)`);
  process.exit(1);
}

const dumpA = JSON.parse(fs.readFileSync(fileA, 'utf8'));
const dumpB = JSON.parse(fs.readFileSync(fileB, 'utf8'));

function keyOf(item) {
  return `${item.position.x},${item.position.y},${item.position.z}|${item.geometry.type}`;
}

const mapA = new Map(dumpA.map((it) => [keyOf(it), it]));
const mapB = new Map(dumpB.map((it) => [keyOf(it), it]));

const removed = [];
const added = [];
const changed = [];

for (const [key, itemA] of mapA) {
  if (!mapB.has(key)) {
    removed.push(itemA);
    continue;
  }
  const itemB = mapB.get(key);
  const sA = JSON.stringify(itemA);
  const sB = JSON.stringify(itemB);
  if (sA !== sB) {
    const fields = [];
    for (const f of ['rotation', 'scale', 'colorHex', 'geometry', 'userData', 'name']) {
      if (JSON.stringify(itemA[f]) !== JSON.stringify(itemB[f])) {
        fields.push({ field: f, a: itemA[f], b: itemB[f] });
      }
    }
    changed.push({ key, fields });
  }
}
for (const [key, itemB] of mapB) {
  if (!mapA.has(key)) added.push(itemB);
}

function fmtItem(it) {
  const tag = it.userData && it.userData.interactive ? ` [${it.userData.interactive}]` : '';
  return `pos(${it.position.x},${it.position.y},${it.position.z}) ${it.geometry.type}${tag} color=#${(it.colorHex ?? 0).toString(16).padStart(6, '0')}`;
}

console.log(`A(${path.basename(fileA)}): ${dumpA.length}개 메시, B(${path.basename(fileB)}): ${dumpB.length}개 메시`);
console.log('');

if (removed.length) {
  console.log(`--- REMOVED (A에만 있음, ${removed.length}개) ---`);
  for (const it of removed) console.log(`  - ${fmtItem(it)}`);
}
if (added.length) {
  console.log(`--- ADDED (B에만 있음, ${added.length}개) ---`);
  for (const it of added) console.log(`  + ${fmtItem(it)}`);
}
if (changed.length) {
  console.log(`--- CHANGED (같은 위치, 다른 속성, ${changed.length}개) ---`);
  for (const c of changed) {
    console.log(`  ~ ${c.key}`);
    for (const f of c.fields) {
      console.log(`      ${f.field}: ${JSON.stringify(f.a)} → ${JSON.stringify(f.b)}`);
    }
  }
}

const totalDiff = removed.length + added.length + changed.length;
console.log('');
if (totalDiff === 0) {
  console.log(`OK: 씬 그래프 완전 동일 (${dumpA.length}개 메시 전부 일치)`);
  process.exit(0);
} else {
  console.log(`FAIL: 차이 ${totalDiff}건 (removed ${removed.length} / added ${added.length} / changed ${changed.length})`);
  process.exit(1);
}
