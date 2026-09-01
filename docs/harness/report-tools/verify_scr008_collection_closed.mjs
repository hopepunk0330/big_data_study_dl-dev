// SCR-008(수집 마감 안내) 빌드 플래그 검증 — 06_기능정의서_화면정의서 v1.45
//   · 2절 SCR-008: "빌드 플래그가 켜져 있으면 앱이 어떤 URL·어떤 진입 경로로
//     열리든 이 화면만 렌더링하고 그 외 화면 코드·응답 기록 로직(FN-003 등)은
//     아예 실행되지 않는다"
//   · 3절 화면 전이도: SCR-001-1~006 어느 노드든 예외 없이 SCR-008로 대체
//   · SCR-006(중복 참여) 판정보다 우선순위가 높다
//
// 저장소의 web/index.html은 항상 COLLECTION_CLOSED = false(수집 진행 중)로
// 커밋된다. 그래서 이 스크립트는 원본을 고치지 않고, 임시 디렉터리에 플래그만
// true로 바꾼 사본을 만들어 "마감 상태"를 재현한다.
//
// 사용법: node verify_scr008_collection_closed.mjs <web/index.html 경로>
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg, startServer, activeScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_scr008_collection_closed.mjs', 'web/index.html');
const SHOT_DIR = path.resolve(fileURLToPath(new URL('../../screenshot/', import.meta.url)));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// ---- 마감 상태 사본 만들기 ----
const source = fs.readFileSync(HTML, 'utf8');
const FLAG_OPEN = 'const COLLECTION_CLOSED = false;';
const FLAG_CLOSED = 'const COLLECTION_CLOSED = true;';
const occurrences = source.split(FLAG_OPEN).length - 1;
check('원본 파일의 기본값이 COLLECTION_CLOSED = false 하나뿐이다', occurrences === 1, `matches=${occurrences}`);
if (occurrences !== 1) {
  console.log('\n기본값 상수를 찾지 못해 검증을 중단합니다.');
  process.exit(1);
}
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scr008-'));
const CLOSED_HTML = path.join(tmpDir, 'index-closed.html');
fs.writeFileSync(CLOSED_HTML, source.replace(FLAG_OPEN, FLAG_CLOSED));

// Amplitude CDN 로더를 스텁으로 대체해 init/track 호출 횟수를 셀 수 있게 한다
// (실제 CDN을 그대로 두면 네트워크 의존이 생기고, 초기화 여부도 관측할 수 없다).
const AMP_STUB = `
  window.__ampInit = 0; window.__ampTrack = 0;
  window.amplitude = {
    init: function () { window.__ampInit += 1; },
    track: function () { window.__ampTrack += 1; },
    add: function () {}, setUserId: function () {},
  };
  window.sessionReplay = { plugin: function () { return {}; } };
`;

async function newPage(ctx) {
  const page = await ctx.newPage();
  const state = { apiCalls: 0, errors: [], ampNet: 0 };
  // CDN 로더는 스텁으로 바꿔치고(초기화 여부 관측용), 그 외 amplitude 도메인
  // 요청(이벤트 전송)은 막으면서 횟수를 센다 — 한 핸들러로 처리해야 Playwright의
  // 라우트 우선순위(나중에 등록한 것이 먼저)에 헷갈리지 않는다.
  await page.route(/amplitude\.com/, (route) => {
    if (route.request().url().includes('cdn.amplitude.com')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: AMP_STUB });
    }
    state.ampNet += 1;
    return route.abort();
  });
  page.on('request', (r) => { if (r.url().includes('/api/participant-number')) state.apiCalls += 1; });
  page.on('pageerror', (e) => state.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') state.errors.push('console.error: ' + m.text()); });
  return { page, state };
}

const browser = await chromium.launch();

