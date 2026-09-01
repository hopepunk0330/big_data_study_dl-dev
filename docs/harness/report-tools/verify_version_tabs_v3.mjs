// artifact-version-tabs.html에 새로 추가된 v3 탭이 정상 렌더·전환되는지 확인한다.
// 실행: node docs/harness/report-tools/verify_version_tabs_v3.mjs <artifact-version-tabs.html 경로>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_version_tabs_v3.mjs', 'artifact-version-tabs.html');
const target = 'file://' + HTML;
const SHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshot');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));

await page.goto(target, { waitUntil: 'load' });
await page.waitForTimeout(800);

// 탭 3개(v1/v2/v3) 라벨이 실제로 보이는지
const labels = await page.locator('.tab-btn').allTextContents();
console.log('tab labels:', labels.map(s => s.trim()));

// v3 탭 클릭
await page.locator('#tabBtnV3').click();
await page.waitForTimeout(700);
const note = await page.locator('#versionNote').textContent();
console.log('version note after v3 click:', note);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABSv3-01-v3-active.png') });

const v3Frame = page.frameLocator('#frameV3');
const bodyClasses = await v3Frame.locator('body').evaluate(el => el.className);
console.log('V3 body classes (should NOT include proto-only-mode):', bodyClasses);
const headerVisible = await v3Frame.locator('header.intro').first().isVisible();
const galleryVisible = await v3Frame.locator('#gallery').first().isVisible();
console.log('V3 header visible:', headerVisible, 'gallery visible:', galleryVisible);

// 프로토타입 뷰어 섹션으로 스크롤 후 캡처
await v3Frame.locator('.eyebrow', { hasText: '02 · Prototype' }).scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABSv3-02-viewer-section.png') });

const frameEl = await page.$('#frameV3');
const frame = await frameEl.contentFrame();
await page.waitForTimeout(300);
const abState = await frame.evaluate(() => ({
  ready: window.ABSession ? window.ABSession.isReady() : null,
  error: window.ABSession ? window.ABSession.hasError() : null,
  endpointOverride: window.AB_COUNTER_ENDPOINT,
}));
console.log('AB state right after v3 activation:', abState);

await page.waitForTimeout(2600);
const ctaState = await frame.evaluate(() => {
  var btn = document.getElementById('pv1a-next');
  return btn ? { disabled: btn.disabled, text: btn.textContent } : null;
});
console.log('pv1a-next CTA state in v3 after reveal wait:', ctaState);

if (ctaState && !ctaState.disabled) {
  await frame.click('#pv1a-next');
  await page.waitForTimeout(1500);
  const screen2active = await frame.evaluate(() => {
    var el = document.querySelector('.pv-screen[data-screen="2"]');
    return el ? el.classList.contains('active') : null;
  });
  console.log('after clicking pv1a-next in v3 -> screen2 active:', screen2active);
  await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABSv3-03-screen2.png') });
}

// v1으로 돌아가도 여전히 정상인지(회귀 확인)
await page.locator('#tabBtnOld').click();
await page.waitForTimeout(400);
const oldFrame = page.frameLocator('#frameOld');
const oldHeaderVisible = await oldFrame.locator('header.intro').first().isVisible();
console.log('v1 tab still visible/intact after v3 round-trip:', oldHeaderVisible);

// v2로도 여전히 정상인지(회귀 확인)
await page.locator('#tabBtnNew').click();
await page.waitForTimeout(400);
const newFrame = page.frameLocator('#frameNew');
const newHeaderVisible = await newFrame.locator('header.intro').first().isVisible();
console.log('v2 tab still visible/intact after v3 round-trip:', newHeaderVisible);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABSv3-04-back-to-v2.png') });

console.log('\nERRORS:', errors.length ? errors : 'NONE');
await browser.close();
