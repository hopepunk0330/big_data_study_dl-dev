// prefers-reduced-motion: reduce 환경에서도 FN-001 배정 게이팅·순서 반전이
// 정상 동작하는지 확인한다(ab-test-app-workflow.md "reduced-motion 필수 확인").
// 실행: node docs/harness/report-tools/verify_fn001_reducedmotion.mjs <participant-flow HTML 경로>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_fn001_reducedmotion.mjs');
// 이 파일(docs/harness/report-tools/) 기준 상대경로 — 사용자명·프로젝트
// 폴더명이 박힌 절대경로를 하드코딩하지 않는다(data-harness-auditor
// 2026-08-28 지적, 다른 프로젝트로 포크되면 즉시 깨지는 패턴).
const SHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshot');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let counter = 0;
let apiMode = 'ok';
const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/api/participant-number') {
        if (apiMode === 'fail') { res.writeHead(502).end('{}'); return; }
        counter += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ number: counter }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(HTML));
});
await new Promise((r) => server.listen(4322, r));

const results = [];
const check = (name, pass, detail) => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();

// 1) reduced-motion + 카운터 실패 → 버튼이 열려버리지 않아야 한다
{
    counter = 0; apiMode = 'fail';
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4322/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    check('R-1 reduced-motion에서도 배정 전에는 "다음" 비활성',
        await page.locator('#pv1a-next').isDisabled());
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-07-reducedmotion-blocked.png') });

    apiMode = 'ok';
    await page.waitForFunction(() => window.ABSession.isReady(), null, { timeout: 15000 });
    await page.waitForTimeout(200);
    check('R-2 배정 완료 즉시 "다음" 활성(리빌 대기 없이)',
        !(await page.locator('#pv1a-next').isDisabled()));

    // BA(1번) 배정이므로 순서가 뒤집혀야 한다
    const order = await page.evaluate(() => window.ABSession.getOrder());
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(300);
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(400);
    const active = await page.evaluate(() => Number(document.querySelector('.pv-screen.active').dataset.screen));
    check(`R-3 reduced-motion에서도 배정 순서(${order})대로 첫 가격 화면 진입`,
        active === (order === 'BA' ? 4 : 3), `active=${active}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-08-reducedmotion-first-price.png') });
    await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((p) => !p).length;
console.log(`\n${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);
