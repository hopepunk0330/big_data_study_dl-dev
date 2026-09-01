import { chromium } from 'playwright';
import path from 'path';
const filePath = 'file://' + path.resolve('/Users/aydana/dev/portfolio/bigdata/01-ML_mercari price_2608/docs/reports/20260829_가격UX_결과보고서/report.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
await page.goto(filePath, { waitUntil: 'networkidle' });
const pages = await page.$$('.page');
const idxList = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  const out = [];
  els.forEach((el, i) => { if (el.textContent.includes('부록')) out.push(i); });
  return out;
});
console.log('pages mentioning 부록:', idxList);
for (const i of idxList.slice(0,3)) {
  await pages[i].screenshot({ path: `/tmp/qa_appendix_${i}.png` });
}
await browser.close();
