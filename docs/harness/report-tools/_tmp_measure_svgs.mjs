import { chromium } from 'playwright';
import { resolve } from 'path';

const htmlPath = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });

const data = await page.evaluate(() => {
  const svgs = Array.from(document.querySelectorAll('svg'));
  const results = [];
  svgs.forEach((svg, i) => {
    const vb = svg.getAttribute('viewBox');
    if (!vb) return;
    const parts = vb.trim().split(/\s+/).map(Number);
    const [vx, vy, vw, vh] = parts;
    if (vw < 100) return; // skip tiny decorative icons/arrows
    let bbox;
    try {
      bbox = svg.getBBox();
    } catch (e) {
      bbox = null;
    }
    // Find nearest heading before this svg for identification
    let node = svg.closest('.inline-fig') || svg.parentElement;
    let context = '';
    let cur = svg;
    for (let hop = 0; hop < 8 && cur; hop++) {
      cur = cur.previousElementSibling || (cur.parentElement ? cur.parentElement.previousElementSibling : null);
      if (cur && /^H[1-6]$/.test(cur.tagName)) { context = cur.textContent.trim(); break; }
    }
    if (!context) {
      // walk up dom tree to find preceding heading
      let anchor = node;
      while (anchor && anchor !== document.body) {
        let sib = anchor.previousElementSibling;
        while (sib) {
          if (/^H[1-6]$/.test(sib.tagName)) { context = sib.textContent.trim(); break; }
          sib = sib.previousElementSibling;
        }
        if (context) break;
        anchor = anchor.parentElement;
      }
    }
    const rightPct = bbox ? ((bbox.x + bbox.width - vx) / vw * 100) : null;
    const leftPct = bbox ? ((bbox.x - vx) / vw * 100) : null;
    results.push({
      index: i,
      viewBox: vb,
      bbox: bbox ? { x: +bbox.x.toFixed(1), width: +bbox.width.toFixed(1) } : null,
      rightPct: rightPct !== null ? +rightPct.toFixed(1) : null,
      leftPct: leftPct !== null ? +leftPct.toFixed(1) : null,
      context,
    });
  });
  return results;
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
