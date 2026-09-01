// 버전 탭 아티팩트(artifact-version-tabs.html)가 탭 전환 후에도 각 버전의
// 화면·프로토타입 뷰어를 정상 렌더하는지 확인한다.
// 실행: node docs/harness/report-tools/verify_version_tabs.mjs <artifact-version-tabs.html 경로>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_version_tabs.mjs', 'artifact-version-tabs.html');
const target = 'file://' + HTML;
// 이 파일(docs/harness/report-tools/) 기준 상대경로 — 사용자명·프로젝트
// 폴더명이 박힌 절대경로를 하드코딩하지 않는다(data-harness-auditor
// 2026-08-28 지적, 다른 프로젝트로 포크되면 즉시 깨지는 패턴).
const SHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshot');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));

await page.goto(target, { waitUntil: 'load' });
await page.waitForTimeout(1000);

await page.locator('#tabBtnNew').click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABS-06-new-fixed-top.png') });

const newFrame = page.frameLocator('#frameNew');
const bodyClasses = await newFrame.locator('body').evaluate(el => el.className);
console.log('NEW body classes (should NOT include proto-only-mode):', bodyClasses);

const headerVisible = await newFrame.locator('header.intro').first().isVisible();
const galleryVisible = await newFrame.locator('#gallery').first().isVisible();
console.log('NEW header visible:', headerVisible, 'gallery visible:', galleryVisible);

// 프로토타입 뷰어 섹션까지 스크롤
await newFrame.locator('.eyebrow', { hasText: '02 · Prototype' }).scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABS-07-new-viewer-section.png') });

// pv1a-next 버튼 상태/클릭 흐름 확인
const frameEl = await page.$('#frameNew');
const frame = await frameEl.contentFrame();
await frame.waitForTimeout ? null : null;
await page.waitForTimeout(300);
const abState = await frame.evaluate(() => ({
  ready: window.ABSession ? window.ABSession.isReady() : null,
  error: window.ABSession ? window.ABSession.hasError() : null,
  endpointOverride: window.AB_COUNTER_ENDPOINT,
}));
console.log('AB state right after new tab activation:', abState);

// 리빌 애니메이션 대기 후 CTA 확인
await page.waitForTimeout(2600);
const ctaState = await frame.evaluate(() => {
  var btn = document.getElementById('pv1a-next');
  return btn ? { disabled: btn.disabled, text: btn.textContent } : null;
});
console.log('pv1a-next CTA state after reveal wait:', ctaState);

if (ctaState && !ctaState.disabled) {
  await frame.click('#pv1a-next');
  await page.waitForTimeout(1500);
  const screen2active = await frame.evaluate(() => {
    var el = document.querySelector('.pv-screen[data-screen="2"]');
    return el ? el.classList.contains('active') : null;
  });
  console.log('after clicking pv1a-next -> screen2 active:', screen2active);
  await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABS-08-new-viewer-screen2.png') });
}

// 이전 버전으로 다시 전환 -> 여전히 동작하는지(회귀 확인)
await page.locator('#tabBtnOld').click();
await page.waitForTimeout(400);
const oldFrame = page.frameLocator('#frameOld');
const oldHeaderVisible = await oldFrame.locator('header.intro').first().isVisible();
console.log('OLD tab still visible/intact after switching back:', oldHeaderVisible);
await page.screenshot({ path: path.join(SHOT_DIR, 'verify-TABS-09-back-old-again.png') });

console.log('\nERRORS:', errors.length ? errors : 'NONE');
await browser.close();
