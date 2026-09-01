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
    if (t.includes('편의표집') && out.sampling === undefined) out.sampling = i;
    if (t.includes('SHAP') && t.includes('중요도') && out.shap === undefined) out.shap = i;
    if (t.includes('모델 비교') && out.modelcomp === undefined) out.modelcomp = i;
  });
  return out;
});
console.log(JSON.stringify(idx));
for (const [k,i] of Object.entries(idx)) {
  await pages[i].screenshot({ path: `/tmp/qa_${k}.png` });
}
await browser.close();
