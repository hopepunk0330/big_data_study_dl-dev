// SCR-004(설문) 스켈레톤 순차 등장 검증 — (1) MutationObserver로 s4-skel-flash/
// s4-in 부여 시각을 실측하고, (2) 스켈레톤이 실제로 "화면에 보이는지"까지
// 픽셀 샘플링으로 확인한다(SCR-002/003의 배지·상품행 스켈레톤은 부모 opacity:0과
// 곱해져 실제로는 안 보인다는 걸 이번에 발견했으므로, 같은 함정에 빠지지
// 않았는지 이 화면도 직접 픽셀로 검증한다).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';

const HTML = process.argv[2];
let counter = 0;
const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/participant-number') {
    counter += 1;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ number: counter }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(HTML));
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}/`;

async function activeScreen(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.pv-screen.active');
    return el ? Number(el.dataset.screen) : null;
  });
}

async function navigateToScr004(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 5000 });
  await page.waitForTimeout(2600);
  await page.locator('#pv1a-next').click();
  await page.waitForTimeout(1400 + 5400);
  await page.locator('#pv1b-cta').click();
  await page.waitForTimeout(2300);

  const first = await activeScreen(page);
  const firstSel = first === 4 ? '#pv3-screen' : '#pv2-screen';
  const firstChoice = first === 4 ? '.p3-choice.yes' : '.p3-choice.no';
  await page.evaluate((sel) => {
    const s = document.querySelector(sel);
    s.querySelector('.p3-decision').classList.add('revealed');
    s.querySelector('.p3-sheet').style.transform = 'translateY(0)';
  }, firstSel);
  await page.locator(`${firstSel} ${firstChoice}`).click();
  await page.waitForTimeout(400);
  if (first === 3) await page.locator(`${firstSel} .p3-price-input input`).fill('50000');
  await page.locator(`${firstSel} .p3-cta`).click();
  await page.waitForTimeout(900);

  const second = await activeScreen(page);
  const secondSel = second === 4 ? '#pv3-screen' : '#pv2-screen';
  const secondChoice = second === 4 ? '.p3-choice.yes' : '.p3-choice.no';
  await page.evaluate((sel) => {
    const s = document.querySelector(sel);
    s.querySelector('.p3-decision').classList.add('revealed');
    s.querySelector('.p3-sheet').style.transform = 'translateY(0)';
  }, secondSel);
  await page.locator(`${secondSel} ${secondChoice}`).click();
  await page.waitForTimeout(400);
  if (second === 3) await page.locator(`${secondSel} .p3-price-input input`).fill('50000');

  // SCR-004 진입 직전(마지막 .p3-cta 클릭) 시각을 t0로 잡고, MutationObserver를
  // 이 클릭 "전"에 미리 설치해둔다(엔트런스 직후 첫 스켈레톤이 곧바로
  // 시작되므로, 클릭 이후 옵저버를 붙이면 초반 이벤트를 놓칠 수 있다).
  await page.evaluate(() => {
    window.__scr004Events = [];
    window.__scr004T0 = null;
    const target = document.getElementById('pv4-screen');
    const obs = new MutationObserver((mutations) => {
      const now = performance.now();
      mutations.forEach((m) => {
        if (m.attributeName !== 'class') return;
        const el = m.target;
        const cls = el.className;
        if (window.__scr004T0 == null) return; // t0 설정 전 이벤트는 무시
        const t = now - window.__scr004T0;
        if (cls.indexOf('s4-skel-flash') !== -1 && !el.__loggedSkel) {
          el.__loggedSkel = true;
          window.__scr004Events.push({ t, type: 'skel', wrap: el.closest('.s4-skel-wrap').className });
        }
        if (cls.indexOf('s4-in') !== -1 && !el.__loggedIn) {
          el.__loggedIn = true;
          window.__scr004Events.push({ t, type: 'content', el: el.className.split(' ')[0] });
        }
      });
    });
    obs.observe(target, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.__scr004Obs = obs;
  });

  await page.locator(`${secondSel} .p3-cta`).click();
  await page.evaluate(() => { window.__scr004T0 = performance.now(); });
  await page.waitForTimeout(2600); // 전체 시퀀스(2150ms 종료) + 여유

  const scr = await activeScreen(page);
  if (scr !== 5) throw new Error(`SCR-004(화면5) 진입 실패 — active=${scr}`);

  const events = await page.evaluate(() => window.__scr004Events);
  return events;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
const events = await navigateToScr004(page);
events.sort((a, b) => a.t - b.t);
console.log('실측 이벤트(t=ms, 화면5 진입 직후 기준):');
events.forEach((e) => console.log(`  ${e.t.toFixed(1)}ms  ${e.type}  ${e.wrap || e.el}`));

// 픽셀 검증 — q-title 스켈레톤이 "실제로 화면에" 보이는지, 그 직후 콘텐츠가
// 정상적으로 opacity:1로 전환됐는지 다시 진입해서 확인한다(같은 세션 재사용 —
// 이미 화면5에 있으므로 재진입 트리거로 재생).
const pixelCheck = await page.evaluate(async () => {
  // 재생 트리거: enterScreenScr004는 지역함수라 접근 불가하므로, 이미 화면5에
  // 있는 상태에서 스켈레톤 클래스를 직접 다시 걸어 같은 조건을 재현한다.
  const wrap = document.querySelector('.s4-skel-wrap-q');
  const skel = wrap.querySelector('.s4-skel');
  const title = wrap.querySelector('.q-title');
  skel.classList.remove('s4-skel-flash');
  title.classList.remove('s4-in');
  title.style.animation = 'none';
  void title.offsetWidth;
  title.style.animation = '';
  void skel.offsetWidth;
  skel.classList.add('s4-skel-flash');
  await new Promise((r) => setTimeout(r, 250)); // skelFlash 피크(30%=150ms) 근처
  const rect = skel.getBoundingClientRect();
  return { rect, wrapOpacity: getComputedStyle(wrap).opacity, skelOpacity: getComputedStyle(skel).opacity };
});
console.log('\n픽셀 검증 대상 rect(질문 스켈레톤, t=250ms):', pixelCheck.rect, 'wrapOpacity=', pixelCheck.wrapOpacity, 'skelOwnOpacity=', pixelCheck.skelOpacity);
await page.screenshot({
  path: '/tmp/scr004_skel_pixel.png',
  clip: { x: Math.max(0, pixelCheck.rect.x), y: Math.max(0, pixelCheck.rect.y), width: pixelCheck.rect.width, height: pixelCheck.rect.height },
});

await browser.close();
server.close();
console.log('\n스크린샷 저장: /tmp/scr004_skel_pixel.png (python3 PIL로 픽셀 확인)');
