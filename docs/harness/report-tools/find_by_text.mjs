import { chromium } from 'playwright';
import { resolve } from 'path';
const htmlPath = process.argv[2];
const needle = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
const result = await page.evaluate((needle) => {
  const pages = Array.from(document.querySelectorAll('.page'));
  const matches = [];
  pages.forEach((p, i) => {
    if (p.textContent.includes(needle)) {
      const r = p.getBoundingClientRect();
      matches.push({ i, height: r.height });
    }
  });
  return matches;
}, needle);
console.log(JSON.stringify(result));
await browser.close();
