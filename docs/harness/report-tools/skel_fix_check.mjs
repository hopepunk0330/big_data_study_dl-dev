import { chromium, webkit } from 'playwright';

const HTML = process.argv[2];
const engineArg = process.argv[3] || 'chromium';
const engine = engineArg === 'webkit' ? webkit : chromium;

const browser = await engine.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto('file://' + HTML);

// 관찰자 설치(모든 .p3-skel의 class 변화 기록) + 실제 클릭 진행을 동일한
// page.evaluate 흐름 안에서 순차 실행 — IPC 왕복 노이즈를 줄이기 위해
// 각 단계는 waitForFunction으로 대기하고 클릭은 실제 DOM 이벤트로 발생시킨다.
await page.evaluate(() => {
  window.__events = [];
  window.__t0 = {};
  const mo = new MutationObserver((muts) => {
    const now = performance.now();
    muts.forEach((m) => {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList && el.classList.contains('p3-skel') && el.classList.contains('p3-skel-flash')) {
          const wrap = el.closest('.p3-skel-wrap-badge') ? 'badge' : (el.closest('.p3-skel-wrap-row') ? 'row' : (el.closest('.p3-hero-card') ? 'hero' : 'unknown'));
          const screen = el.closest('.pv-screen');
          window.__events.push({ t: now, wrap, dataScreen: screen ? screen.dataset.screen : null });
        }
        if (el.classList && el.classList.contains('pv-screen') && el.classList.contains('active')) {
          const ds = el.dataset.screen;
          if (!window.__t0[ds]) window.__t0[ds] = now;
        }
      }
    });
  });
  document.querySelectorAll('.p3-skel, .pv-screen').forEach((el) => {
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  window.__mo = mo;
});

// 1) 화면1 -> 다음
await page.waitForFunction(() => {
  const btn = document.getElementById('pv1a-next');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#pv1a-next');

// 2) 화면2(closing box) -> 시작할게요
await page.waitForFunction(() => {
  const btn = document.getElementById('pv1b-cta');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#pv1b-cta');

// 3) 첫 번째 가격 화면 진입 대기(3 또는 4)
await page.waitForFunction(() => {
  const active = document.querySelector('.pv-screen.active');
  return active && (active.dataset.screen === '3' || active.dataset.screen === '4');
}, { timeout: 15000 });

const firstScreenNo = await page.evaluate(() => document.querySelector('.pv-screen.active').dataset.screen);
console.log('first price screen data-screen =', firstScreenNo);

// 스켈레톤 체인이 다 끝날 시간(가격카드 스켈레톤 시작 1100ms + 500ms = 1600ms)보다
// 넉넉히 대기 + 카운트업까지 끝나길 대기(단일가 900ms/범위가 최대 1800ms 추가).
await page.waitForTimeout(2600);

// 4) 다음 가격 화면으로 이동 — "네, 이대로 좋아요" 선택 후 CTA 클릭
// (실제 참여자 물리 클릭이 아니라 DOM 이벤트 발생만으로 충분한 검증용
// 스크립트이므로, 시트 스크롤/겹침 이슈를 피하려 el.click()을 evaluate로 직접 호출)
const screenSel = firstScreenNo === '3' ? '#pv2-screen' : '#pv3-screen';
await page.evaluate((sel) => {
  document.querySelector(sel + ' .p3-choice.yes').click();
}, screenSel);
await page.waitForFunction((sel) => {
  const cta = document.querySelector(sel + ' .p3-cta');
  return cta && !cta.disabled;
}, screenSel, { timeout: 8000 });
await page.evaluate((sel) => {
  document.querySelector(sel + ' .p3-cta').click();
}, screenSel);

await page.waitForFunction(() => {
  const active = document.querySelector('.pv-screen.active');
  return active && (active.dataset.screen === '3' || active.dataset.screen === '4');
}, { timeout: 15000 });
const secondScreenNo = await page.evaluate(() => document.querySelector('.pv-screen.active').dataset.screen);
console.log('second price screen data-screen =', secondScreenNo);
await page.waitForTimeout(2600);

const events = await page.evaluate(() => window.__events);
const t0 = await page.evaluate(() => window.__t0);
console.log('t0 (screen active 시점)', t0);
console.log('skel-flash events (ms since page load, performance.now):');
events.forEach((e) => {
  const base = t0[e.dataScreen];
  const rel = base != null ? (e.t - base).toFixed(1) : 'n/a';
  console.log(`  screen=${e.dataScreen} wrap=${e.wrap} t=${e.t.toFixed(1)} rel=${rel}ms`);
});

console.log('총 skel-flash 이벤트 수:', events.length, '(기대: badge/row 각 2회 이상 — 화면3·4 각 1회씩)');
console.log('콘솔/페이지 에러:', consoleErrors.length, consoleErrors.slice(0, 10));

await page.screenshot({ path: '/tmp/skel_fix_final.png' });
await browser.close();
