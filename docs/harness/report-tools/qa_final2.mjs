import { chromium } from 'playwright';
import path from 'path';
const filePath = 'file://' + path.resolve('/Users/aydana/dev/portfolio/bigdata/01-ML_mercari price_2608/docs/reports/20260829_가격UX_결과보고서/report.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
await page.goto(filePath, { waitUntil: 'networkidle' });
const pages = await page.$$('.page');
console.log('total pages:', pages.length);

const overflow = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('.page').forEach((el, i) => {
    if (el.scrollHeight > el.clientHeight + 2) bad.push(i);
  });
  document.querySelectorAll('pre').forEach((el, i) => {
    if (el.scrollWidth > el.clientWidth + 2) bad.push(`pre${i}`);
  });
  return bad;
});
console.log('overflow issues:', JSON.stringify(overflow));

// find appendix code page again
const idx = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  return els.findIndex(el => el.querySelector('pre'));
});
await pages[idx].screenshot({ path: '/tmp/final_appendix.png' });

// chapter nav pill check
const navIdx = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  return els.findIndex(el => el.querySelector('.chapter-nav'));
});
if (navIdx >= 0) await pages[navIdx].screenshot({ path: '/tmp/final_nav.png' });

// KPI check page 2.1
const kpiIdx = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  return els.findIndex(el => el.textContent.includes('148.2만'));
});
if (kpiIdx >= 0) await pages[kpiIdx].screenshot({ path: '/tmp/final_kpi.png' });

await browser.close();
