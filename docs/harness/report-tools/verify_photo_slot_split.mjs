// SCR-001-2 / SCR-002 / SCR-003 사진 분배 회귀 테스트
// (05_실험설계서 v1.14 "사진 2장 랜덤 분배" · 06_기능정의서_화면정의서 v1.45 0.1절)
//
// 불변 조건:
//  (1) 한 세션 안에서 SCR-002와 SCR-003의 히어로 사진(.p3-photo)과
//      상품행 썸네일(.p3-thumb::before)은 항상 서로 다른 사진이어야 한다.
//  (2) SCR-001-2 카드 사진은 추첨에 참여하지 않는 품목별 전용 사진(슬롯 0,
//      원본 *_00)으로 고정이다 — 노출 순서(order)·사진 슬롯 배정과 무관하게
//      항상 같은 장이며, 01·02와 애초에 다른 장이라 SCR-002·SCR-003 어느
//      쪽과도 겹치지 않는다. (이전에는 카드가 order를 보고 photoFirst/
//      photoSecond 중 하나를 고르는 분기가 있었으나, 전용 사진이 생기면서
//      그 분기 자체가 불필요해져 제거됐다.)
//  (3) 사진만 다르고 상품 자체(상품명·카테고리)는 세 화면 모두 동일해야 한다.
// 품목 3종 × 사진 슬롯 2가지 × 노출 순서 2가지 × 애니메이션 설정 2가지를
// 전부 돌면서, 새로고침(복원 경로)·화면 되돌아가기 이후에도 유지되는지 본다.
//
// 사용법: node verify_photo_slot_split.mjs <web/index.html 경로>
import { chromium, webkit } from 'playwright';
import { requireHtmlArg, startServer } from './_flow_helpers.mjs';

