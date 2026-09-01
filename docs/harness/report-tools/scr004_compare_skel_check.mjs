// SCR-004 compare-grid(A/B 비교카드) 스켈레톤 실측 — 수정 전/후 공용
// 사용: node scr004_compare_skel_check.mjs <label> <participant-flow HTML 경로>
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireHtmlArg, startServer, activeScreen, enterFirstPriceScreen, advancePastPriceScreen } from './_flow_helpers.mjs';

const label = process.argv[2] || 'before';
const HTML = requireHtmlArg(process.argv[3], 'scr004_compare_skel_check.mjs <label> <html경로>');
const { server, BASE } = await startServer(HTML);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const { screenNum: first, errors } = await enterFirstPriceScreen(page, BASE);
await advancePastPriceScreen(page, first);

const second = await activeScreen(page);
// 두 번째 화면 CTA 클릭 뒤에는 900ms가 아니라 200ms만 기다린다(원본 설계 —
// SCR-004 진입 직후 스켈레톤 타이밍을 관찰하는 게 이 스크립트의 목적이라,
// 다른 스크립트처럼 화면 전환이 다 안정될 때까지 기다리면 관찰 시작점을 놓친다).
await advancePastPriceScreen(page, second, 200);

const scr4 = await activeScreen(page);
console.log('SCR-004 진입:', scr4 === 5);

// compare-grid 블록 스켈레톤은 550ms 시점에 flash 시작(설계값) — 그 전후로 측정
const outDir = path.dirname(fileURLToPath(import.meta.url));
const waits = [200, 200, 200, 200]; // 누적 400/600/800/1000ms 지점
const shotTimes = [];
let elapsed = 200;
for (let i = 0; i < waits.length; i++) {
  await page.waitForTimeout(waits[i]);
  elapsed += waits[i];
  shotTimes.push(elapsed);
  const gridBox = await page.locator('#pv4-options').boundingBox().catch(() => null);
  const wrapBox = await page.locator('.s4-skel-wrap-grid').boundingBox().catch(() => null);
  const skelBoxes = await page.locator('.s4-skel-wrap-grid .s4-skel, .s4-skel-wrap-grid .s4-skel-card').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { class: el.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), opacity: cs.opacity };
    })
  );
  console.log(`t=${elapsed}ms gridBox=${JSON.stringify(gridBox)} wrapBox=${JSON.stringify(wrapBox)}`);
  console.log(`  skel elements:`, JSON.stringify(skelBoxes));
  const shotPath = path.join(outDir, `scr004_compare_skel_${label}_t${elapsed}.png`);
  await page.locator('.pv-phone').first().screenshot({ path: shotPath }).catch(async () => {
    await page.screenshot({ path: shotPath });
  });
}

console.log('errors:', errors);
await browser.close();
server.close();
