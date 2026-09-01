import { chromium } from 'playwright';
import path from 'path';

const REPORT = '/Users/aydana/dev/portfolio/bigdata/01-ML_mercari price_2608/docs/reports/20260829_가격UX_결과보고서/report.html';
const OUT = '/private/tmp/claude-501/-Users-aydana-dev-portfolio-bigdata-01-ML-mercari-price-2608/d056a67f-f716-4b00-a7c6-8d6cbcc6c31f/scratchpad';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
await page.goto('file://' + REPORT);

// find ch8 heading and all pages from #ch8 to #ch9
const result = await page.evaluate(() => {
  const ch8 = document.getElementById('ch8');
  const ch9 = document.getElementById('ch9');
  const pages = Array.from(document.querySelectorAll('.page'));
  let started = false;
  const idxs = [];
  pages.forEach((p, i) => {
    if (p.contains(ch8) || (started && !p.contains(ch9))) {
      started = true;
      idxs.push(i);
    }
    if (p.contains(ch9)) started = false;
  });
  return { total: pages.length, idxs };
});
console.log('total pages:', result.total, 'ch8 page indices:', result.idxs);

const pages = await page.$$('.page');
for (const i of result.idxs) {
  const el = pages[i];
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: `${OUT}/ch8_page_${i}.png` });
}
console.log('done, screenshots at', OUT);
await browser.close();
