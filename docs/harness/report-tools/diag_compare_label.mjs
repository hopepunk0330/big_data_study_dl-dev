// 진단 전용 1회성 스크립트 — compare-label "A안(단일가)"/"B안(범위)" 폭 확장이
// desktop/mobile 프레임 둘 다에서 잘리거나 줄바꿈되지 않는지 스크린샷으로 확인.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const css = readFileSync('/Users/aydana/dev/portfolio/bigdata/01-ML_mercari price_2608/app/templates/backoffice_style.css', 'utf-8');

function frameHtml(frameClass) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body style="background:#0d0f14;padding:20px;">
<div class="frame ${frameClass}">
  <div class="dashboard">
    <div class="compare-bars">
      <div class="compare-row">
        <span class="compare-label">A안(단일가)</span>
        <div class="compare-track"><div class="compare-fill a" style="width:59.5%"><span>22명</span></div></div>
      </div>
      <div class="compare-row">
        <span class="compare-label">B안(범위)</span>
        <div class="compare-track"><div class="compare-fill b" style="width:40.5%"><span>15명</span></div></div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

const browser = await chromium.launch();
for (const cls of ['desktop', 'mobile']) {
    const page = await browser.newPage({ viewport: { width: cls === 'mobile' ? 400 : 900, height: 260 } });
    await page.setContent(frameHtml(cls));
    await page.waitForTimeout(200);
    const path = `/tmp/compare_label_${cls}.png`;
    await page.screenshot({ path });
    console.log(cls, '->', path);
    const overflow = await page.evaluate(() => {
        const labels = [...document.querySelectorAll('.compare-label')];
        return labels.map((l) => ({ text: l.textContent, scrollWidth: l.scrollWidth, clientWidth: l.clientWidth, overflowing: l.scrollWidth > l.clientWidth + 1 }));
    });
    console.log(cls, JSON.stringify(overflow));
    await page.close();
}
await browser.close();
