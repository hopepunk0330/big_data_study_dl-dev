// 품목 3종 콘텐츠(상품명·카테고리·KRW 가격·사진) + 사진 슬롯 랜덤 배정 통합 검증.
// 근거: 06_기능정의서_화면정의서 v1.43 0절·0.1절, 05_실험설계서 v1.13.
// 실행: node docs/harness/report-tools/verify_item_content.mjs <participant-flow HTML 경로>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg, revealDecision } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_item_content.mjs');
// 이 파일(docs/harness/report-tools/) 기준 상대경로 — 사용자명·프로젝트
// 폴더명이 박힌 절대경로를 하드코딩하지 않는다(data-harness-auditor
// 2026-08-28 지적, 다른 프로젝트로 포크되면 즉시 깨지는 패턴).
const SHOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshot');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let counter = 0;
const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/api/participant-number') {
        counter += 1;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ number: counter }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(HTML));
});
await new Promise((r) => server.listen(4322, r));
const BASE = 'http://127.0.0.1:4322/';

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// 06_기능정의서_화면정의서 v1.43 0절 표 + 이번에 확정한 KRW 환산값
const EXPECTED = {
    1: { name: '나이키 에어맥스 운동화', cat: 'Nike · Shoes/Athletic', noun: '신발', comps: '14,262건', a: '60,000원', b: '51,000~69,000원' },
    2: { name: '마리오카트 8 디럭스', cat: 'Nintendo · Video Games', noun: '게임', comps: '26,547건', a: '24,000원', b: '15,000~42,000원' },
    3: { name: 'Beats by Dre Studio Headphones', cat: 'Beats · Headphones', noun: '헤드폰', comps: '4,682건', a: '36,000원', b: '16,000~93,000원' },
};

const browser = await chromium.launch();

/** 배정값을 미리 심어둔 세션을 연다(서버 카운터를 안 거치고 restore() 경로로 들어간다). */
async function seededSession({ order, item, photoFirst }) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript(([o, i, p]) => {
        sessionStorage.setItem('ab_assigned_order', o);
        sessionStorage.setItem('ab_item_variant', String(i));
        sessionStorage.setItem('ab_photo_slot', String(p));
        sessionStorage.setItem('ab_participant_number', '1');
    }, [order, item, photoFirst]);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 5000 });
    return { ctx, page };
}

/** CSS background-image / <img src>에서 data URL을 뽑아 짧은 해시로 비교 가능하게 만든다. */
function digest(url) {
    if (!url) return null;
    const m = String(url).match(/base64,([A-Za-z0-9+/=]+)/);
    if (!m) return null;
    return crypto.createHash('sha1').update(m[1]).digest('hex').slice(0, 12);
}

async function screenInfo(page, screenId) {
    return page.evaluate((id) => {
        const s = document.querySelector(id);
        const bg = getComputedStyle(s.querySelector('.p3-photo')).backgroundImage;
        return {
            name: s.querySelector('.p3-product-text .name').textContent.trim(),
            cat: s.querySelector('.p3-product-text .cat').textContent.trim(),
            headline: s.querySelector('.p3-headline .l1').textContent.trim(),
            comps: s.querySelector('.p3-trust-badge .cnt').textContent.trim(),
            photo: bg,
            thumb: getComputedStyle(s.querySelector('.p3-thumb'), '::before').backgroundImage,
            price: Array.from(s.querySelectorAll('.p3-price-num')).map((el) => el.textContent.trim()),
        };
    }, screenId);
}