const htmlPath = requireHtmlArg(process.argv[2], 'verify_photo_slot_split.mjs', 'web/index.html');
const { server, BASE } = await startServer(htmlPath);

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass += 1; console.log(`  ✅ ${name}`); }
  else { fail += 1; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

// 배경 이미지 문자열을 짧은 지문으로 줄인다(base64가 수백 KB라 원문 비교는 로그가 터진다).
// 배경(url("data:...") 형태)과 <img src="data:...">를 같은 기준으로 비교해야 하므로
// url(...) 껍데기를 벗겨 순수 데이터 URI로 맞춘 뒤 지문을 낸다.
const PROBE = `(() => {
  const h = (s) => { let a = 0, b = 0; for (let i = 0; i < s.length; i += 1) { a = (a * 31 + s.charCodeAt(i)) >>> 0; b = (b + a) >>> 0; } return a.toString(16) + '/' + s.length; };
  const uri = (s) => { const m = /url\\(["']?(data:[^"')]+)["']?\\)/.exec(s); return m ? m[1] : s; };
  const bg = (sel, pseudo) => { const el = document.querySelector(sel); return el ? h(uri(getComputedStyle(el, pseudo || null).backgroundImage)) : 'NOELEM'; };
  const src = (sel) => { const el = document.querySelector(sel); return el ? h(el.getAttribute('src') || '') : 'NOELEM'; };
  const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : 'NOELEM'; };
  const CARD = '.pv-screen[data-screen="2"] .modern-card';
  return {
    slot: window.ABSession.getPhotoSlot(),
    item: window.ABSession.getItemVariant(),
    order: window.ABSession.getOrder(),
    a_photo: bg('#pv2-screen .p3-photo'),
    b_photo: bg('#pv3-screen .p3-photo'),
    a_thumb: bg('#pv2-screen .p3-thumb', '::before'),
    b_thumb: bg('#pv3-screen .p3-thumb', '::before'),
    card_photo: src(CARD + ' .photo img'),
    // 이 품목의 SCR-001-2 전용 사진(슬롯 0) — 카드가 실제로 이걸 쓰는지 대조한다.
    fixed_photo: h(window.ABItem.photoUrl(window.ABSession.getItemVariant(), 0)),
    peek_photo: bg('.pv-screen[data-screen="5"] .peek-photo'),
    card_name: txt(CARD + ' .row2 .name'),
    card_cat: txt(CARD + ' .row2 .cat'),
    a_name: txt('#pv2-screen .p3-product-text .name'),
    a_cat: txt('#pv2-screen .p3-product-text .cat'),
    b_name: txt('#pv3-screen .p3-product-text .name'),
    b_cat: txt('#pv3-screen .p3-product-text .cat'),
  };
})()`;

async function seed(page, { item, first, order }) {
  await page.evaluate(({ i, f, o }) => {
    sessionStorage.setItem('ab_item_variant', String(i));
    sessionStorage.setItem('ab_photo_slot', String(f));
    sessionStorage.setItem('ab_assigned_order', o);
    sessionStorage.setItem('ab_participant_number', '1');
  }, { i: item, f: first, o: order });
}

for (const [engineName, launcher] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await launcher.launch();
  for (const reducedMotion of ['no-preference', 'reduce']) {
    for (const item of [1, 2, 3]) {
      for (const first of [1, 2]) {
        for (const order of ['AB', 'BA']) {
          const label = `${engineName} rm=${reducedMotion} item=${item} first=${first} order=${order}`;
          const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
          const page = await ctx.newPage();
          await page.goto(BASE, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 8000 });
          await seed(page, { item, first, order });
          // 새로고침 = restore() 복원 경로(새로 추첨하는 commit() 경로가 아님)
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => window.ABSession && window.ABSession.isReady(), null, { timeout: 8000 });
          await page.waitForTimeout(400);

          const r = await page.evaluate(PROBE);
          check(`${label} · 슬롯 복원`, r.item === item && r.slot.first === first && r.order === order,
            JSON.stringify({ item: r.item, slot: r.slot, order: r.order }));
          check(`${label} · 히어로 사진 A≠B`, r.a_photo !== r.b_photo, `둘 다 ${r.a_photo}`);
          check(`${label} · 썸네일 A≠B`, r.a_thumb !== r.b_thumb, `둘 다 ${r.a_thumb}`);
          check(`${label} · 화면 내 히어로=썸네일(같은 사진)`, r.a_photo === r.a_thumb && r.b_photo === r.b_thumb,
            JSON.stringify({ a: r.a_photo, at: r.a_thumb, b: r.b_photo, bt: r.b_thumb }));

          // 불변 조건 (2) — SCR-001-2 카드는 순서·슬롯과 무관하게 전용 사진(슬롯 0) 고정.
          check(`${label} · SCR-001-2 사진 = 이 품목 전용 사진(슬롯 0)`, r.card_photo === r.fixed_photo,
            JSON.stringify({ card: r.card_photo, fixed: r.fixed_photo }));
          check(`${label} · SCR-001-2 사진 ≠ SCR-002·SCR-003 어느 쪽과도 겹치지 않음`,
            r.card_photo !== r.a_photo && r.card_photo !== r.b_photo,
            JSON.stringify({ card: r.card_photo, a: r.a_photo, b: r.b_photo }));
          check(`${label} · SCR-004 배경 = SCR-002 히어로(photoFirst, 회귀 없음)`, r.peek_photo === r.a_photo,
            JSON.stringify({ peek: r.peek_photo, a: r.a_photo }));

          // 불변 조건 (3) — 사진만 다르고 상품 자체는 세 화면 동일.
          check(`${label} · 상품명 3화면 동일`, r.card_name !== 'NOELEM' && r.card_name === r.a_name && r.a_name === r.b_name,
            JSON.stringify({ card: r.card_name, a: r.a_name, b: r.b_name }));
          check(`${label} · 카테고리 3화면 동일`, r.card_cat !== 'NOELEM' && r.card_cat === r.a_cat && r.a_cat === r.b_cat,
            JSON.stringify({ card: r.card_cat, a: r.a_cat, b: r.b_cat }));

          // 화면 사이를 오간 뒤에도 유지되는지(되돌아가기 회귀 방지)
          await page.evaluate(() => {
            document.querySelectorAll('.pv-screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === '3'));
          });
          await page.waitForTimeout(150);
          await page.evaluate(() => {
            document.querySelectorAll('.pv-screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === '4'));
          });
          await page.waitForTimeout(150);
          const r2 = await page.evaluate(PROBE);
          check(`${label} · 화면 전환 후에도 A≠B`, r2.a_photo !== r2.b_photo, `둘 다 ${r2.a_photo}`);
          check(`${label} · 화면 전환 후에도 SCR-001-2 = 전용 사진(슬롯 0)`,
            r2.card_photo === r2.fixed_photo, JSON.stringify({ card: r2.card_photo, fixed: r2.fixed_photo }));

          await ctx.close();
        }
      }
    }
  }
  await browser.close();
}

server.close();
console.log(`\n총 ${pass + fail}건 · 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
