// SCR-006(중복 참여 안내) 진입 로직 검증 — 06_기능정의서_화면정의서 v1.45
//   · 3절 화면 전이도: "이미 완료한 세션이 다시 접속하면 항상 SCR-006으로 우회"
//   · SCR-005 절 / AC-03: "이 화면 이후 뒤로 가기·새로고침을 해도 SCR-006으로 전환"
//   · 4절 세션 식별: 완료 여부는 localStorage(ab_completed)로 판정
//
// 사용법: node verify_scr006_duplicate.mjs <web/index.html 경로>
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  requireHtmlArg, startServer, activeScreen,
  enterFirstPriceScreen, advancePastPriceScreen,
} from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_scr006_duplicate.mjs', 'web/index.html');
const { server, BASE } = await startServer(HTML);
const SHOT_DIR = path.resolve(fileURLToPath(new URL('../../screenshot/', import.meta.url)));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

/** /api/participant-number 호출 횟수를 세는 페이지를 만든다. */
async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const state = { apiCalls: 0, errors: [] };
  page.on('request', (r) => { if (r.url().includes('/api/participant-number')) state.apiCalls += 1; });
  page.on('pageerror', (e) => state.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') state.errors.push('console.error: ' + m.text()); });
  return { page, state };
}

const browser = await chromium.launch();

// ─────────────────────────────────────────────────────────────────
// (b) 회귀 확인 — 완료 플래그가 없는 신규 참여자는 SCR-001-1부터 정상 진입
// ─────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let apiCalls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/participant-number')) apiCalls += 1; });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const n = await activeScreen(page);
  check('신규 참여자는 SCR-001-1(화면1)로 진입한다', n === 1, `active=${n}`);
  check('신규 참여자는 순번 API를 호출한다(FN-002 회귀 없음)', apiCalls === 1, `calls=${apiCalls}`);
  check('신규 진입 시 JS 에러 0건', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: path.join(SHOT_DIR, 'scr006-01-신규참여자-SCR001-1.png') });
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────
// (a) 완료 플래그를 미리 심어두고 새로 로드 → SCR-006이 즉시 보인다
// ─────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let apiCalls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/participant-number')) apiCalls += 1; });

  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ab_completed', '1');
      localStorage.setItem('ab_participant_id', 'seeded-participant');
    } catch (e) { /* 무시 */ }
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const n = await activeScreen(page);
  check('완료 플래그가 있으면 SCR-006(화면7)이 즉시 보인다', n === 7, `active=${n}`);

  const headline = await page.locator('.pv-screen[data-screen="7"] .headline').innerText();
  check('SCR-006 헤드라인이 화면정의서 문구와 일치', headline.replace(/\s+/g, '') === '이미소중한의견을들려주셨어요!', JSON.stringify(headline));

  const s1Visible = await page.locator('.pv-screen[data-screen="1"]').evaluate((el) => el.classList.contains('active'));
  check('SCR-001-1은 활성화되지 않는다', s1Visible === false, `s1active=${s1Visible}`);
  check('중복 방문은 순번 API를 호출하지 않는다(카운터 소모 없음)', apiCalls === 0, `calls=${apiCalls}`);
  check('중복 방문 진입 시 JS 에러 0건', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: path.join(SHOT_DIR, 'scr006-02-완료세션-SCR006.png') });
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────
// 실제 완주 → 새로고침 → SCR-006 (AC-03) + bfcache 복원(pageshow persisted)
// ─────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let apiCalls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/participant-number')) apiCalls += 1; });

  const { screenNum: first, errors } = await enterFirstPriceScreen(page, BASE);
  await advancePastPriceScreen(page, first);
  const second = await activeScreen(page);
  await advancePastPriceScreen(page, second);
  await page.waitForTimeout(1800);

  const scr4 = await activeScreen(page);
  check('완주 시나리오: SCR-004(화면5) 도달', scr4 === 5, `active=${scr4}`);

  await page.locator('#pv4-options .compare-card[data-option="A"]').click();
  await page.locator('#pv4-reasons .reason-row[data-reason="r1"]').click();
  await page.waitForTimeout(300);
  await page.locator('#pv4-submit').click();
  await page.waitForTimeout(1200);

  const scr5 = await activeScreen(page);
  check('제출 후 SCR-005(화면6) 도달', scr5 === 6, `active=${scr5}`);

  const flag = await page.evaluate(() => localStorage.getItem('ab_completed'));
  check("FN-003이 localStorage 'ab_completed'='1'을 기록한다", flag === '1', `flag=${flag}`);

  // bfcache 복원 시뮬레이션 — 스크립트 재실행 없이 pageshow(persisted)만 발생.
  await page.evaluate(() => {
    const ev = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(200);
  const afterBfcache = await activeScreen(page);
  check('bfcache 복원(pageshow persisted)에서도 SCR-006으로 전환', afterBfcache === 7, `active=${afterBfcache}`);

  // 새로고침(AC-03)
  const callsBefore = apiCalls;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const afterReload = await activeScreen(page);
  check('새로고침·재접속 시 SCR-006으로 전환(AC-03)', afterReload === 7, `active=${afterReload}`);
  check('재접속이 순번을 추가로 소모하지 않는다', apiCalls === callsBefore, `before=${callsBefore} after=${apiCalls}`);
  check('완주 시나리오 전체 JS 에러 0건', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: path.join(SHOT_DIR, 'scr006-03-완주후-새로고침-SCR006.png') });
  await ctx.close();
}

// ─────────────────────────────────────────────────────────────────
// reduced-motion 환경에서도 동일하게 동작
// ─────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('ab_completed', '1'); } catch (e) { /* 무시 */ } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const n = await activeScreen(page);
  check('reduced-motion 환경에서도 SCR-006으로 진입', n === 7, `active=${n}`);
  const opacity = await page.locator('.pv-screen[data-screen="7"]').evaluate((el) => getComputedStyle(el).opacity);
  check('reduced-motion에서 SCR-006이 실제로 보인다(opacity=1)', opacity === '1', `opacity=${opacity}`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'scr006-04-reducedmotion-SCR006.png') });
  await ctx.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
