import { chromium } from 'playwright';
import path from 'path';
const filePath = 'file://' + path.resolve('/Users/aydana/dev/portfolio/bigdata/01-ML_mercari price_2608/docs/reports/20260829_가격UX_결과보고서/report.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
await page.goto(filePath, { waitUntil: 'networkidle' });
const pages = await page.$$('.page');
const idx = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  const out = {};
  els.forEach((el, i) => {
    const t = el.textContent;
    if (t.includes('카카오톡 개인 발송') && out.sampling === undefined) out.sampling = i;
    if (t.includes('SHAP') && el.querySelector('svg') && out.shap === undefined) out.shap = i;
  });
  return out;
});
console.log(JSON.stringify(idx));
for (const [k,i] of Object.entries(idx)) {
  await pages[i].screenshot({ path: `/tmp/qa2_${k}.png` });
}
await browser.close();
