import { chromium } from 'playwright';

const HTML = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

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

await page.waitForTimeout(300);
const info = await page.evaluate(() => {
  const screenSel = document.querySelector('.pv-screen.active').dataset.screen === '3' ? '#pv2-screen' : '#pv3-screen';
  const badge = document.querySelector(screenSel + ' .p3-progress-badge');
  const row = document.querySelector(screenSel + ' .p3-product-row');
  const badgeSkel = document.querySelector(screenSel + ' .p3-skel-wrap-badge .p3-skel');
  const rowSkel = document.querySelector(screenSel + ' .p3-skel-wrap-row .p3-skel');
  return {
    badgeOpacity: getComputedStyle(badge).opacity,
    rowOpacity: getComputedStyle(row).opacity,
    badgeSkelOpacity: getComputedStyle(badgeSkel).opacity,
    rowSkelOpacity: getComputedStyle(rowSkel).opacity,
  };
});
console.log('reduced-motion 결과(콘텐츠는 opacity 1, 스켈레톤은 opacity 0이어야 정상):', info);
console.log('콘솔/페이지 에러:', consoleErrors.length, consoleErrors);
await browser.close();
