// SCR-003(가격 범위 입력 화면) "다음 보기" CTA가 reduced-motion에서도
// 정상적으로 화면을 전환시키는지 검증한다(2026-08-28 버그 수정).
//
// 근본 원인: "다음 보기" 버튼을 클릭하면 그 mousedown이 아직 포커스가
// 남아있던 희망가 입력란(priceInput)의 blur를 먼저 일으키는데, 그 blur
// 핸들러가 즉시 `sheetScrollEl.scrollTo({ top: 원래위치, behavior:
// reduceMotion?'auto':'smooth' })`로 스크롤을 원복시켰다. reduced-motion
// (behavior:'auto')에서는 이 스크롤이 같은 프레임 안에 즉시 끝나버려,
// mousedown→mouseup 사이에 CTA가 화면 밖으로 밀려나고 click 자체가 그
// 자리로 스크롤되어 들어온 다른 요소("아니요" 선택지 텍스트)에 떨어져
// CTA의 클릭 핸들러(→onNext→goTo)가 실행되지 못했다 — 일반 모션에서는
// smooth 스크롤이 그 짧은 순간(수 ms)엔 거의 안 움직여 우연히 재현 안 됨.
// 수정: 이 스크롤·시트 트랜지션 복원을 setTimeout(0)으로 한 틱 미뤄, 지금
// 진행 중인 클릭(CTA 클릭 핸들러)이 먼저 끝난 뒤에만 복원이 실행되게 함.
//
// 이 스크립트는 order 배정(참가자 번호로 결정)에 따라 SCR-003이 "첫 번째"
// 또는 "두 번째" 가격 화면으로 나오는 두 경우를 모두 만들어(burn=0/3)
// reduced-motion·일반 모드 각각에서 SCR-004(화면5)까지 도달하는지 확인한다.
//
// 사용법: node verify_scr003_reducedmotion_cta.mjs <web/index.html 경로>
import { chromium, webkit } from 'playwright';
import { requireHtmlArg, startServer, activeScreen, enterFirstPriceScreen, advancePastPriceScreen } from './_flow_helpers.mjs';

const HTML = requireHtmlArg(process.argv[2], 'verify_scr003_reducedmotion_cta.mjs');

async function run(engineName, engine, reduced, burn) {
  const { server, BASE } = await startServer(HTML);
  for (let i = 0; i < burn; i++) { await fetch(BASE + 'api/participant-number'); }
  const browser = await engine.launch();
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  const { screenNum: first } = await enterFirstPriceScreen(page, BASE);
  await advancePastPriceScreen(page, first);
  const second = await activeScreen(page);
  await advancePastPriceScreen(page, second);
  const third = await activeScreen(page);

  await browser.close();
  server.close();
  return { engine: engineName, reduced, burn, first, second, third, errors };
}

const results = [];
for (const engineDef of [['chromium', chromium], ['webkit', webkit]]) {
  for (const reduced of [true, false]) {
    for (const burn of [0, 3]) {
      results.push(await run(engineDef[0], engineDef[1], reduced, burn));
    }
  }
}

let anyFail = false;
results.forEach((r) => {
  const pass = r.third === 5 && r.errors.length === 0;
  if (!pass) anyFail = true;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  [${r.engine}] reduced=${r.reduced} burn=${r.burn} — first=${r.first} second=${r.second} third(기대 5)=${r.third} errors=${r.errors.length}`,
  );
  if (r.errors.length) console.log('  ', r.errors);
});

console.log(`\n총 ${results.length}건 중 ${results.filter((r) => r.third !== 5 || r.errors.length).length}건 실패`);
if (anyFail) process.exit(1);
console.log('모두 통과 — reduced-motion·일반 모드, SCR-003이 첫/두 번째 어느 위치든 SCR-004까지 정상 도달.');
