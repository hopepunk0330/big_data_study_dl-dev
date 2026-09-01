import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto('file:///tmp/pd_check.html');
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/pd_check.png', fullPage: true });
const overflow = await page.evaluate(() => {
  return [...document.querySelectorAll('.gbar-label')].map(l => ({text: l.textContent, of: l.scrollWidth > l.clientWidth + 1}));
});
console.log(JSON.stringify(overflow));
await browser.close();
