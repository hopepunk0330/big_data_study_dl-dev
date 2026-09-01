import { chromium } from 'playwright';
import { resolve } from 'path';
const htmlPath = process.argv[2];
const outDir = process.argv[3];
const indices = process.argv.slice(4).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
const pages = await page.$$('.page');
for (const i of indices) {
  const el = pages[i];
  await el.screenshot({ path: `${outDir}/page_${i}.png` });
}
await browser.close();
console.log('done');
