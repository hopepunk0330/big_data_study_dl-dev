// 상품 사진 6장 교체(docs/reference/UI-assets/ 원본 → PHOTOS 인라인 base64)와
// SCR-004 딤 불투명도(0.85) 반영을 실제 렌더링으로 확인한다.
//
// 사진 검증은 "화면에 뭔가 보인다" 수준이 아니라, 각 화면이 실제로 그린
// data URI가 원본 PNG를 같은 파이프라인(3:2 중앙 크롭 → 폭 800 → JPEG q75)으로
// 처리한 결과와 바이트 단위로 같은지까지 대조한다.
//
// 실행: node docs/harness/report-tools/verify_photo_refresh_dim.mjs <participant-flow HTML 경로>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { requireHtmlArg, startServer, revealDecision } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_photo_refresh_dim.mjs');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(HERE, '..', '..', 'screenshot');
const ASSETS = path.join(HERE, '..', '..', 'reference', 'UI-assets');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// ---------------------------------------------------------------- 기대 이미지
// 원본 PNG를 임베드와 같은 설정으로 다시 처리해 기대 해시를 만든다.
const SOURCES = {
    '1-0': 'nike_air_max00.jpg',
    '2-0': 'mario_kart_deluxe3_00.jpg',
    '3-0': 'beats_studio_headphones00.jpg',
    '1-1': 'nike_air_max01.png',
    '1-2': 'nike_air_max02.png',
    '2-1': 'mario_kart_deluxe3_01.png',
    '2-2': 'mario_kart_deluxe3_02.png',
    '3-1': 'beats_studio_headphones01.png',
    '3-2': 'beats_studio_headphones02.png',
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-verify-'));
const EXPECT = {};
function pixelWidth(file) {
    const out = execFileSync('sips', ['-g', 'pixelWidth', file]).toString();
    return Number(/pixelWidth:\s*(\d+)/.exec(out)[1]);
}
for (const [key, file] of Object.entries(SOURCES)) {
    const src = path.join(ASSETS, file);
    const crop = path.join(tmp, `${key}.crop.png`);
    const small = path.join(tmp, `${key}.small.png`);
    const jpg = path.join(tmp, `${key}.jpg`);
    // 3:2 중앙 크롭 → 폭 800 → JPEG q75 (원본 크기가 장마다 달라 실측해서 크롭한다).
    // 리사이즈 플래그는 임베드 당시 쓴 것과 정확히 같아야 한다 — -Z(비율 유지)와
    // -z(강제 크기)는 결과 크기가 같아도 리샘플 결과가 바이트 단위로 다르다.
    //   슬롯 1·2(2048px PNG, 크롭 후 2048x1365) → -Z 800  (→ 800x533)
    //   슬롯 0(1024/800px JPG, 크롭 후 3:2)     → -z 533 800(→ 800x533 강제)
    const w = pixelWidth(src);
    execFileSync('sips', ['-c', String(Math.round(w / 1.5)), String(w), src, '--out', crop], { stdio: 'ignore' });
    const resize = key.endsWith('-0') ? ['-z', '533', '800'] : ['-Z', '800'];
    execFileSync('sips', [...resize, crop, '--out', small], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '75', small, '--out', jpg], { stdio: 'ignore' });
    const b64 = fs.readFileSync(jpg).toString('base64');
    EXPECT[key] = crypto.createHash('sha1').update(b64).digest('hex').slice(0, 12);
}
console.log('원본 재처리 해시:', JSON.stringify(EXPECT));

function digest(url) {
    if (!url) return null;
    const m = String(url).match(/base64,([A-Za-z0-9+/=]+)/);
    return m ? crypto.createHash('sha1').update(m[1]).digest('hex').slice(0, 12) : null;
}
function whichSlot(variant, d) {
    if (EXPECT[`${variant}-1`] === d) return 1;
    if (EXPECT[`${variant}-2`] === d) return 2;
    return null;
}

const { server, BASE } = await startServer(HTML);
const browser = await chromium.launch();

