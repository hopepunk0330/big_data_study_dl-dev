// SCR-002/003 진입 애니메이션 절대 타이밍 실측(2026-08-28, 7차 재작업 —
// 진입 여백 100ms→0ms) — MutationObserver로 p3-in/p3-skel-flash 부여 순간을
// 정밀 관측한다. 실제 참여자 플로우(화면1→화면3/4)를 그대로 클릭해서 진입한다
// (play()는 goTo()의 n===3/4 분기에서 자동 호출되는 지역 클로저라 직접 접근이
// 안 되므로, 실제 클릭으로 그 분기를 자연스럽게 태운다).
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 5000 });
await page.waitForTimeout(2600);
await page.locator('#pv1a-next').click();
await page.waitForTimeout(1400 + 5400);

// 관찰자를 pv1b-cta 클릭(첫 가격 화면 진입 트리거) 직전에 설치한다.
await page.evaluate(() => {
  window.__events = [];
  // t0 = 실제로 화면(.pv-screen)이 'active'가 되는 순간(=goTo() 내부에서
  // play()가 호출되는 바로 그 시점) — 클릭 시각이 아니라 이 시점을 기준으로
  // 삼아야 "AI 매칭중…" 토스트 대기(약 2.3s)가 측정값에 섞이지 않는다.
  window.__t0 = null;
  const pvScreenObs = new MutationObserver((muts) => {
    if (window.__t0 != null) return;
    muts.forEach((m) => {
      const el = m.target;
      if (el.classList.contains('pv-screen') && el.classList.contains('active')
          && (el.dataset.screen === '3' || el.dataset.screen === '4')) {
        window.__t0 = performance.now();
      }
    });
  });
  pvScreenObs.observe(document.querySelector('.proto-frame-outer') || document.body,
    { subtree: true, attributes: true, attributeFilter: ['class'] });
  window.__pvScreenObs = pvScreenObs;

  const obs = new MutationObserver((muts) => {
    const now = performance.now();
    muts.forEach((m) => {
      if (m.attributeName !== 'class') return;
      const el = m.target;
      const cls = el.className;
      if (window.__t0 == null) return;
      const t = now - window.__t0;
      if (cls.indexOf('p3-in') !== -1 && !el.__loggedIn) {
        el.__loggedIn = true;
        window.__events.push({ t, type: 'content', tag: el.className.split(' ').filter((c) => c.indexOf('p3-') === 0)[0] });
      }
      if (cls.indexOf('p3-skel-flash') !== -1 && !el.__loggedSkel) {
        el.__loggedSkel = true;
        const parentSkelHost = el.parentElement;
        window.__events.push({ t, type: 'skel', tag: parentSkelHost ? parentSkelHost.className.split(' ').filter((c) => c.indexOf('p3-') === 0)[0] : '?' });
      }
    });
  });
  // pv2-screen·pv3-screen 둘 다 관찰(BA/AB 배정에 따라 어느 쪽이 먼저 나올지 모름)
  const s2 = document.getElementById('pv2-screen');
  const s3 = document.getElementById('pv3-screen');
  obs.observe(s2, { subtree: true, attributes: true, attributeFilter: ['class'] });
  obs.observe(s3, { subtree: true, attributes: true, attributeFilter: ['class'] });
  window.__obs = obs;
});

await page.locator('#pv1b-cta').click();
await page.waitForTimeout(4600);

const events = await page.evaluate(() => window.__events);
events.sort((a, b) => a.t - b.t);
console.log('실측 이벤트(t=ms, "AI 매칭중…" 토스트 트리거 클릭 시각 기준 — 실제 화면 진입은 그 직후):');
events.forEach((e) => console.log(`  ${e.t.toFixed(1)}ms  ${e.type}  ${e.tag}`));

const firstContentT = events.find((e) => e.type === 'content');
console.log(`\n첫 콘텐츠 등장까지: ${firstContentT ? firstContentT.t.toFixed(1) : 'N/A'}ms`);

await browser.close();
server.close();
