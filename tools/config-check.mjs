#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import * as configMap from '../game/config.js';

const gameDir = path.resolve(process.argv[2] || './game');

const CONFIG_OBJECTS = {
  PLAYER: configMap.PLAYER_CONFIG,
  PLAYER_CONFIG: configMap.PLAYER_CONFIG,
  CAM: configMap.CAMERA_CONFIG,
  CAMERA_CONFIG: configMap.CAMERA_CONFIG,
  POST_EFFECTS_CONFIG: configMap.POST_EFFECTS_CONFIG,
  FOG_CONFIG: configMap.FOG_CONFIG,
  INTERACTION_CONFIG: configMap.INTERACTION_CONFIG,
  OPENING_CONFIG: configMap.OPENING_CONFIG,
};

function getAllJsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const targetFiles = [
  path.join(gameDir, 'main.js'),
  ...getAllJsFiles(path.join(gameDir, 'src')),
].filter((f) => fs.existsSync(f));

const regex = /\b(PLAYER_CONFIG|CAMERA_CONFIG|POST_EFFECTS_CONFIG|FOG_CONFIG|INTERACTION_CONFIG|OPENING_CONFIG|PLAYER|CAM)\.([a-zA-Z0-9_]+)\b/g;

let errors = 0;
const checked = new Set();

for (const filePath of targetFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const prefix = match[1];
    const key = match[2];
    const keyId = `${prefix}.${key}`;
    if (checked.has(keyId)) continue;
    checked.add(keyId);

    const targetObj = CONFIG_OBJECTS[prefix];
    if (targetObj && !(key in targetObj)) {
      const relPath = path.relative(gameDir, filePath);
      console.error(`FAIL: ${relPath} 참조 — ${prefix}.${key} 키가 game/config.js에 존재하지 않음!`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n총 ${errors}개 config 키 참조 오차 발생`);
  process.exit(1);
} else {
  console.log(`OK: 모든 config 키 참조(${checked.size}개)가 game/config.js에 존재함`);
  process.exit(0);
}