/** 히어로 가격은 0에서부터 카운트업으로 올라간다 — 값이 멈출 때까지 기다린다. */
async function waitPriceSettled(page, screenId) {
    const read = () => page.evaluate(
        (id) => Array.from(document.querySelectorAll(id + ' .p3-price-num')).map((el) => el.textContent.trim()).join('/'),
        screenId,
    );
    // 범위가(B안)는 1,000원 단위 스텝 카운트업이라, cubic ease-out 꼬리에서
    // 마지막 스텝(예: 41,000 -> 42,000)이 900ms x 약 28.8% = 약 260ms 머문다 —
    // 250ms 간격으로 두 번만 같으면 확정하던 기존 방식은 그 중간값을 "멈춘 값"
    // 으로 오판할 수 있었다(실측 플레이키: 품목 2가 15,000~41,000으로 읽힘).
    // 연속 3회(약 750ms) 동일할 때만 확정해 그 체류 시간보다 넉넉히 길게 본다.
    const STABLE_TICKS = 3;
    let prev = await read();
    let stable = 0;
    for (let i = 0; i < 40; i += 1) {
        await page.waitForTimeout(250);
        const now = await read();
        if (now === prev && !now.split('/').includes('0')) {
            stable += 1;
            if (stable >= STABLE_TICKS) return now;
        } else {
            stable = 0;
        }
        prev = now;
    }
    return prev;
}

async function goToFirstPriceScreen(page) {
    await page.waitForTimeout(2600);
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(1400);
    await page.waitForTimeout(5400);
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(2300);
}

// 바텀시트 펼치기는 _flow_helpers.mjs의 revealDecision을 그대로 쓴다(중복 제거).
const openDecision = revealDecision;