// ═════════════════════════════════════════════════════════════════
// (a) COLLECTION_CLOSED = true
// ═════════════════════════════════════════════════════════════════
{
  const { server, BASE } = await startServer(CLOSED_HTML);

  // 1) 신규 참여자
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { page, state } = await newPage(ctx);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const n = await activeScreen(page);
    check('[마감] 신규 참여자에게 SCR-008(화면8)만 보인다', n === 8, `active=${n}`);

    const activeCount = await page.evaluate(() => document.querySelectorAll('.pv-screen.active').length);
    check('[마감] 활성 화면은 정확히 1개다', activeCount === 1, `count=${activeCount}`);

    const headline = await page.locator('.pv-screen[data-screen="8"] .headline').innerText();
    check('[마감] 헤드라인이 화면정의서 문구와 일치', headline.replace(/\s+/g, '') === '통계수집이마감되었습니다', JSON.stringify(headline));
    const sub = await page.locator('.pv-screen[data-screen="8"] .sub').innerText();
    check('[마감] 서브 문구가 "감사합니다"', sub.trim() === '감사합니다', JSON.stringify(sub));

    const badge = await page.locator('.pv-screen[data-screen="8"] svg.icon-badge').count();
    check('[마감] 원형 배지 아이콘이 있다', badge === 1, `count=${badge}`);
    const strokes = await page.locator('.pv-screen[data-screen="8"] svg.icon-badge [stroke]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('stroke')));
    check('[마감] 시계 아이콘이 파란 라인(#3182F6)이다',
      strokes.length >= 2 && strokes.every((s) => s === '#3182F6'), JSON.stringify(strokes));

    const opacity = await page.locator('.pv-screen[data-screen="8"]').evaluate((el) => getComputedStyle(el).opacity);
    check('[마감] SCR-008이 실제로 보인다(opacity=1)', opacity === '1', `opacity=${opacity}`);

    check('[마감] 순번 API(/api/participant-number)를 호출하지 않는다', state.apiCalls === 0, `calls=${state.apiCalls}`);
    const assigned = await page.evaluate(() => ({
      order: sessionStorage.getItem('ab_assigned_order'),
      item: sessionStorage.getItem('ab_item_variant'),
      number: sessionStorage.getItem('ab_participant_number'),
      ready: !!(window.ABSession && window.ABSession.isReady()),
    }));
    check('[마감] 배정 결과가 저장되지 않는다(ensureAssignment 미실행)',
      !assigned.order && !assigned.item && !assigned.number && assigned.ready === false, JSON.stringify(assigned));

    const amp = await page.evaluate(() => ({ init: window.__ampInit, track: window.__ampTrack }));
    check('[마감] Amplitude를 초기화하지 않는다', amp.init === 0, JSON.stringify(amp));
    check('[마감] Amplitude 이벤트를 전송하지 않는다(FN-003 미실행)', amp.track === 0 && state.ampNet === 0,
      `track=${amp.track} net=${state.ampNet}`);

    const logKeys = await page.evaluate(() => ({
      completed: localStorage.getItem('ab_completed'),
      lastRecord: localStorage.getItem('ab_last_record'),
      participant: localStorage.getItem('ab_participant_id'),
    }));
    check('[마감] FN-003 로그·participant_id를 남기지 않는다',
      !logKeys.completed && !logKeys.lastRecord && !logKeys.participant, JSON.stringify(logKeys));

    check('[마감] JS 에러 0건', state.errors.length === 0, state.errors.join(' | '));
    await page.screenshot({ path: path.join(SHOT_DIR, 'scr008-01-마감-신규참여자.png') });
    await ctx.close();
  }

  // 2) 이미 완주한 세션(SCR-006 대상)도 SCR-008이 이긴다
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('ab_completed', '1');
        localStorage.setItem('ab_participant_id', 'seeded-participant');
      } catch (e) { /* 무시 */ }
    });
    const { page, state } = await newPage(ctx);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const n = await activeScreen(page);
    check('[마감] 완료 세션도 SCR-006이 아니라 SCR-008로 간다(우선순위)', n === 8, `active=${n}`);
    check('[마감] 완료 세션도 순번 API를 호출하지 않는다', state.apiCalls === 0, `calls=${state.apiCalls}`);
    check('[마감] 완료 세션 진입 시 JS 에러 0건', state.errors.length === 0, state.errors.join(' | '));
    await page.screenshot({ path: path.join(SHOT_DIR, 'scr008-02-마감-완료세션.png') });
    await ctx.close();
  }

  // 3) 진입 URL(쿼리스트링·해시)이 무엇이든 동일
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { page, state } = await newPage(ctx);
    await page.goto(BASE + '?full=1&utm_source=kakao#scr004', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const n = await activeScreen(page);
    check('[마감] 쿼리·해시가 붙은 URL로 열어도 SCR-008', n === 8, `active=${n}`);
    check('[마감] 쿼리 URL 진입도 API 호출 0건', state.apiCalls === 0, `calls=${state.apiCalls}`);
    await ctx.close();
  }

  // 4) reduced-motion
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const { page, state } = await newPage(ctx);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const n = await activeScreen(page);
    const opacity = await page.locator('.pv-screen[data-screen="8"]').evaluate((el) => getComputedStyle(el).opacity);
    check('[마감] reduced-motion 환경에서도 SCR-008', n === 8, `active=${n}`);
    check('[마감] reduced-motion에서도 실제로 보인다(opacity=1)', opacity === '1', `opacity=${opacity}`);
    check('[마감] reduced-motion JS 에러 0건', state.errors.length === 0, state.errors.join(' | '));
    await page.screenshot({ path: path.join(SHOT_DIR, 'scr008-03-마감-reducedmotion.png') });
    await ctx.close();
  }

  server.close();
}

// ═════════════════════════════════════════════════════════════════
// (b) COLLECTION_CLOSED = false (저장소 기본값) — 회귀 없음
// ═════════════════════════════════════════════════════════════════
{
  const { server, BASE } = await startServer(HTML);

  // 1) 신규 참여자는 기존대로 SCR-001-1
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { page, state } = await newPage(ctx);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const n = await activeScreen(page);
    check('[진행중] 신규 참여자는 SCR-001-1(화면1)로 진입', n === 1, `active=${n}`);
    const s8active = await page.locator('.pv-screen[data-screen="8"]').evaluate((el) => el.classList.contains('active'));
    check('[진행중] SCR-008은 활성화되지 않는다', s8active === false, `s8active=${s8active}`);
    check('[진행중] 순번 API를 정상 호출한다', state.apiCalls === 1, `calls=${state.apiCalls}`);
    const amp = await page.evaluate(() => window.__ampInit);
    check('[진행중] Amplitude가 정상 초기화된다(게이트 회귀 없음)', amp === 1, `init=${amp}`);
    check('[진행중] JS 에러 0건', state.errors.length === 0, state.errors.join(' | '));
    await page.screenshot({ path: path.join(SHOT_DIR, 'scr008-04-진행중-신규참여자.png') });
    await ctx.close();
  }

  // 2) 완료 세션은 기존대로 SCR-006
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('ab_completed', '1'); } catch (e) { /* 무시 */ } });
    const { page, state } = await newPage(ctx);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const n = await activeScreen(page);
    check('[진행중] 완료 세션은 SCR-006(화면7)로 우회(회귀 없음)', n === 7, `active=${n}`);
    check('[진행중] 완료 세션은 API 호출 0건', state.apiCalls === 0, `calls=${state.apiCalls}`);
    check('[진행중] 완료 세션 JS 에러 0건', state.errors.length === 0, state.errors.join(' | '));
    await ctx.close();
  }

  server.close();
}

await browser.close();
fs.rmSync(tmpDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
