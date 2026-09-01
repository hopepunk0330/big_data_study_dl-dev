import { chromium } from 'playwright';
const HTML = process.argv[2];
const browser = await chromium.launch();
for (const vp of [{w:375,h:667,name:'iPhoneSE'},{w:390,h:844,name:'iPhone13'},{w:360,h:600,name:'짧은화면'}]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto('file://' + HTML);
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    document.querySelectorAll('.pv-screen').forEach(el => el.classList.toggle('active', el.dataset.screen === '2'));
    const screenEl = document.getElementById('pv1b-screen') || document.querySelector('.pv-screen[data-screen="2"] .screen');
    const scrollArea = screenEl ? screenEl.querySelector('.scroll-area') : document.querySelector('.pv-screen[data-screen="2"] .scroll-area');
    if (!scrollArea) return { error: 'not found' };
    return {
      clientHeight: scrollArea.clientHeight,
      scrollHeight: scrollArea.scrollHeight,
      overflow: scrollArea.scrollHeight - scrollArea.clientHeight,
    };
  });
  console.log(vp.name, vp.w+'x'+vp.h, JSON.stringify(m));
  await page.close();
}
await browser.close();