let shot = 0;
async function snap(page, label) {
    shot += 1;
    const file = `photo-refresh-${String(shot).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: path.join(SHOT_DIR, file) });
    return file;
}

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

// ================================================ 1. 품목 3종 × 4화면 실제 렌더
const LABEL = { 1: '나이키', 2: '마리오카트', 3: 'Beats' };
for (const variant of [1, 2, 3]) {
    const photoFirst = variant === 2 ? 2 : 1;
    const { ctx, page } = await seededSession({ order: 'AB', item: variant, photoFirst });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // --- SCR-001-2 상품 소개 카드
    await page.waitForTimeout(2600);
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(6600);
    const intro = await page.evaluate(() => {
        const card = document.querySelector('#pv1b-screen .modern-card')
            || document.querySelector('.pv-screen[data-screen="2"] .modern-card');
        const img = card.querySelector('.photo img');
        return { src: img.getAttribute('src'), w: img.naturalWidth, h: img.naturalHeight };
    });
    // SCR-001-2는 추첨과 무관한 전용 사진(슬롯 0, 원본 *_00)을 고정으로 쓴다.
    check(`${variant}-1 SCR-001-2(${LABEL[variant]}) 사진 = 전용 원본 *_00(슬롯 0)`,
        digest(intro.src) === EXPECT[`${variant}-0`], `${digest(intro.src)}`);
    check(`${variant}-2 SCR-001-2 이미지가 실제로 디코드됨(800x533)`,
        intro.w === 800 && intro.h === 533, `${intro.w}x${intro.h}`);
    await snap(page, `item${variant}-scr001-2`);

    // --- SCR-002(A안)
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(2600);
    const a = await page.evaluate(() => ({
        hero: getComputedStyle(document.querySelector('#pv2-screen .p3-photo')).backgroundImage,
        thumb: getComputedStyle(document.querySelector('#pv2-screen .p3-thumb'), '::before').backgroundImage,
    }));
    check(`${variant}-3 SCR-002 히어로 사진 = 새 원본 슬롯 ${photoFirst}`,
        digest(a.hero) === EXPECT[`${variant}-${photoFirst}`], `${digest(a.hero)}`);
    check(`${variant}-4 SCR-002 썸네일 = 히어로와 같은 장`,
        digest(a.thumb) === digest(a.hero) && digest(a.hero) !== null, `${digest(a.thumb)}`);
    await snap(page, `item${variant}-scr002`);

    // --- SCR-003(B안)
    await revealDecision(page, '#pv2-screen');
    await page.locator('#pv2-screen .p3-choice.yes').click();
    await page.waitForTimeout(300);
    await page.locator('#pv2-screen .p3-cta').click();
    await page.waitForTimeout(2800);
    const b = await page.evaluate(() => ({
        hero: getComputedStyle(document.querySelector('#pv3-screen .p3-photo')).backgroundImage,
        thumb: getComputedStyle(document.querySelector('#pv3-screen .p3-thumb'), '::before').backgroundImage,
    }));
    const bSlot = whichSlot(variant, digest(b.hero));
    check(`${variant}-5 SCR-003 히어로 사진 = 새 원본 나머지 슬롯 ${photoFirst === 1 ? 2 : 1}`,
        bSlot === (photoFirst === 1 ? 2 : 1), `slot=${bSlot} ${digest(b.hero)}`);
    check(`${variant}-6 SCR-003 썸네일 = 히어로와 같은 장`,
        digest(b.thumb) === digest(b.hero) && digest(b.hero) !== null, `${digest(b.thumb)}`);
    check(`${variant}-6b SCR-001-2 전용 사진이 SCR-002·SCR-003 어느 쪽과도 안 겹침`,
        digest(intro.src) !== digest(a.hero) && digest(intro.src) !== digest(b.hero),
        `card=${digest(intro.src)} a=${digest(a.hero)} b=${digest(b.hero)}`);
    await snap(page, `item${variant}-scr003`);

    // --- SCR-004 배경 peek + 딤
    await revealDecision(page, '#pv3-screen');
    await page.locator('#pv3-screen .p3-choice.no').click();
    await page.waitForTimeout(300);
    await page.locator('#pv3-screen .p3-price-input input').fill('30000');
    await page.locator('#pv3-screen .p3-cta').click();
    await page.waitForTimeout(1400);
    const s4 = await page.evaluate(() => ({
        peek: getComputedStyle(document.querySelector('#pv4-screen .peek-photo')).backgroundImage,
        dim: getComputedStyle(document.querySelector('#pv4-screen .scr004-dim')).backgroundColor,
    }));
    check(`${variant}-7 SCR-004 배경 사진 = SCR-002 히어로(새 사진)`,
        digest(s4.peek) === digest(a.hero) && digest(s4.peek) !== null, `${digest(s4.peek)}`);
    check(`${variant}-8 SCR-004 딤 기본 상태 = rgba(0, 0, 0, 0.85)`,
        s4.dim === 'rgba(0, 0, 0, 0.85)', s4.dim);
    await snap(page, `item${variant}-scr004`);

    check(`${variant}-9 콘솔/페이지 에러 없음`, errors.length === 0, errors.join(' | ') || '없음');
    await ctx.close();
}

// ================================================ 2. SCR-004 "기타" 모달(popup) 딤
{
    const { ctx, page } = await seededSession({ order: 'AB', item: 1, photoFirst: 1 });
    await page.waitForTimeout(2600);
    await page.locator('#pv1a-next').click();
    await page.waitForTimeout(6600);
    await page.locator('#pv1b-cta').click();
    await page.waitForTimeout(2600);
    await revealDecision(page, '#pv2-screen');
    await page.locator('#pv2-screen .p3-choice.yes').click();
    await page.waitForTimeout(300);
    await page.locator('#pv2-screen .p3-cta').click();
    await page.waitForTimeout(2800);
    await revealDecision(page, '#pv3-screen');
    await page.locator('#pv3-screen .p3-choice.yes').click();
    await page.waitForTimeout(300);
    await page.locator('#pv3-screen .p3-cta').click();
    await page.waitForTimeout(1400);

    await page.locator('#pv4-options .compare-card[data-option="A"]').click();
    await page.waitForTimeout(600);
    await page.locator('#pv4-reasons .reason-row[data-reason="other"]').click();
    await page.waitForTimeout(600);
    const popup = await page.evaluate(() => ({
        // #pv4-screen 자신이 .scr004다(자손이 아니다 — 참여자 화면 6070행 주석 참고).
        hasPopup: document.querySelector('#pv4-screen').classList.contains('popup'),
        dim: getComputedStyle(document.querySelector('#pv4-screen .scr004-dim')).backgroundColor,
    }));
    check('4-1 "기타" 모달이 열려 popup 상태가 된다', popup.hasPopup === true, String(popup.hasPopup));
    check('4-2 SCR-004 딤 popup 상태 = rgba(0, 0, 0, 0.85)',
        popup.dim === 'rgba(0, 0, 0, 0.85)', popup.dim);
    await snap(page, 'scr004-other-modal-dim');
    await ctx.close();
}

await browser.close();
server.close();
fs.rmSync(tmp, { recursive: true, force: true });

const failed = results.filter((r) => !r.pass);
console.log(`\n총 ${results.length}건 중 ${results.length - failed.length}건 통과, ${failed.length}건 실패`);
console.log(`스크린샷 ${shot}장 → ${path.join(SHOT_DIR, 'photo-refresh-*.png')}`);
process.exit(failed.length === 0 ? 0 : 1);
