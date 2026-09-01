import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
const HTML = process.argv[2];
let counter=0;
const server = http.createServer((req,res)=>{
  if(req.url.split('?')[0]==='/api/participant-number'){counter+=1;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({number:counter}));return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync(HTML));
});
await new Promise(r=>server.listen(0,r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}/`;

async function activeScreen(page){return page.evaluate(()=>{const el=document.querySelector('.pv-screen.active');return el?Number(el.dataset.screen):null;});}
async function navigateToScr004(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ABSession && window.ABSession.isReady());
  await page.waitForTimeout(2600);
  await page.locator('#pv1a-next').click();
  await page.waitForTimeout(1400+5400);
  await page.locator('#pv1b-cta').click();
  await page.waitForTimeout(2300);
  const first = await activeScreen(page);
  const firstSel = first===4?'#pv3-screen':'#pv2-screen';
  const firstChoice = first===4?'.p3-choice.yes':'.p3-choice.no';
  await page.evaluate((sel)=>{const s=document.querySelector(sel);s.querySelector('.p3-decision').classList.add('revealed');s.querySelector('.p3-sheet').style.transform='translateY(0)';},firstSel);
  await page.locator(`${firstSel} ${firstChoice}`).click();
  await page.waitForTimeout(400);
  if(first===3) await page.locator(`${firstSel} .p3-price-input input`).fill('50000');
  await page.locator(`${firstSel} .p3-cta`).click();
  await page.waitForTimeout(900);
  const second = await activeScreen(page);
  const secondSel = second===4?'#pv3-screen':'#pv2-screen';
  const secondChoice = second===4?'.p3-choice.yes':'.p3-choice.no';
  await page.evaluate((sel)=>{const s=document.querySelector(sel);s.querySelector('.p3-decision').classList.add('revealed');s.querySelector('.p3-sheet').style.transform='translateY(0)';},secondSel);
  await page.locator(`${secondSel} ${secondChoice}`).click();
  await page.waitForTimeout(400);
  if(second===3) await page.locator(`${secondSel} .p3-price-input input`).fill('50000');
  await page.locator(`${secondSel} .p3-cta`).click();
  await page.waitForTimeout(2700); // 스켈레톤 시퀀스 종료까지 대기(콘텐츠 최종 크기 확정)
  const scr = await activeScreen(page);
  if(scr!==5) throw new Error('SCR-004 진입 실패 active='+scr);
}

const browser = await chromium.launch();
for (const vp of [{w:375,h:667,name:'iPhoneSE'},{w:390,h:844,name:'iPhone13'},{w:360,h:600,name:'짧은화면-Flip'},{w:412,h:915,name:'AndroidLarge'}]) {
  const page = await browser.newPage({viewport:{width:vp.w,height:vp.h}});
  await navigateToScr004(page);
  const m = await page.evaluate(() => {
    const sheet = document.querySelector('#pv4-screen .sheet');
    const body = document.querySelector('#pv4-screen .body');
    const phone = document.querySelector('.pv-phone');
    return {
      sheetClientHeight: sheet.clientHeight,
      sheetScrollHeight: sheet.scrollHeight,
      bodyHeight: body.scrollHeight,
      phoneHeight: phone.getBoundingClientRect().height,
      overflow: sheet.scrollHeight - sheet.clientHeight,
    };
  });
  console.log(vp.name, vp.w+'x'+vp.h, JSON.stringify(m));
  await page.close();
}
await browser.close();
server.close();
