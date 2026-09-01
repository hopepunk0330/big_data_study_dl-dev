import { chromium } from 'playwright';
const HTML = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
await page.goto('file://' + HTML);
await page.waitForTimeout(200);
const rect = await page.evaluate(() => {
  document.querySelectorAll('.pv-screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === '3'));
  const screenEl = document.getElementById('pv2-screen');
  const badge = screenEl.querySelector('.p3-progress-badge');
  const skel = screenEl.querySelector('.p3-progress-badge .p3-skel');
  skel.classList.add('p3-skel-flash');
  const r = badge.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
console.log('rect', rect);
await page.waitForTimeout(250);
await page.screenshot({ path: '/tmp/skel_mid2.png', clip: { x: Math.max(0,rect.x-10), y: Math.max(0,rect.y-10), width: rect.width+40, height: rect.height+20 } });
await browser.close();
