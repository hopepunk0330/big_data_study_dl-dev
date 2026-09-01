// SCR-004 "기타" 모달 키보드 재발 검증 — visualViewport 높이 축소뿐 아니라
// offsetTop/offsetLeft 팬(iOS WebKit이 position:fixed 문서에서 포커스된
// 입력을 보이려 할 때 벌이는 "시각뷰포트 이동")까지 가짜로 흘려보내,
// modal-card의 transform 보정이 실제로 "확인" 버튼을 가시 영역 안에
// 붙잡아두는지 확인한다. 실제 참여자 플로우(화면1→가격→SCR-004)를 그대로
// 클릭해서 진입한다(goTo()가 IIFE 지역함수라 임의로 화면을 활성화하면
// enterScreenScr004()의 1회성 리스너 초기화가 안 돼 클릭이 무반응이 된다).
import { chromium, webkit } from 'playwright';
import { requireHtmlArg, startServer, activeScreen, enterFirstPriceScreen, advancePastPriceScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_scr004_modal_pan.mjs');
const { server, BASE } = await startServer(HTML);

async function navigateToScr004(page) {
  const { screenNum: first } = await enterFirstPriceScreen(page, BASE);
  await advancePastPriceScreen(page, first);

  const second = await activeScreen(page);
  await advancePastPriceScreen(page, second);

  const scr = await activeScreen(page);
  if (scr !== 5) throw new Error(`SCR-004(화면5) 진입 실패 — active=${scr}`);
}

async function run(engineName, engine) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await navigateToScr004(page);

  await page.locator('#pv4-options .compare-card[data-option="A"]').click();
  await page.locator('#pv4-reasons .reason-row[data-reason="other"]').click();
  await page.waitForTimeout(400); // openOtherModal()의 setTimeout(260ms) + 여유

  const preState = await page.evaluate(() => ({
    popup: document.getElementById('pv4-screen').classList.contains('popup'),
    activeEl: document.activeElement.id,
  }));

  const results = [];
  for (const scenario of [
    { name: 'height-only-shrink', shrink: 320, offsetTop: 0 },
    { name: 'height-shrink+pan-down', shrink: 320, offsetTop: 140 },
    { name: 'height-shrink+pan-down-extreme', shrink: 300, offsetTop: 220 },
  ]) {
    const info = await page.evaluate(async ({ shrink, offsetTop }) => {
      const baseHeight = window.innerHeight;
      class FakeVV extends EventTarget {
        constructor(h, oT) { super(); this.height = h; this.width = window.innerWidth; this.offsetTop = oT; this.offsetLeft = 0; this.scale = 1; }
      }
      const fake = new FakeVV(baseHeight, 0);
      const realVV = window.visualViewport;
      Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });

      const ta = document.getElementById('pv4-textarea');
      ta.blur();
      await new Promise((r) => setTimeout(r, 300));
      ta.focus();
      await new Promise((r) => setTimeout(r, 50));

      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        fake.height = Math.round(baseHeight - (shrink * i) / steps);
        fake.offsetTop = Math.round((offsetTop * i) / steps);
        fake.dispatchEvent(new Event('resize'));
        if (offsetTop > 0) fake.dispatchEvent(new Event('scroll'));
        await new Promise((r) => setTimeout(r, 20));
      }
      await new Promise((r) => setTimeout(r, 50));

      const card = document.getElementById('pv4-confirm').closest('.modal-card');
      const confirmBtn = document.getElementById('pv4-confirm');
      const cardRect = card.getBoundingClientRect();
      const btnRect = confirmBtn.getBoundingClientRect();
      const visibleTop = fake.offsetTop;
      const visibleBottom = fake.offsetTop + fake.height;
      const transform = getComputedStyle(card).transform;

      const out = {
        fakeHeight: fake.height,
        fakeOffsetTop: fake.offsetTop,
        visibleTop, visibleBottom,
        cardTop: cardRect.top, cardBottom: cardRect.bottom,
        btnTop: btnRect.top, btnBottom: btnRect.bottom,
        transform,
        btnFullyVisible: btnRect.top >= visibleTop - 0.5 && btnRect.bottom <= visibleBottom + 0.5,
        btnAnyVisible: btnRect.bottom > visibleTop && btnRect.top < visibleBottom,
        kbOpenClass: document.getElementById('pv4-screen').classList.contains('kb-open'),
      };

      Object.defineProperty(window, 'visualViewport', { value: realVV, configurable: true });
      // 다음 시나리오를 위해 baseline 복구(포커스 유지한 채 재측정하려면 blur/focus 재사이클 필요 없음 —
      // 다음 루프가 다시 blur/focus로 재바인딩한다)
      return out;
    }, scenario);
    results.push({ engine: engineName, scenario: scenario.name, ...info });
  }

  await browser.close();
  return { preState, results };
}

const summary = { chromium: null, webkit: null };
summary.webkit = await run('webkit', webkit);
summary.chromium = await run('chromium', chromium);

server.close();

console.log('pre-state (모달 오픈 확인):', JSON.stringify(summary.webkit.preState), JSON.stringify(summary.chromium.preState));
const all = [...summary.webkit.results, ...summary.chromium.results];
console.log(JSON.stringify(all, null, 2));
const failures = all.filter((r) => !r.btnFullyVisible);
console.log(`\n총 ${all.length}건 중 확인 버튼 완전 가시 실패: ${failures.length}건`);
if (failures.length) {
  console.log('실패 상세:', JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log('모두 통과.');
