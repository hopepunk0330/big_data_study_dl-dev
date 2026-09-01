import { chromium } from 'playwright';
import path from 'path';

const filePath = 'file://' + path.resolve('/Users/aydana/dev/portfolio/bigdata/01-ML_mercari price_2608/docs/reports/20260829_가격UX_결과보고서/report.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
await page.goto(filePath, { waitUntil: 'networkidle' });

const pages = await page.$$('.page');
console.log('total .page elements:', pages.length);

// overflow check
const overflowing = await page.evaluate(() => {
  const els = document.querySelectorAll('.page');
  const bad = [];
  els.forEach((el, i) => {
    if (el.scrollHeight > el.clientHeight + 2) {
      bad.push({ index: i, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    }
  });
  return bad;
});
console.log('pages with scrollHeight > clientHeight:', JSON.stringify(overflowing));

// screenshot cover, toc, a body chart page, appendix code page
await pages[0].screenshot({ path: '/tmp/qa_00_cover.png' });
await pages[1].screenshot({ path: '/tmp/qa_01_toc.png' });

// find appendix page containing <pre>
const appendixIdx = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  return els.findIndex(el => el.querySelector('pre'));
});
console.log('first appendix/code page index:', appendixIdx);
if (appendixIdx >= 0) await pages[appendixIdx].screenshot({ path: '/tmp/qa_02_code.png' });

// find a page with an svg chart (not cover/toc)
const chartIdx = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('.page'));
  return els.findIndex((el, i) => i > 2 && el.querySelector('svg, img'));
});
console.log('first chart page index:', chartIdx);
if (chartIdx >= 0) await pages[chartIdx].screenshot({ path: '/tmp/qa_03_chart.png' });

await browser.close();
