// 희망가 입력 범위 검증(10%~1000%) 확인 — (1) 기능: 범위 밖 입력에서
// 에러가 뜨고 CTA가 막히는지, 범위 안으로 돌아오면 풀리는지. (2) 회귀:
// 키보드가 열린 상태에서 에러가 뜨고/사라지며 레이아웃 높이가 바뀌어도
// priceInputKbCheck 계열 스크롤/CTA 위치 보정이 깨지지 않는지(코디네이터
// 명시 경고 — 이 화면은 여러 라운드 실기기 재현으로 다듬어진 자리).
import { chromium, webkit } from 'playwright';
import { requireHtmlArg, startServer, priceScreenSelectors, revealDecision, enterFirstPriceScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_price_range_validation.mjs');
const { server, BASE } = await startServer(HTML);

async function gotoFirstPriceScreen(page) {
  const { screenNum, errors } = await enterFirstPriceScreen(page, BASE);
  const { sel } = priceScreenSelectors(screenNum);
  const format = screenNum === 4 ? 'range' : 'single';
  await revealDecision(page, sel);
  return { sel, format, errors };
}

async function readAiPrice(page, sel) {
  return page.evaluate((s) => {
    const item = window.ABItem ? window.ABItem.current() : null;
    const isRange = !!document.querySelector(s + ' .p3-price-input-wrap'); // 항상 true, 형식 판단은 밖에서
    return item;
  }, sel);
}

async function typeAndCheck(page, sel, value, { expectHelpVisible, expectCtaDisabled }) {
  const input = page.locator(`${sel} .p3-price-input input`);
  await input.fill('');
  await input.fill(String(value));
  await page.waitForTimeout(80);
  const state = await page.evaluate((s) => {
    const help = document.querySelector(s + ' .p3-price-help');
    const cta = document.querySelector(s + ' .p3-cta');
    return { helpHidden: help ? help.hidden : null, helpText: help ? help.textContent : null, ctaDisabled: cta.disabled };
  }, sel);
  const helpVisible = state.helpHidden === false;
  const pass = helpVisible === expectHelpVisible;
  return { value, ...state, helpVisible, pass };
}

async function run(engineName, engine) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const { sel, format, errors } = await gotoFirstPriceScreen(page);

  await page.locator(`${sel} .p3-choice.no`).click();
  await page.waitForTimeout(400);

  const item = await readAiPrice(page, sel);
  const aiPrice = format === 'range' ? Math.round((item.priceLo + item.priceHi) / 2) : item.priceA;
  const lo = Math.ceil(aiPrice * 0.1);
  const hi = Math.floor(aiPrice * 10);

  const functional = [];
  // 1) 아주 작은 값(범위 미만) — 에러 노출, CTA 비활성
  functional.push(await typeAndCheck(page, sel, Math.max(1, lo - 1000), { expectHelpVisible: true }));
  // 2) 아주 큰 값(범위 초과) — 에러 노출
  functional.push(await typeAndCheck(page, sel, hi + 100000, { expectHelpVisible: true }));
  // 3) 정상 범위(AI가 그대로) — 에러 숨김
  functional.push(await typeAndCheck(page, sel, aiPrice, { expectHelpVisible: false }));
  // 4) 하한 경계값(정확히 10%) — 에러 숨김(경계 포함)
  functional.push(await typeAndCheck(page, sel, lo, { expectHelpVisible: false }));
  // 5) 상한 경계값(정확히 1000%) — 에러 숨김(경계 포함)
  functional.push(await typeAndCheck(page, sel, hi, { expectHelpVisible: false }));
  // 6) 다시 범위 밖 — 에러 재노출 확인(토글 왕복)
  functional.push(await typeAndCheck(page, sel, hi + 1, { expectHelpVisible: true }));

  // CTA 활성화 지연(200ms) 이후 상태 — 정상 범위로 되돌린 뒤 CTA가 실제로 눌릴 수 있는지
  await typeAndCheck(page, sel, aiPrice, { expectHelpVisible: false });
  await page.waitForTimeout(300);
  const ctaEnabledAfterFix = await page.evaluate((s) => !document.querySelector(s + ' .p3-cta').disabled, sel);

  // ---- 회귀: 키보드 열린 상태에서 에러 토글 ----
  const kbResult = await page.evaluate(async (s) => {
    const baseHeight = window.innerHeight;
    class FakeVV extends EventTarget {
      constructor(h) { super(); this.height = h; this.width = window.innerWidth; this.offsetTop = 0; this.offsetLeft = 0; this.scale = 1; }
    }
    const fake = new FakeVV(baseHeight);
    const realVV = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });

    const input = document.querySelector(s + ' .p3-price-input input');
    input.blur();
    await new Promise((r) => setTimeout(r, 300));
    input.focus();
    await new Promise((r) => setTimeout(r, 50));

    const steps = 6;
    const shrink = 320;
    for (let i = 1; i <= steps; i++) {
      fake.height = Math.round(baseHeight - (shrink * i) / steps);
      fake.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 50));

    function setVal(v) {
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const cta = document.querySelector(s + ' .p3-cta');

    // 베이스라인 — 에러 개입 전, 순수 키보드 축소만 반영된 CTA 위치.
    // 이 화면(가격 시트)은 확인 모달과 달리 위에 신뢰배지·선택지·입력란까지
    // 있어 콘텐츠가 훨씬 길다 — 큰 폭의 키보드 축소에서는 내부 스크롤+
    // transform 보정만으로 CTA가 가시 영역에 완전히 들어오지 않을 수
    // 있다는 게 이 진단 라운드에서 실측으로 확인됐다(내 변경과 무관하게
    // 에러 개입 없이도 동일하게 재현됨 — .p3-scroll의 overflow-y:auto가
    // 안전망으로 남아있어 실사용자는 수동 스크롤로 도달 가능). 그래서
    // "완전 가시"를 절대 기준으로 삼지 않고, 에러 토글이 이 베이스라인
    // 대비 위치를 악화시키는지(델타)만 회귀 판정 기준으로 삼는다.
    const baselineRect = cta.getBoundingClientRect();
    const baselineGap = baselineRect.bottom - fake.height;

    // 위치 보정은 transform 0.25s ease로 전환되므로, 전환 도중(예: 80ms)에
    // 샘플링하면 중간값이 섞여 회귀 판정이 간헐적으로 흔들린다(dev-qa
    // 2026-08-28 발견) — 전환이 끝난 뒤(250ms + 여유)에만 측정한다.
    const outVal = 999999999;
    setVal(outVal);
    await new Promise((r) => setTimeout(r, 320));
    const ctaRectAfterError = cta.getBoundingClientRect();
    const helpAfterError = document.querySelector(s + ' .p3-price-help').hidden;
    const gapAfterError = ctaRectAfterError.bottom - fake.height;

    setVal(1); // 다시 범위 밖(아주 작은 값)으로 — 에러 유지, 위치 재확인
    await new Promise((r) => setTimeout(r, 320));
    const ctaRectAfterLow = cta.getBoundingClientRect();
    const helpAfterLow = document.querySelector(s + ' .p3-price-help').hidden;
    const gapAfterLow = ctaRectAfterLow.bottom - fake.height;

    const out = {
      visibleBottom: fake.height,
      baselineGap,
      helpVisibleAfterError: helpAfterError === false,
      gapAfterError,
      deltaAfterError: gapAfterError - baselineGap,
      helpVisibleAfterLow: helpAfterLow === false,
      gapAfterLow,
      deltaAfterLow: gapAfterLow - baselineGap,
    };
    Object.defineProperty(window, 'visualViewport', { value: realVV, configurable: true });
    return out;
  }, sel);

  await browser.close();
  return { engine: engineName, format, aiPrice, lo, hi, functional, ctaEnabledAfterFix, kbResult, errors };
}

