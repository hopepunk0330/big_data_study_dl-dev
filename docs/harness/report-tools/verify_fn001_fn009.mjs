// FN-001(블록 랜덤화)·FN-009(품목 배정) 참여자 화면 통합 검증.
// 실행: node docs/harness/report-tools/verify_fn001_fn009.mjs <participant-flow HTML 경로>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg, activeScreen, revealDecision } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_fn001_fn009.mjs');
// 이 파일(docs/harness/report-tools/) 기준 상대경로 — 사용자명·프로젝트
// 폴더명이 박힌 절대경로를 하드코딩하지 않는다(data-harness-auditor
// 2026-08-28 지적, 다른 프로젝트로 포크되면 즉시 깨지는 패턴).
const SHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshot');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let counter = 0;
let apiMode = 'ok'; // 'ok' | 'fail'

const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/api/participant-number') {
        if (apiMode === 'fail') {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'stub failure' }));
            return;
        }
        counter += 1;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ number: counter }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(HTML));
});
await new Promise((r) => server.listen(4321, r));
const BASE = 'http://127.0.0.1:4321/';

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch();

async function newSession() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const requests = [];
    page.on('request', (r) => { if (r.url().includes('participant-number')) requests.push(r.method()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    return { ctx, page, requests };
}

function stored(page) {
    return page.evaluate(() => ({
        order: sessionStorage.getItem('ab_assigned_order'),
        item: sessionStorage.getItem('ab_item_variant'),
        number: sessionStorage.getItem('ab_participant_number'),
        ready: window.ABSession.isReady(),
    }));
}

// ---------------------------------------------------------------- 1. 정상 배정
{
    counter = 0; apiMode = 'ok';
    const { ctx, page, requests } = await newSession();
    await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 5000 });
    const s = await stored(page);
    check('1-1 서버 카운터를 POST로 1회 호출', requests.length === 1 && requests[0] === 'POST', JSON.stringify(requests));
    check('1-2 order/item/number가 sessionStorage에 저장', s.order === 'BA' && ['1', '2', '3'].includes(s.item) && s.number === '1', JSON.stringify(s));

    // 새로고침해도 카운터를 다시 호출하지 않고 같은 값 유지
    const before = s;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ABSession && window.ABSession.isReady());
    const after = await stored(page);
    check('1-3 새로고침 시 재호출 없이 order·품목 고정',
        requests.length === 1 && after.order === before.order && after.item === before.item,
        `요청 ${requests.length}회, ${before.order}/${before.item} → ${after.order}/${after.item}`);

    await page.waitForTimeout(2600);
    check('1-4 배정 완료 후 "다음" 활성화', !(await page.locator('#pv1a-next').isDisabled()));
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-01-scr001-1-assigned.png') });
    await ctx.close();
}

// ------------------------------------------- 2. BA 배정 시 실제 노출 순서가 뒤집힌다
{
    counter = 0; apiMode = 'ok';
    const { ctx, page } = await newSession();
    await page.waitForFunction(() => window.ABSession.isReady());
    check('2-0 참여자 1번은 BA 배정', (await stored(page)).order === 'BA');

    await page.waitForTimeout(2600);
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(1400);          // SCR-001-1 토스트 → SCR-001-2
    await page.waitForTimeout(5400);          // SCR-001-2 CTA 활성화 대기
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(2300);          // 토스트 → 첫 가격 화면
    const first = await activeScreen(page);
    check('2-1 BA면 B안(범위) 화면(4번)이 먼저 나온다', first === 4, `active=${first}`);
    const num1 = await page.locator('#pv3-screen .p3-progress-num b').textContent();
    check('2-2 먼저 나온 화면의 진행 표시가 1', num1.trim() === '1', num1);
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-02-ba-first-screen.png') });

    // 첫 화면에서 결정 영역을 펼치고 "다음 보기"
    await revealDecision(page, '#pv3-screen');
    await page.locator('#pv3-screen .p3-choice.yes').click();
    await page.waitForTimeout(400);
    await page.locator('#pv3-screen .p3-cta').click();
    await page.waitForTimeout(900);
    const second = await activeScreen(page);
    check('2-3 두 번째로 A안(단일가) 화면(3번)으로 간다', second === 3, `active=${second}`);
    const num2 = await page.locator('#pv2-screen .p3-progress-num b').textContent();
    check('2-4 두 번째 화면의 진행 표시가 2', num2.trim() === '2', num2);
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-03-ba-second-screen.png') });

    await revealDecision(page, '#pv2-screen');
    await page.locator('#pv2-screen .p3-choice.no').click();
    await page.waitForTimeout(400);
    await page.locator('#pv2-screen .p3-price-input input').fill('50000');
    await page.locator('#pv2-screen .p3-cta').click();
    await page.waitForTimeout(900);
    check('2-5 두 번째 가격 화면 다음은 SCR-004(5번)', (await activeScreen(page)) === 5, `active=${await activeScreen(page)}`);

    // FN-003 레코드 — order가 실제 노출 순서(BA)와 일치하는지
    const posted = [];
    page.on('request', (r) => { if (r.url().includes('amplitude')) posted.push(r); });
    await page.locator('#pv4-options .compare-card[data-option="B"]').click();
    await page.locator('#pv4-reasons .reason-row[data-reason="r1"]').click();
    await page.locator('#pv4-submit').click();
    await page.waitForTimeout(1200);
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ab_last_record')));
    check('2-6 FN-003 레코드의 order가 배정값 BA와 일치', record.order === 'BA', JSON.stringify(record.order));
    check('2-7 FN-003 레코드의 item_variant가 배정값과 일치',
        String(record.item_variant) === (await stored(page)).item, `${record.item_variant}`);
    check('2-8 수용도 값이 실제 화면 순서대로 기록(B=수용, A=비수용)',
        record.b_accept === true && record.a_accept === false && record.a_custom_price === 50000,
        JSON.stringify({ a: record.a_accept, b: record.b_accept, ap: record.a_custom_price }));
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-04-scr005-submitted.png') });
    await ctx.close();
}

