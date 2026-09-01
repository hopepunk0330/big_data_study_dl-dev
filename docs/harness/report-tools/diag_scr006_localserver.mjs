// SCR-006 오진단 조사 전용 임시 스크립트(2026-08-28).
// "완전히 새 브라우저 상태인데도 SCR-006이 뜬다"는 보고를, 사용자가 실제로
// 접속한 것과 같은 조건(로컬 개발 서버 + LAN IP = 비보안 컨텍스트)에서
// 재현 시도한다.
//
// 사용법: node diag_scr006_localserver.mjs <base-url>
//   예: node diag_scr006_localserver.mjs http://192.168.20.185:8766/index.html
import { chromium } from 'playwright';

const TARGET = process.argv[2];
if (!TARGET) {
  console.error('사용법: node diag_scr006_localserver.mjs <base-url>');
  process.exit(1);
}

function attachErrors(page, bucket) {
  page.on('pageerror', (e) => bucket.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') bucket.push('console.error: ' + m.text()); });
  page.on('requestfailed', (r) => bucket.push('requestfailed: ' + r.url() + ' — ' + (r.failure() && r.failure().errorText)));
}

async function probe(page) {
  return page.evaluate(() => {
    const active = document.querySelector('.pv-screen.active');
    const ls = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        ls[k] = String(localStorage.getItem(k)).slice(0, 60);
      }
    } catch (e) { ls.__error = String(e); }
    const ss = {};
    try {
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const k = sessionStorage.key(i);
        ss[k] = String(sessionStorage.getItem(k)).slice(0, 60);
      }
    } catch (e) { ss.__error = String(e); }
    return {
      activeScreen: active ? Number(active.dataset.screen) : null,
      headline: active ? (active.querySelector('.headline') || {}).textContent || null : null,
      isSecureContext: window.isSecureContext,
      hasRandomUUID: !!(window.crypto && typeof window.crypto.randomUUID === 'function'),
      hasABLog: !!window.ABLog,
      hasCompleted: !!(window.ABLog && window.ABLog.hasCompleted && window.ABLog.hasCompleted()),
      protoOnlyMode: document.body.classList.contains('proto-only-mode'),
      collectionClosed: !!window.AB_COLLECTION_CLOSED,
      localStorage: ls,
      sessionStorage: ss,
    };
  });
}

const browser = await chromium.launch();
const results = [];

// --- 1) 완전히 새 컨텍스트(= 새 시크릿 창의 이상적 케이스) ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  attachErrors(page, errs);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  results.push(['1) 새 컨텍스트(빈 저장소)', await probe(page), errs]);
  await ctx.close();
}

// --- 2) 모바일 에뮬레이션(안드로이드 Chrome UA/뷰포트) 새 컨텍스트 ---
{
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.6,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  const errs = [];
  attachErrors(page, errs);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  results.push(['2) 모바일 에뮬 새 컨텍스트', await probe(page), errs]);
  await ctx.close();
}

// --- 3) 완주 → 컨텍스트 폐기 → 새 컨텍스트 재접속 ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  attachErrors(page, errs);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 8000 });
  // 실제 제출까지 가지 않고, 제출이 남기는 것과 동일한 플래그만 확인용으로 세운다.
  await page.evaluate(() => localStorage.setItem('ab_completed', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  results.push(['3a) 같은 컨텍스트에서 플래그 세운 뒤 새로고침(SCR-006 기대)', await probe(page), errs]);
  await ctx.close();

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  const errs2 = [];
  attachErrors(page2, errs2);
  await page2.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(3000);
  results.push(['3b) 컨텍스트 폐기 후 새 컨텍스트(SCR-001-1 기대)', await probe(page2), errs2]);
  await ctx2.close();
}

// --- 4) "캐시만 비우고 저장소는 그대로"인 경우(모바일 Chrome의 '캐시 삭제') ---
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  attachErrors(page, errs);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('ab_completed', '1'));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');   // 캐시만 비운다(저장소는 유지)
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  results.push(['4) 캐시만 삭제 후 재접속(저장소 유지)', await probe(page), errs]);
  await ctx.close();
}

await browser.close();

for (const [label, r, errs] of results) {
  console.log('\n==== ' + label + ' ====');
  console.log('  activeScreen        :', r.activeScreen, r.activeScreen === 7 ? '  <-- SCR-006!' : '');
  console.log('  headline            :', JSON.stringify(r.headline));
  console.log('  isSecureContext     :', r.isSecureContext, '/ crypto.randomUUID:', r.hasRandomUUID);
  console.log('  ABLog 존재/hasCompleted:', r.hasABLog, '/', r.hasCompleted);
  console.log('  proto-only-mode     :', r.protoOnlyMode, '/ COLLECTION_CLOSED:', r.collectionClosed);
  console.log('  localStorage        :', JSON.stringify(r.localStorage));
  console.log('  sessionStorage keys :', Object.keys(r.sessionStorage).join(', ') || '(없음)');
  if (errs.length) console.log('  errors              :\n    ' + errs.join('\n    '));
  else console.log('  errors              : (없음)');
}
