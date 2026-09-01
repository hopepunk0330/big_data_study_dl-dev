// SCR-004 단계적 공개(progressive disclosure, 2026-08-28) 검증 —
//   (a) 화면5 진입 직후에는 이유 선택 영역(#pv4-stage2)이 접혀 있다(높이 0)
//   (b) A안 카드를 고르면 열린다(#pv4-submit까지 포함해 클릭 가능해짐)
//   (c) B안 카드를 골라도 동일하게 열린다(별도 인스턴스로 재확인)
//   (d) reduced-motion에서 .s4-stage2의 트랜지션이 실제로 꺼져 있다(정적
//       computed-style 확인 — 아래 "reduced-motion E2E 한계" 참고)
//   (e) 기존 회귀(선택→이유→제출)는 final_e2e_smoke.mjs가 이미 커버하므로
//       이 스크립트에서는 재확인만 가볍게 한다.
//
// reduced-motion E2E 한계(정직하게 명시) — 이 스크립트는 (a)(b)(c)(e)를
// "reducedMotion:'reduce'로 화면1부터 실제 클릭해 SCR-004까지 도달"하는
// 방식으로는 검증하지 못한다. 조사 결과, web/index.html은 reduced-motion이
// 켜진 상태로는 SCR-003(가격 범위 입력 화면, dataset-screen=3)의 "다음 보기"
// 버튼을 눌러도 다음 화면으로 전혀 넘어가지 않는 기존 버그가 있다 —
// git HEAD 커밋 시점 원본 파일에서도 동일하게 재현되므로 이번 SCR-004
// 단계적 공개 작업과는 무관한, 이미 있던 문제로 확인됐다(이 조사 과정에서
// ctaBtn.disabled=false, elementFromPoint·실제 마우스 클릭 모두 버튼에
// 정상 도달하는 것까지는 확인했지만 그 이상 원인 추적은 이번 작업 범위를
// 벗어나 하지 않았다). 이 버그 때문에 순서 배정(order)이 무엇이든 SCR-003을
// 반드시 거쳐야 하는 이 흐름에서, reduced-motion 사용자는 현재 SCR-004에
// 아예 도달할 수 없다 — 별도 보고 대상(이 스크립트가 손대는 범위 밖).
//
// 그래서 (d)는 대신 이 화면 이동 문제와 무관하게 독립적으로 검증 가능한
// 것 — .s4-stage2에 적용한 reduced-motion CSS 오버라이드(transition:none
// !important)가 실제로 브라우저에 반영되는지 — 를 정적 computed-style로
// 확인한다. #pv4-stage2 노드 자체는 화면 전환과 무관하게 항상 DOM에
// 존재하므로(비활성 상태라도 렌더 트리에서 제거되지 않음, .pv-screen이
// display:none이 아니라 opacity/pointer-events로만 숨겨짐 — CSS의
// transition 속성값 자체는 getComputedStyle로 항상 정상 조회된다) 화면
// 이동 없이도 신뢰할 수 있는 확인 방법이다.
//
// 사용법: node verify_scr004_progressive_disclosure.mjs <web/index.html 경로>
import { chromium, webkit } from 'playwright';
import { requireHtmlArg, startServer, activeScreen, enterFirstPriceScreen, advancePastPriceScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_scr004_progressive_disclosure.mjs');

async function navigateToScr004(page, base) {
  const { screenNum: first } = await enterFirstPriceScreen(page, base);
  await advancePastPriceScreen(page, first);
  const second = await activeScreen(page);
  await advancePastPriceScreen(page, second);
  const scr = await activeScreen(page);
  if (scr !== 5) throw new Error(`SCR-004(화면5) 진입 실패 — active=${scr}`);
}

function readStage2(page) {
  return page.evaluate(() => {
    const stage2 = document.getElementById('pv4-stage2');
    const rect = stage2.getBoundingClientRect();
    const submitBtn = document.getElementById('pv4-submit');
    const submitRect = submitBtn.getBoundingClientRect();
    return {
      isOpenClass: stage2.classList.contains('open'),
      height: rect.height,
      submitVisibleHeight: submitRect.height,
    };
  });
}

async function runScenario(engineName, engine, opts) {
  const results = [];
  const record = (name, pass, detail) => results.push({ engine: engineName, name, pass, detail });

  const { server, BASE } = await startServer(HTML);
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  await navigateToScr004(page, BASE);
  // 자동 등장 시퀀스(질문+비교카드, 최대 1050ms)가 끝날 때까지 대기.
  await page.waitForTimeout(1300);

  const before = await readStage2(page);
  record(
    '(a) 초기 진입 시 stage2가 접혀 있다(height≈0, open 클래스 없음)',
    !before.isOpenClass && before.height < 4,
    JSON.stringify(before),
  );

  // 클릭 대상 카드(A 또는 B) 선택
  await page.locator(`#pv4-options .compare-card[data-option="${opts.option}"]`).click();
  // 애니메이션 트랜지션(380ms) + 안전 여유.
  await page.waitForTimeout(600);

  const after = await readStage2(page);
  record(
    `(${opts.option === 'A' ? 'b' : 'c'}) ${opts.option}안 선택 시 stage2가 열린다(open 클래스+양의 높이)`,
    after.isOpenClass && after.height > 100 && after.submitVisibleHeight > 20,
    JSON.stringify(after),
  );

  // 제출 버튼이 실제로 클릭 가능한(액션 가능한) 상태인지 — 이유까지 고르고
  // 제출까지 완주해본다(기존 기능 회귀 없음 재확인, e).
  await page.locator('#pv4-reasons .reason-row[data-reason="r1"]').click();
  await page.waitForTimeout(300);
  const submitEnabled = await page.evaluate(() => !document.getElementById('pv4-submit').disabled);
  record('(e) 옵션+이유 선택 후 제출 버튼이 활성화된다(기존 로직 회귀 없음)', submitEnabled, `disabled=${!submitEnabled}`);

  await page.locator('#pv4-submit').click();
  await page.waitForTimeout(1200);
  const scr6 = await activeScreen(page);
  record('(e) 제출 후 SCR-005(화면6)로 이동(기존 기능 회귀 없음)', scr6 === 6, `active=${scr6}`);

  record('JS 에러 0건', errors.length === 0, JSON.stringify(errors));

  await browser.close();
  server.close();
  return results;
}

// (d) reduced-motion 정적 확인 — 화면 이동 없이 페이지 로드 직후 바로 확인.
async function checkReducedMotionCss(engineName, engine) {
  const results = [];
  const record = (name, pass, detail) => results.push({ engine: engineName, name, pass, detail });
  const { server, BASE } = await startServer(HTML);

  for (const reduced of [true, false]) {
    const browser = await engine.launch();
    const page = await browser.newPage({
      viewport: { width: 375, height: 667 },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const transition = await page.evaluate(() => {
      const el = document.getElementById('pv4-stage2');
      return getComputedStyle(el).transitionProperty;
    });
    if (reduced) {
      record(
        '(d) reduced-motion에서 #pv4-stage2 transition이 none이다(즉시 전환)',
        transition === 'none',
        `transitionProperty=${transition}`,
      );
    } else {
      record(
        '(d 대조군) 일반 모드에서는 #pv4-stage2에 실제 transition이 걸려 있다(max-height/margin-top)',
        transition !== 'none' && /max-height/.test(transition) && /margin-top/.test(transition),
        `transitionProperty=${transition}`,
      );
    }
    await browser.close();
  }

  server.close();
  return results;
}

const all = [];
all.push(...await runScenario('chromium', chromium, { option: 'A' }));
all.push(...await runScenario('webkit', webkit, { option: 'A' }));
all.push(...await runScenario('chromium', chromium, { option: 'B' }));
all.push(...await checkReducedMotionCss('chromium', chromium));
all.push(...await checkReducedMotionCss('webkit', webkit));

all.forEach((r) => {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  [${r.engine}] ${r.name} — ${r.detail}`);
});
const failures = all.filter((r) => !r.pass);
console.log(`\n총 ${all.length}건 중 ${failures.length}건 실패`);
if (failures.length) process.exit(1);
console.log('모두 통과.');
console.log('\n주의: reduced-motion 상태로 실제 화면1부터 클릭해 SCR-004까지 도달하는 전체 E2E는');
console.log('SCR-003(가격 범위 화면)의 기존(무관한) 버그로 인해 이 스크립트에서 검증하지 못했다 —');
console.log('상세는 파일 상단 주석 참고, 별도 보고 대상.');
