import { chromium } from 'playwright';
import { resolve } from 'path';
const htmlPath = process.argv[2];
const idx = parseInt(process.argv[3],10);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
const data = await page.evaluate((idx) => {
  const pages = Array.from(document.querySelectorAll('.page'));
  const el = pages[idx];
  const svgs = Array.from(el.querySelectorAll('svg')).map(s => {
    const r = s.getBoundingClientRect();
    return { viewBox: s.getAttribute('viewBox'), w: s.getAttribute('width'), h: s.getAttribute('height'), rectW: r.width, rectH: r.height };
  });
  return svgs;
}, idx);
console.log(JSON.stringify(data, null, 2));
await browser.close();
