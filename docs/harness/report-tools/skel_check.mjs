import { chromium } from 'playwright';
const HTML = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
await page.goto('file://' + HTML);
await page.waitForTimeout(200);
// force pv2-screen active and call its internal play() indirectly by simulating goTo(3)
// simplest: directly query the setupPriceScreen instance via exposing pv2Price? Not exposed.
// Instead: just activate the screen class and manually add p3-skel-flash+check computed styles/screenshot.
const info = await page.evaluate(() => {
  document.querySelectorAll('.pv-screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === '3'));
  const screenEl = document.getElementById('pv2-screen');
  const badge = screenEl.querySelector('.p3-progress-badge');
  const skel = screenEl.querySelector('.p3-progress-badge .p3-skel');
  skel.classList.add('p3-skel-flash');
  return { badgeOpacityBefore: getComputedStyle(badge).opacity, skelOpacityAtT0: getComputedStyle(skel).opacity };
});
console.log('t=0', info);
await page.waitForTimeout(250); // mid skelFlash (peak opacity per keyframe 30%=150ms, so 250ms should still be near peak/high)
const mid = await page.evaluate(() => {
  const skel = document.querySelector('#pv2-screen .p3-progress-badge .p3-skel');
  const badge = document.querySelector('#pv2-screen .p3-progress-badge');
  return { skelOpacity: getComputedStyle(skel).opacity, badgeOpacity: getComputedStyle(badge).opacity };
});
console.log('t=250ms computed', mid);
await page.screenshot({ path: '/tmp/skel_mid.png', clip: { x: 0, y: 0, width: 375, height: 300 } });
await browser.close();