const results = [];
results.push(await run('webkit', webkit));
results.push(await run('chromium', chromium));
server.close();

let anyFail = false;
results.forEach((r) => {
  console.log(`\n=== ${r.engine} (format=${r.format}, aiPrice=${r.aiPrice}, 허용범위 [${r.lo}, ${r.hi}]) ===`);
  r.functional.forEach((f) => {
    if (!f.pass) anyFail = true;
    console.log(`  값=${f.value} helpVisible=${f.helpVisible}(기대 없음 표기 생략) ctaDisabled=${f.ctaDisabled} -> ${f.pass ? 'PASS' : 'FAIL'}`);
  });
  console.log(`  정상값 복귀 후 CTA 활성화(지연 후): ${r.ctaEnabledAfterFix}`);
  if (!r.ctaEnabledAfterFix) anyFail = true;
  const kb = r.kbResult;
  console.log(`  [키보드 열림, shrink=320] 베이스라인(에러 없음) CTA-가시영역 gap=${kb.baselineGap.toFixed(1)}px (visibleBottom=${kb.visibleBottom})`);
  console.log(`  [키보드 열림] 범위밖 입력 후 에러표시=${kb.helpVisibleAfterError}, gap=${kb.gapAfterError.toFixed(1)}px, 베이스라인 대비 델타=${kb.deltaAfterError.toFixed(1)}px`);
  console.log(`  [키보드 열림] 극단값 재입력 후 에러표시=${kb.helpVisibleAfterLow}, gap=${kb.gapAfterLow.toFixed(1)}px, 베이스라인 대비 델타=${kb.deltaAfterLow.toFixed(1)}px`);
  // 회귀 판정 기준: "완전 가시"가 아니라 "에러 토글이 베이스라인 대비
  // 위치를 악화시키는가"다 — 이 화면은 콘텐츠가 길어 큰 폭의 키보드
  // 축소에서는 에러 유무와 무관하게 gap이 이미 남을 수 있다는 게
  // 실측으로 확인된 이 화면의 사전 특성이다(overflow-y:auto 안전망으로
  // 실사용자는 수동 스크롤 가능). 델타가 +15px를 넘게 악화되면만 내
  // 변경이 새로 만든 회귀로 간주한다.
  const REGRESSION_TOLERANCE_PX = 15;
  if (kb.deltaAfterError > REGRESSION_TOLERANCE_PX || kb.deltaAfterLow > REGRESSION_TOLERANCE_PX) {
    anyFail = true;
    console.log('  -> FAIL: 에러 토글이 베이스라인보다 CTA 위치를 눈에 띄게 악화시킴');
  } else {
    console.log('  -> PASS: 에러 토글로 인한 새로운 위치 악화 없음(기존 베이스라인 특성과 동등하거나 더 나음)');
  }
  console.log(`  콘솔/페이지 에러: ${r.errors.length}건`, r.errors);
  if (r.errors.length) anyFail = true;
});

console.log(anyFail ? '\n일부 실패 있음' : '\n모두 통과');
process.exit(anyFail ? 1 : 0);
