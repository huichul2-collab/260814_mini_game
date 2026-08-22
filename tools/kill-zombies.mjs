#!/usr/bin/env node
// chrome.exe 좀비 정리 — puppeteer가 헤드리스로 띄운 인스턴스만 골라
// 종료한다. 구분 기준은 --remote-debugging-port 커맨드라인 인자다:
// puppeteer가 launch()할 때 항상 이 플래그를 붙이는 반면, 사용자가 직접
// 여는 일반 크롬 창(및 그 창의 렌더러/GPU/유틸리티 자식 프로세스)에는
// 이 플래그가 없다 — 실측으로 확인함(2026-08-23, tasklist류 도구로 사용자의
// 평소 크롬 프로세스 전부를 조회해 --remote-debugging-port가 하나도 없음을
// 확인했다).
//
// tools/render-check/*.mjs가 전부 try/finally로 browser.close()를 감싸고
// exit/SIGINT 훅까지 달아도, 강제 종료·크래시 등으로 그마저 못 지나가면
// chrome.exe가 프로세스 트리째 남을 수 있다 — 이 스크립트는 그 잔존물을
// 안전하게 청소하는 마지막 수단이다.
//
// 사용법: node tools/kill-zombies.mjs [--dry-run]
import { execFileSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');

function listChromeProcesses() {
  const psCmd = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress";
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { encoding: 'utf8' });
  const trimmed = out.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
}

const all = listChromeProcesses();
console.log(`전체 chrome.exe 프로세스: ${all.length}개`);

// --remote-debugging-port를 커맨드라인에 직접 가진 프로세스만 "헤드리스
// 인스턴스의 최상위(browser process)"로 본다. 그 자식(렌더러/GPU/유틸리티
// 등)은 이 플래그를 직접 갖고 있지 않지만, 부모를 taskkill /T로 종료하면
// 트리째 같이 정리된다 — 자식을 따로 매칭할 필요가 없다.
const zombieRoots = all.filter(
  (p) => typeof p.CommandLine === 'string' && p.CommandLine.includes('--remote-debugging-port')
);

if (zombieRoots.length === 0) {
  console.log('OK   --remote-debugging-port를 가진 chrome.exe 없음 — 정리할 좀비 없음');
  process.exit(0);
}

console.log(`좀비 후보(헤드리스 최상위 프로세스): ${zombieRoots.length}개`);
for (const p of zombieRoots) {
  const portMatch = p.CommandLine.match(/--remote-debugging-port=(\d+)/);
  console.log(`  PID ${p.ProcessId} port=${portMatch ? portMatch[1] : '?'}`);
}

if (dryRun) {
  console.log('\n--dry-run: 실제로 종료하지 않음');
  process.exit(0);
}

let killed = 0;
let failed = 0;
for (const p of zombieRoots) {
  try {
    // /T: 자식 프로세스(렌더러·GPU·유틸리티)까지 트리째 종료 — 부모만
    // 죽이면 자식이 고아 프로세스로 남아 또 좀비가 된다. 이 목록 자체에
    // 그 자식들도 개별 항목으로 들어있을 수 있어(위 실측 확인: Chrome이
    // --remote-debugging-port를 자식에도 물려줌), 부모를 먼저 트리째
    // 죽이면 뒤 순번의 자식 PID는 이미 죽은 뒤라 "프로세스를 찾을 수
    // 없음"으로 실패 처리된다 — 실패가 아니라 이미 끝난 상태다.
    execFileSync('taskkill', ['/PID', String(p.ProcessId), '/T', '/F'], { stdio: 'pipe' });
    console.log(`OK   PID ${p.ProcessId} 트리 종료`);
    killed++;
  } catch (e) {
    // taskkill은 "대상 PID가 이미 없음"일 때 exit code 128을 쓴다(로캘에
    // 안 흔들리는 유일한 신호 — stderr 텍스트는 시스템 로캘에 따라 깨져
    // 보일 수 있어 문자열 매칭 대신 이걸 쓴다).
    if (e.status === 128) {
      console.log(`OK   PID ${p.ProcessId} 이미 종료됨(다른 항목의 트리 종료로 같이 정리됨)`);
      killed++;
    } else {
      console.error(`FAIL PID ${p.ProcessId} 종료 실패 — exit code ${e.status}`);
      failed++;
    }
  }
}

console.log(`\n종료 ${killed}개, 실패 ${failed}개`);
process.exit(failed > 0 ? 1 : 0);
