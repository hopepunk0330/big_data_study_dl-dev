import { chromium } from 'playwright';
import { resolve } from 'path';

const htmlPath = process.argv[2];
const idx = parseInt(process.argv[3], 10);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

const data = await page.evaluate((idx) => {
  const pages = Array.from(document.querySelectorAll('.page'));
  const el = pages[idx];
  const rect = el.getBoundingClientRect();
  const kids = Array.from(el.children).map(c => {
    const r = c.getBoundingClientRect();
    return {
      tag: c.tagName,
      cls: c.className,
      id: c.id,
      top: (r.top - rect.top).toFixed(1),
      bottom: (r.bottom - rect.top).toFixed(1),
      height: r.height.toFixed(1),
      text: (c.textContent || '').trim().slice(0, 50)
    };
  });
  return { pageHeight: rect.height, kids };
}, idx);

console.log('page height:', data.pageHeight);
console.log('budget:', 1122.52, 'over:', (data.pageHeight - 1122.52).toFixed(1));
for (const k of data.kids) {
  console.log(`${k.tag} .${k.cls} #${k.id} top=${k.top} bottom=${k.bottom} h=${k.height} :: ${k.text}`);
}
await browser.close();