// ------------------------------------------------ 3. AB 배정 시 기존 순서 그대로
{
    counter = 2; apiMode = 'ok'; // 다음 호출은 3번 → AB
    const { ctx, page } = await newSession();
    await page.waitForFunction(() => window.ABSession.isReady());
    check('3-0 참여자 3번은 AB 배정', (await stored(page)).order === 'AB');
    await page.waitForTimeout(2600);
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(1400);
    await page.waitForTimeout(5400);
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(2300);
    check('3-1 AB면 A안(단일가) 화면(3번)이 먼저 나온다', (await activeScreen(page)) === 3, `active=${await activeScreen(page)}`);
    const n1 = await page.locator('#pv2-screen .p3-progress-num b').textContent();
    const n2 = await page.locator('#pv3-screen .p3-progress-num b').textContent();
    check('3-2 진행 표시가 A=1, B=2', n1.trim() === '1' && n2.trim() === '2', `${n1}/${n2}`);
    await ctx.close();
}

// ------------------------------------------------------- 4. 카운터 실패 → 재시도
{
    counter = 10; apiMode = 'fail';
    const { ctx, page } = await newSession();
    await page.waitForTimeout(2900);
    const disabled = await page.locator('#pv1a-next').isDisabled();
    const toast = (await page.locator('#pv1a-toast').textContent()).trim();
    const toastShown = await page.locator('#pv1a-toast').evaluate((el) => el.classList.contains('show'));
    check('4-1 카운터 실패 시 "다음" 비활성 유지', disabled);
    check('4-2 "잠시 후 다시 시도해주세요" 안내 노출', toastShown && toast === '잠시 후 다시 시도해주세요', toast);
    check('4-3 배정 전에는 sessionStorage에 아무것도 안 쓴다', (await stored(page)).order === null);
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-05-counter-error.png') });

    apiMode = 'ok'; // 복구되면 자동 재시도가 성공해야 한다
    await page.waitForFunction(() => window.ABSession.isReady(), null, { timeout: 15000 });
    await page.waitForTimeout(300);
    check('4-4 복구 후 자동 재시도로 배정 완료 + "다음" 자동 활성화',
        !(await page.locator('#pv1a-next').isDisabled()) && (await stored(page)).number === '11',
        JSON.stringify(await stored(page)));
    const toastAfter = await page.locator('#pv1a-toast').evaluate((el) => el.classList.contains('show'));
    check('4-5 복구 후 안내 토스트 사라짐', !toastAfter);
    await page.screenshot({ path: path.join(SHOT_DIR, 'fn001-06-counter-recovered.png') });
    await ctx.close();
}

// --------------------------------- 5. file:// 미리보기(서버 없음)에서도 흐름 유지
{
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const netCalls = [];
    page.on('request', (r) => { if (r.url().includes('participant-number')) netCalls.push(r.url()); });
    await page.goto('file://' + HTML, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 5000 });
    const s = await stored(page);
    check('5-1 file:// 미리보기는 네트워크 호출 없이 로컬 순번으로 배정',
        netCalls.length === 0 && ['AB', 'BA'].includes(s.order), JSON.stringify(s));
    await page.waitForTimeout(2600);
    check('5-2 미리보기에서도 "다음"이 활성화돼 검토 흐름이 막히지 않음', !(await page.locator('#pv1a-next').isDisabled()));
    await ctx.close();
}

// ---------------------------------- 6. 품목 배정이 세 값에 고르게 퍼지는지(브라우저)
{
    counter = 0; apiMode = 'ok';
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const dist = await page.evaluate(() => {
        const c = { 1: 0, 2: 0, 3: 0 };
        for (let i = 0; i < 6000; i += 1) c[window.ABAssign.assignItemVariant()] += 1;
        return c;
    });
    const ok = Object.values(dist).every((v) => v > 1800 && v < 2200);
    check('6-1 브라우저 런타임에서도 품목 3종 균등 배정', ok, JSON.stringify(dist));

    const blocks = await page.evaluate(() => {
        const out = [];
        for (let n = 1; n <= 400; n += 1) out.push(window.ABAssign.assignOrder(n));
        return out;
    });
    let balanced = true;
    for (let i = 0; i < blocks.length; i += 4) {
        if (blocks.slice(i, i + 4).filter((o) => o === 'AB').length !== 2) balanced = false;
    }
    check('6-2 브라우저 런타임에서도 4명마다 2:2 블록 균형', balanced);
    await ctx.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
