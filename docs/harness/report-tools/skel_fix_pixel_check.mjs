import { chromium } from 'playwright';
import fs from 'fs';

const HTML = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('file://' + HTML);

await page.waitForFunction(() => {
  const btn = document.getElementById('pv1a-next');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#pv1a-next');

await page.waitForFunction(() => {
  const btn = document.getElementById('pv1b-cta');
  return btn && !btn.disabled;
}, { timeout: 15000 });
await page.click('#pv1b-cta');

await page.waitForFunction(() => {
  const active = document.querySelector('.pv-screen.active');
  return active && (active.dataset.screen === '3' || active.dataset.screen === '4');
}, { timeout: 15000 });

const screenNo = await page.evaluate(() => document.querySelector('.pv-screen.active').dataset.screen);
const screenSel = screenNo === '3' ? '#pv2-screen' : '#pv3-screen';
console.log('가격 화면 진입, data-screen =', screenNo, 'screenSel =', screenSel);

// t=0(진입 직후) 부터 250ms(배지 스켈레톤 flash 중간 지점) 시점에 스크린샷 +
// bounding box를 함께 저장 — 배지 flash는 0~500ms 구간.
await page.waitForTimeout(250);
const badgeBox = await page.evaluate((sel) => {
  const el = document.querySelector(sel + ' .p3-skel-wrap-badge .p3-skel');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, opacity: getComputedStyle(el).opacity };
}, screenSel);
console.log('t=250ms badge skel rect+opacity', badgeBox);
await page.screenshot({ path: '/tmp/skel_badge_250ms.png' });

// t=800ms 시점(상품행 flash는 550~1050ms 구간, 800ms는 중간)
await page.waitForTimeout(550);
const rowBox = await page.evaluate((sel) => {
  const el = document.querySelector(sel + ' .p3-skel-wrap-row .p3-skel');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height, opacity: getComputedStyle(el).opacity };
}, screenSel);
console.log('t=800ms row skel rect+opacity', rowBox);
await page.screenshot({ path: '/tmp/skel_row_800ms.png' });

fs.writeFileSync('/tmp/skel_boxes.json', JSON.stringify({ badgeBox, rowBox, screenSel }, null, 2));

await browser.close();
