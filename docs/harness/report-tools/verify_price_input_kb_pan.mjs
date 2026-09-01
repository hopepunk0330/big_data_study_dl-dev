// SCR-002/003 희망가 입력란 — iOS Safari 시각뷰포트 팬(offsetTop) 보정
// 검증(2026-08-28). SCR-004 "기타" 모달의 checkKeyboardOpen() 팬 보정과
// 같은 계기의 회귀 — priceInputKbCheck()/scrollToRevealCtaForKeyboard()가
// height만 읽고 offsetTop을 무시하던 것, 'scroll' 이벤트를 구독하지 않아
// 순수 팬(높이 변화 없는 offsetTop 변화)에 재계산이 안 걸리던 것 두 가지를
// 함께 재현·검증한다. 실제 참여자 플로우(화면1→가격 "아니요")로 진입한다.
import { webkit, chromium } from 'playwright';
import { requireHtmlArg, startServer, priceScreenSelectors, revealDecision, enterFirstPriceScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_price_input_kb_pan.mjs');
const { server, BASE } = await startServer(HTML);

async function run(engineName, engine, viewport) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport });

  const { screenNum, errors } = await enterFirstPriceScreen(page, BASE);
  const { sel } = priceScreenSelectors(screenNum);
  await revealDecision(page, sel);

  const out = await page.evaluate(async (s) => {
    const baseHeight = window.innerHeight;
    class FakeVV extends EventTarget {
      constructor(h) { super(); this.height = h; this.width = window.innerWidth; this.offsetTop = 0; this.offsetLeft = 0; this.scale = 1; }
    }
    const fake = new FakeVV(baseHeight);
    const realVV = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });

    const noBtn = document.querySelector(s + ' .p3-choice.no');
    const input = document.querySelector(s + ' .p3-price-input input');
    const ctaBtn = document.querySelector(s + ' .p3-cta');
    const sheetEl = document.querySelector(s + ' .p3-sheet');

    noBtn.click();
    await new Promise((r) => setTimeout(r, 300)); // 260ms 자동 focus

    // 1) 키보드 오픈 — 높이만 축소(팬 없음, offsetTop=0) — 기존 회귀 없음 확인용 베이스라인
    const shrinkTotal = 291;
    const frames = 8;
    for (let i = 1; i <= frames; i++) {
      fake.height = Math.round(baseHeight - (shrinkTotal * i) / frames);
      fake.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 300));

    function measure(label) {
      const ctaRect = ctaBtn.getBoundingClientRect();
      const visibleTop = fake.offsetTop;
      const visibleBottom = fake.offsetTop + fake.height;
      return {
        label,
        vvHeight: fake.height,
        offsetTop: fake.offsetTop,
        transform: getComputedStyle(sheetEl).transform,
        ctaBottom: ctaRect.bottom,
        visibleBottom,
        ctaFullyVisible: ctaRect.top >= visibleTop - 0.5 && ctaRect.bottom <= visibleBottom + 0.5,
      };
    }

    const results = [];
    results.push(measure('1-height-only-shrink-no-pan'));

    // 2) 이제 "순수 팬"만 발생(높이 변화 없음, offsetTop만 증가) — 실제 iOS
    //    Safari가 포커스된 입력을 보이려 visualViewport를 아래로 미는
    //    상황을 흉내낸다. resize는 안 쏘고 'scroll' 이벤트만 쏜다 —
    //    'resize'만 구독하던 이전 버전이면 이 변화를 완전히 놓친다.
    const panSteps = 6;
    const panTotal = 80; // 팬 오프셋(px) — iOS에서 실측되는 대표적 범위
    for (let i = 1; i <= panSteps; i++) {
      fake.offsetTop = Math.round((panTotal * i) / panSteps);
      fake.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 300));
    results.push(measure('2-after-pure-pan-scroll-events'));

    // 3) 팬이 더 커지는 경우(팬 100px까지) — 회귀 없이 계속 따라가는지
    for (let i = 1; i <= panSteps; i++) {
      fake.offsetTop = Math.round(80 + (20 * i) / panSteps);
      fake.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 300));
    results.push(measure('3-after-more-pan'));

    // 4) 팬 원복(오프셋 0으로) + 키보드 닫힘(높이 원복) — blur
    fake.offsetTop = 0;
    fake.dispatchEvent(new Event('scroll'));
    input.blur();
    for (let i = frames - 1; i >= 0; i--) {
      fake.height = Math.round(baseHeight - (shrinkTotal * i) / frames);
      fake.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 400));
    const finalTransform = getComputedStyle(sheetEl).transform;
    const finalScrollTop = document.querySelector(s + ' .p3-scroll').scrollTop;

    Object.defineProperty(window, 'visualViewport', { value: realVV, configurable: true });
    return { results, finalTransform, finalScrollTop };
  }, sel);

  await browser.close();
  return { engine: engineName, sel, ...out, errors };
}

const results = [];
results.push(await run('webkit', webkit, { width: 390, height: 844 }));
results.push(await run('webkit-short', webkit, { width: 375, height: 667 })); // 프레임(693px)보다 짧아 스크롤/팬 보정이 실제로 필요한 조건
results.push(await run('chromium', chromium, { width: 390, height: 844 }));
server.close();

let anyFail = false;
results.forEach((r) => {
  console.log(`\n=== ${r.engine} (${r.sel}) ===`);
  r.results.forEach((m) => {
    console.log(`  [${m.label}] vv=${m.vvHeight} offsetTop=${m.offsetTop} transform=${m.transform} ctaBottom=${m.ctaBottom.toFixed(1)} visibleBottom=${m.visibleBottom} fullyVisible=${m.ctaFullyVisible}`);
    if (!m.ctaFullyVisible) anyFail = true;
  });
  console.log(`  종료 후(팬+키보드 모두 원복): transform=${r.finalTransform}, scrollTop=${r.finalScrollTop}`);
  const restored = r.finalTransform === 'none' || r.finalTransform === 'matrix(1, 0, 0, 1, 0, 0)';
  console.log(`  -> ${restored ? 'PASS: 원위치 복귀' : 'FAIL: transform이 원위치로 안 돌아옴'}`);
  if (!restored) anyFail = true;
  console.log(`  콘솔/페이지 에러: ${r.errors.length}건`, r.errors);
  if (r.errors.length) anyFail = true;
});

console.log(anyFail ? '\n일부 실패 있음' : '\n모두 통과');
process.exit(anyFail ? 1 : 0);
