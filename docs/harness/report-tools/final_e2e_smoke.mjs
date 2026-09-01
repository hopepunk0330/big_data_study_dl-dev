// 참여자 화면 전체 흐름 스모크 테스트 — 화면1→가격 판단(2회)→SCR-004
// 선택+"기타" 자유응답 입력→제출까지 webkit·chromium 양쪽에서 에러 없이
// 완주하는지 확인한다.
import { chromium, webkit } from 'playwright';
import { requireHtmlArg, startServer, activeScreen, enterFirstPriceScreen, advancePastPriceScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'final_e2e_smoke.mjs');
const { server, BASE } = await startServer(HTML);

async function run(name, engine) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });

  const { screenNum: first, errors } = await enterFirstPriceScreen(page, BASE);
  await advancePastPriceScreen(page, first);

  const second = await activeScreen(page);
  await advancePastPriceScreen(page, second);
  await page.waitForTimeout(2700 - 900); // SCR-004 스켈레톤 시퀀스 종료까지(advancePastPriceScreen이 이미 900ms 대기)

  const scr4 = await activeScreen(page);
  if (scr4 !== 5) throw new Error(`${name}: SCR-004 진입 실패 active=${scr4}`);

  // "기타" 모달 열고 텍스트 입력 후 확인 → 제출
  await page.locator('#pv4-options .compare-card[data-option="A"]').click();
  await page.locator('#pv4-reasons .reason-row[data-reason="other"]').click();
  await page.waitForTimeout(400);
  await page.locator('#pv4-textarea').fill('테스트 응답입니다');
  await page.locator('#pv4-confirm').click();
  await page.waitForTimeout(300);
  await page.locator('#pv4-submit').click();
  await page.waitForTimeout(1200);

  const scr6 = await activeScreen(page);

  await browser.close();
  return { name, scr4, scr6, errors };
}

const results = [];
results.push(await run('webkit', webkit));
results.push(await run('chromium', chromium));
server.close();

results.forEach((r) => {
  console.log(`${r.name}: SCR-004 진입=${r.scr4===5}, 제출 후 화면=${r.scr6}, 콘솔/페이지 에러=${r.errors.length}건`);
  if (r.errors.length) console.log('  ', r.errors);
});
