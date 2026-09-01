// 참여자 화면(participant-flow-deployed.html) 대상 Playwright 검증
// 스크립트들이 공유하는 보일러플레이트 — 로컬 정적 서버 기동,
// /api/participant-number 스텁, 화면 상태 조회, 화면1→첫 가격화면
// 진입 시퀀스. 여러 스크립트(final_e2e_smoke.mjs·verify_scr004_modal_pan.mjs
// 등)에 복붙돼 있던 걸 data-harness-auditor 지적(2026-08-28)으로 뽑아냈다.
//
// 이 파일 자체는 "이 프로젝트의 참여자 화면" DOM 구조(.pv-screen 등)에
// 강결합돼 있어 범용 도구는 아니다 — 다른 프로젝트로 포크할 때는 그대로
// 재사용하지 말고 그 프로젝트의 화면 구조에 맞게 다시 작성한다.
import http from 'node:http';
import fs from 'node:fs';

/** HTML 경로 인자가 없으면 사용법을 안내하고 즉시 종료한다(폴백 금지 —
 * 세션 스크래치패드 절대경로를 기본값으로 심어두면 다음 세션·다른
 * 프로젝트에서 조용히 깨진다, data-harness-auditor 2026-08-28 지적).
 * argLabel: 참여자 화면이 아닌 다른 HTML(예: 아티팩트 버전 탭)을 받는
 * 스크립트가 안내 문구의 파일명을 바로잡을 때 쓴다. */
export function requireHtmlArg(argv2, scriptName, argLabel = 'participant-flow-deployed.html') {
  if (!argv2) {
    console.error(`사용법: node ${scriptName} <${argLabel} 경로>`);
    console.error(`예: node ${scriptName} /path/to/${argLabel}`);
    process.exit(1);
  }
  return argv2;
}

/** 정적 HTML 서빙 + /api/participant-number 스텁 서버를 만들고 리슨,
 * BASE URL을 반환한다. */
export async function startServer(htmlPath) {
  let counter = 0;
  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/api/participant-number') {
      counter += 1;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ number: counter }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(htmlPath));
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  return { server, BASE: `http://127.0.0.1:${port}/` };
}

export async function activeScreen(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.pv-screen.active');
    return el ? Number(el.dataset.screen) : null;
  });
}

/** 콘솔/페이지 에러 리스너를 붙이고, 화면1(인트로+안내)을 지나 첫 가격
 * 화면(SCR-002 또는 SCR-003)까지 진입한다. 진입 후 활성 화면 번호와
 * 지금까지 수집된 에러 배열을 반환한다 — 이후 흐름(가격 화면 안에서
 * 무엇을 할지)은 각 스크립트가 이어서 처리한다. */
export async function enterFirstPriceScreen(page, base) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 5000 });
  await page.waitForTimeout(2600);
  await page.locator('#pv1a-next').click();
  await page.waitForTimeout(1400 + 5400);
  await page.locator('#pv1b-cta').click();
  await page.waitForTimeout(2300);

  const screenNum = await activeScreen(page);
  return { screenNum, errors };
}

/** 가격 화면(SCR-002/003) 번호로 셀렉터·수용 선택지 셀렉터를 얻는다. */
export function priceScreenSelectors(screenNum) {
  const sel = screenNum === 4 ? '#pv3-screen' : '#pv2-screen';
  const choiceSel = screenNum === 4 ? '.p3-choice.yes' : '.p3-choice.no';
  return { sel, choiceSel };
}

/** 바텀시트를 즉시 펼친 상태로 만든다(스와이프 애니메이션을 기다리지
 * 않고 테스트를 빠르게 진행하기 위한 지름길 — 실제 참여자는 스와이프로
 * 연다). */
export async function revealDecision(page, sel) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    el.querySelector('.p3-decision').classList.add('revealed');
    el.querySelector('.p3-sheet').style.transform = 'translateY(0)';
  }, sel);
}

/** 가격 화면 하나를 "수용/비수용 선택 → (비수용이면 희망가 입력) →
 * 다음"까지 진행해 다음 화면으로 넘어간다. final_e2e_smoke.mjs·
 * verify_scr004_modal_pan.mjs·scr004_compare_skel_check.mjs처럼 SCR-004까지
 * 도달해야 하는 스크립트가 가격 화면 2개를 순서대로 통과할 때 쓴다. */
export async function advancePastPriceScreen(page, screenNum, postCtaWaitMs = 900) {
  const { sel, choiceSel } = priceScreenSelectors(screenNum);
  await revealDecision(page, sel);
  await page.locator(`${sel} ${choiceSel}`).click();
  await page.waitForTimeout(400);
  if (screenNum === 3) {
    await page.locator(`${sel} .p3-price-input input`).fill('50000');
  }
  await page.locator(`${sel} .p3-cta`).click();
  await page.waitForTimeout(postCtaWaitMs);
}