let shot = 0;
async function snap(page, label) {
    shot += 1;
    const file = `item-content-${String(shot).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: path.join(SHOT_DIR, file) });
    return file;
}

// ============================================================ 1~3. 품목별 전체 플로우
for (const variant of [1, 2, 3]) {
    const exp = EXPECTED[variant];
    const photoFirst = variant === 2 ? 2 : 1; // 품목 2는 사진 슬롯을 뒤집어서도 확인
    const { ctx, page } = await seededSession({ order: 'AB', item: variant, photoFirst });

    // --- SCR-001-2 상품 소개 카드
    await page.waitForTimeout(2600);
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(6600);
    const intro = await page.evaluate(() => {
        const card = document.querySelector('#pv1b-screen .modern-card') || document.querySelector('.pv-screen[data-screen="2"] .modern-card');
        return {
            name: card.querySelector('.row2 .name').textContent.trim(),
            cat: card.querySelector('.row2 .cat').textContent.trim(),
            img: card.querySelector('.photo img').getAttribute('src'),
        };
    });
    check(`${variant}-1 SCR-001-2 상품명·카테고리가 품목 ${variant}`,
        intro.name === exp.name && intro.cat === exp.cat, `${intro.name} / ${intro.cat}`);
    await snap(page, `item${variant}-scr001-2`);

    // --- 첫 가격 화면(A안) — AB 배정이므로 pv2
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(2300);
    await waitPriceSettled(page, '#pv2-screen');
    const a = await screenInfo(page, '#pv2-screen');
    check(`${variant}-2 SCR-002 상품명·카테고리·헤드라인·건수`,
        a.name === exp.name && a.cat === exp.cat
        && a.headline === `이 ${exp.noun}, 중고로 팔면` && a.comps === exp.comps,
        JSON.stringify(a).slice(0, 200));
    check(`${variant}-3 SCR-002 히어로 단일가 = ${exp.a}`,
        a.price[0] + '원' === exp.a, a.price.join('/'));
    check(`${variant}-4 SCR-002 썸네일이 히어로 사진과 같은 장`,
        digest(a.photo) === digest(a.thumb) && digest(a.photo) !== null, `${digest(a.photo)} vs ${digest(a.thumb)}`);
    await snap(page, `item${variant}-scr002`);

    // --- 두 번째 가격 화면(B안)
    await openDecision(page, '#pv2-screen');
    await page.locator('#pv2-screen .p3-choice.yes').click();
    await page.waitForTimeout(300);
    await page.locator('#pv2-screen .p3-cta').click();
    await page.waitForTimeout(2600);
    await waitPriceSettled(page, '#pv3-screen');
    const b = await screenInfo(page, '#pv3-screen');
    check(`${variant}-5 SCR-003 상품 정보가 SCR-002와 완전히 동일(불변 조건)`,
        b.name === a.name && b.cat === a.cat && b.headline === a.headline && b.comps === a.comps,
        `${b.name}/${b.cat}/${b.headline}/${b.comps}`);
    check(`${variant}-6 SCR-003 히어로 범위가 = ${exp.b}`,
        `${b.price[0]}~${b.price[1]}원` === exp.b, b.price.join('~'));
    check(`${variant}-7 SCR-003 사진이 SCR-002와 다른 각도`,
        digest(b.photo) !== null && digest(b.photo) !== digest(a.photo),
        `${digest(a.photo)} vs ${digest(b.photo)}`);
    check(`${variant}-8 SCR-002 사진이 배정 슬롯 ${photoFirst}번과 일치`,
        digest(a.photo) === digest(await page.evaluate((p) => window.ABItem.photoUrl(window.ABItem.currentVariant(), p), photoFirst)),
        `slot=${photoFirst}`);
    await snap(page, `item${variant}-scr003`);

    // --- SCR-004 비교 카드 가격
    await openDecision(page, '#pv3-screen');
    await page.locator('#pv3-screen .p3-choice.no').click();
    await page.waitForTimeout(300);
    await page.locator('#pv3-screen .p3-price-input input').fill('30000');
    await page.locator('#pv3-screen .p3-cta').click();
    await page.waitForTimeout(1200);
    const opts = await page.evaluate(() => ({
        a: document.querySelector('#pv4-options .compare-card[data-option="A"] .opt-price').textContent.trim(),
        b: document.querySelector('#pv4-options .compare-card[data-option="B"] .opt-price').textContent.replace(/\s+/g, ''),
        peekHeadline: document.querySelector('#pv4-screen .peek-headline .l1').textContent.trim(),
        peekPhoto: getComputedStyle(document.querySelector('#pv4-screen .peek-photo')).backgroundImage,
    }));
    check(`${variant}-9 SCR-004 비교 카드 가격 = A ${exp.a} / B ${exp.b}`,
        opts.a === exp.a && opts.b === exp.b.replace('~', '~'), `${opts.a} | ${opts.b}`);
    check(`${variant}-10 SCR-004 배경 헤드라인·사진이 배정 품목과 일치`,
        opts.peekHeadline === `이 ${exp.noun}, 중고로 팔면` && digest(opts.peekPhoto) === digest(a.photo),
        `${opts.peekHeadline} / ${digest(opts.peekPhoto)}`);
    await snap(page, `item${variant}-scr004`);

    // --- 제출 → SCR-005
    await page.locator('#pv4-options .compare-card[data-option="A"]').click();
    await page.locator('#pv4-reasons .reason-row[data-reason="r2"]').click();
    await page.locator('#pv4-submit').click();
    await page.waitForTimeout(1400);
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ab_last_record')));
    const aiB = (EXPECTED[variant].b.match(/[\d,]+/g) || []).map((v) => Number(v.replace(/,/g, '')));
    const expectedDev = Math.round(Math.abs(30000 - (aiB[0] + aiB[1]) / 2) / ((aiB[0] + aiB[1]) / 2) * 100 * 100) / 100;
    check(`${variant}-11 FN-003 레코드의 item_variant·가격 편차가 이 품목 기준으로 계산됨`,
        record.item_variant === variant && record.b_price_deviation_pct === expectedDev,
        `item=${record.item_variant} dev=${record.b_price_deviation_pct} (기대 ${expectedDev})`);
    check(`${variant}-12 SCR-005(완료 화면)까지 도달`,
        await page.evaluate(() => Number(document.querySelector('.pv-screen.active').dataset.screen)) === 6);
    await snap(page, `item${variant}-scr005`);
    await ctx.close();
}

// ============================================================ 4. 사진 슬롯이 실제로 뒤집힌다
{
    const seen = [];
    for (const photoFirst of [1, 2]) {
        const { ctx, page } = await seededSession({ order: 'AB', item: 3, photoFirst });
        await goToFirstPriceScreen(page);
        const a = await screenInfo(page, '#pv2-screen');
        const b = await page.evaluate(() => getComputedStyle(document.querySelector('#pv3-screen .p3-photo')).backgroundImage);
        seen.push({ photoFirst, scr002: digest(a.photo), scr003: digest(b), name: a.name });
        await ctx.close();
    }
    check('4-1 슬롯 1/2를 뒤집으면 SCR-002·SCR-003 사진이 정확히 맞바뀐다',
        seen[0].scr002 === seen[1].scr003 && seen[0].scr003 === seen[1].scr002 && seen[0].scr002 !== seen[0].scr003,
        JSON.stringify(seen.map((s) => [s.photoFirst, s.scr002, s.scr003])));
    check('4-2 사진이 바뀌어도 상품명은 그대로다(불변 조건)',
        seen[0].name === seen[1].name && seen[0].name === EXPECTED[3].name, seen.map((s) => s.name).join(' / '));
}

// ============================================================ 5. 새로고침해도 세 축이 고정된다
{
    counter = 0;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ABSession.isReady());
    const before = await page.evaluate(() => ({
        order: sessionStorage.getItem('ab_assigned_order'),
        item: sessionStorage.getItem('ab_item_variant'),
        photo: sessionStorage.getItem('ab_photo_slot'),
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ABSession.isReady());
    const after = await page.evaluate(() => ({
        order: sessionStorage.getItem('ab_assigned_order'),
        item: sessionStorage.getItem('ab_item_variant'),
        photo: sessionStorage.getItem('ab_photo_slot'),
    }));
    check('5-1 새로고침 후에도 order·item_variant·사진 슬롯이 그대로',
        JSON.stringify(before) === JSON.stringify(after) && ['1', '2'].includes(before.photo),
        `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    check('5-2 사진 슬롯이 sessionStorage에 저장된다', before.photo === '1' || before.photo === '2', before.photo);
    await ctx.close();
}

