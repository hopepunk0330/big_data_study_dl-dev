// "새 시크릿 창"이 저장소를 실제로 비우는지 모델링하는 임시 진단(2026-08-28).
//
// Chrome의 시크릿 모드는 "창 단위"가 아니라 "시크릿 세션 단위"로 저장소를
// 공유한다 — 시크릿 창이 하나라도 열려 있는 상태에서 새 시크릿 창을 열면
// 같은 localStorage를 그대로 쓴다. Playwright에서는
//   · browser.newContext()          = 완전히 새로운 시크릿 세션(모든 시크릿 창을 닫은 뒤 새로 연 경우)
//   · 같은 context 안의 새 page     = 이미 열려 있는 시크릿 세션에 창 하나 더 연 경우
// 로 대응된다. 두 경우를 나란히 찍어 비교한다.
//
// 사용법: node diag_scr006_incognito_model.mjs <base-url>
import { chromium } from 'playwright';

const TARGET = process.argv[2];
if (!TARGET) {
  console.error('사용법: node diag_scr006_incognito_model.mjs <base-url>');
  process.exit(1);
}

const screenOf = (page) => page.evaluate(() => {
  const el = document.querySelector('.pv-screen.active');
  return {
    n: el ? Number(el.dataset.screen) : null,
    completed: (() => { try { return localStorage.getItem('ab_completed'); } catch (e) { return 'ERR'; } })(),
  };
});

const browser = await chromium.launch();

// 시크릿 세션 #1 — 창 A에서 완주(제출 플래그 세워짐)
const session1 = await browser.newContext();
const winA = await session1.newPage();
await winA.goto(TARGET, { waitUntil: 'domcontentloaded' });
await winA.waitForTimeout(1500);
await winA.evaluate(() => localStorage.setItem('ab_completed', '1'));

// 같은 시크릿 세션에서 "새 시크릿 창"(창 B)을 연 경우
const winB = await session1.newPage();
await winB.goto(TARGET, { waitUntil: 'domcontentloaded' });
await winB.waitForTimeout(2500);
const b = await screenOf(winB);
console.log('창 A(완주)가 아직 열려 있는 상태에서 연 새 시크릿 창 B →',
  'activeScreen=' + b.n, '/ ab_completed=' + JSON.stringify(b.completed),
  b.n === 7 ? '  <-- SCR-006 (사용자 보고와 일치)' : '');

// 모든 시크릿 창을 닫은 뒤(=context 폐기) 새 시크릿 세션
await session1.close();
const session2 = await browser.newContext();
const winC = await session2.newPage();
await winC.goto(TARGET, { waitUntil: 'domcontentloaded' });
await winC.waitForTimeout(2500);
const c = await screenOf(winC);
console.log('시크릿 창을 전부 닫은 뒤 연 새 시크릿 창 C            →',
  'activeScreen=' + c.n, '/ ab_completed=' + JSON.stringify(c.completed),
  c.n === 1 ? '  <-- SCR-001-1 (정상)' : '');

await session2.close();
await browser.close();
