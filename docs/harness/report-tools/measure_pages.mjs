import { chromium } from 'playwright';
import { resolve } from 'path';

const htmlPath = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

const A4_PX = 297 * 96 / 25.4; // 1122.52px

const results = await page.evaluate((budget) => {
  const pages = Array.from(document.querySelectorAll('.page'));
  return pages.map((el, i) => {
    const r = el.getBoundingClientRect();
    return { index: i, height: r.height, over: r.height - budget, id: el.id || null, cls: el.className };
  });
}, A4_PX);

console.log('total .page count:', results.length);
const overs = results.filter(r => r.over > 0);
console.log('over budget (1122.52px) count:', overs.length);
for (const o of overs) {
  console.log(`idx=${o.index} height=${o.height.toFixed(1)}px over=${o.over.toFixed(1)}px cls="${o.cls}"`);
}
await browser.close();
