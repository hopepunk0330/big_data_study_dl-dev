// 2026-08-28: artifact-version-tabs.html의 "v3(그리고 v2도) 아래로 스크롤이
// 안 됨" 수정 검증. 원인: html,body에 height:100%+overflow-y:auto가 걸려
// body 자신이 자기 콘텐츠의 스크롤 컨테이너가 되므로(html 자체는 overflow할
// 일이 없음), window.scrollTo/document.scrollingElement가 아니라
// document.body.scrollTop이 실제 스크롤 위치다 — 실사용자 마우스 휠/터치
// 스크롤은 body를 대상으로 정상 작동하는지 마우스 휠 시뮬레이션으로 확인한다.
import { chromium } from 'playwright';

const FILE = '/private/tmp/claude-501/-Users-aydana-dev-portfolio-bigdata-01-ML-mercari-price-2608/e79a9980-3560-4400-b6dc-aa977a214f9f/scratchpad/artifact-version-tabs.html';

async function checkTab(page, tabBtnId, frameId, label) {
  await page.click(`#${tabBtnId}`);
  await page.waitForTimeout(400);
  const frameEl = await page.$(`#${frameId}`);
  const cf = await frameEl.contentFrame();

  const info = await cf.evaluate(() => ({
    bodyScrollHeight: document.body.scrollHeight,
    bodyClientHeight: document.body.clientHeight,
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
    hasGallery: !!document.getElementById('gallery'),
    hasPrototype: !!document.getElementById('prototype'),
    bodyClasses: document.body.className,
  }));

  await cf.evaluate(() => { document.body.scrollTop = 0; });
  await page.waitForTimeout(100);

  // 실제 사용자 조작을 흉내: 프레임 중앙에 마우스를 놓고 휠 스크롤
  const bbox = await frameEl.boundingBox();
  await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
  for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, 400); }
  await page.waitForTimeout(300);

  const afterWheel = await cf.evaluate(() => document.body.scrollTop);
  const maxScroll = info.bodyScrollHeight - info.bodyClientHeight;
  const reachedBottom = maxScroll <= 20 ? true : afterWheel >= maxScroll - 20;

  console.log(`\n=== ${label} (${frameId}) ===`);
  console.log('  bodyScrollHeight:', info.bodyScrollHeight, '| viewport(clientHeight):', info.bodyClientHeight, '| maxScroll:', maxScroll);
  console.log('  body overflow-y:', info.bodyOverflowY, '| html overflow-y:', info.htmlOverflowY, '| bodyClasses:', info.bodyClasses || '(none)');
  console.log('  hasGallery(#gallery):', info.hasGallery, '| hasPrototype(#prototype):', info.hasPrototype);
  console.log('  scrollTop after wheel x40(400 each):', afterWheel, '/ target max:', maxScroll);
  console.log('  SCROLLED TO BOTTOM:', reachedBottom ? 'PASS' : 'FAIL');

  // 원위치 복구
  await cf.evaluate(() => { document.body.scrollTop = 0; });
  return { label, ...info, maxScroll, afterWheel, pass: reachedBottom };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
  await page.goto('file://' + FILE);
  await page.waitForTimeout(600);

  const results = [];
  results.push(await checkTab(page, 'tabBtnOld', 'frameOld', 'v1'));
  results.push(await checkTab(page, 'tabBtnNew', 'frameNew', 'v2'));
  results.push(await checkTab(page, 'tabBtnV3', 'frameV3', 'v3'));

  // reduced-motion 환경에서도 회귀 없는지(스크롤은 모션과 무관하지만, 안전 확인)
  await browser.close();
  const browser2 = await chromium.launch();
  const page2 = await browser2.newPage({ viewport: { width: 800, height: 900 }, reducedMotion: 'reduce' });
  await page2.goto('file://' + FILE);
  await page2.waitForTimeout(600);
  const r2 = await checkTab(page2, 'tabBtnV3', 'frameV3', 'v3(reduced-motion)');
  await browser2.close();

  console.log('\n\n=== 요약 ===');
  for (const r of [...results, r2]) {
    console.log(`${r.label}: maxScroll=${r.maxScroll} scrolledTo=${r.afterWheel} -> ${r.pass ? 'PASS' : 'FAIL'}`);
  }

  const allPass = [...results, r2].every((r) => r.pass);
  console.log('\n전체 결과:', allPass ? 'ALL PASS' : 'SOME FAILED');
  process.exit(allPass ? 0 : 1);
})();