// ============================================================ 6. 세 축이 서로 다르게 조합된다
{
    counter = 0;
    const combos = new Map();
    for (let i = 0; i < 24; i += 1) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        await page.goto(BASE, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.ABSession.isReady());
        const s = await page.evaluate(() => [
            sessionStorage.getItem('ab_assigned_order'),
            sessionStorage.getItem('ab_item_variant'),
            sessionStorage.getItem('ab_photo_slot'),
        ].join('/'));
        combos.set(s, (combos.get(s) || 0) + 1);
        await ctx.close();
    }
    const orders = new Set([...combos.keys()].map((k) => k.split('/')[0]));
    const items = new Set([...combos.keys()].map((k) => k.split('/')[1]));
    const slots = new Set([...combos.keys()].map((k) => k.split('/')[2]));
    check('6-1 24개 세션에서 order 두 종류가 모두 나온다', orders.size === 2, [...orders].join(','));
    check('6-2 품목 3종이 모두 나온다', items.size === 3, [...items].join(','));
    check('6-3 사진 슬롯 두 배치가 모두 나온다', slots.size === 2, [...slots].join(','));
    check('6-4 세 축이 한 조합에 몰리지 않고 여러 조합으로 흩어진다', combos.size >= 6,
        `${combos.size}가지 조합: ${[...combos.entries()].map(([k, v]) => `${k}x${v}`).join(' ')}`);
}

// ============================================================ 7. reduced-motion에서도 정상 렌더
{
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
        sessionStorage.setItem('ab_assigned_order', 'AB');
        sessionStorage.setItem('ab_item_variant', '2');
        sessionStorage.setItem('ab_photo_slot', '1');
        sessionStorage.setItem('ab_participant_number', '1');
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ABSession.isReady());
    await goToFirstPriceScreen(page);
    const a = await screenInfo(page, '#pv2-screen');
    check('7-1 reduced-motion에서도 품목 2 콘텐츠·사진이 보인다',
        a.name === EXPECTED[2].name && digest(a.photo) !== null, `${a.name} / ${digest(a.photo)}`);
    await snap(page, 'reducedmotion-scr002');
    await ctx.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n총 ${results.length}건 중 ${results.length - failed.length}건 통과, ${failed.length}건 실패`);
console.log(`스크린샷 ${shot}장 → ${SHOT_DIR}/item-content-*.png`);
if (failed.length) process.exit(1);
