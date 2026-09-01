// 진단 전용 1회성 스크립트 — 실제 배포된 URL에서 Clarity로 실제 네트워크 요청이 나가는지 확인.
import { chromium } from 'playwright';
const URL = 'https://01-ml-mercari-price-2608.vercel.app/';
const browser = await chromium.launch();
const page = await browser.newPage();
const clarityReqs = [];
page.on('request', (req) => { if (req.url().includes('clarity')) clarityReqs.push('REQ ' + req.method() + ' ' + req.url()); });
page.on('response', (res) => { if (res.url().includes('clarity')) clarityReqs.push('RES ' + res.status() + ' ' + res.url()); });
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(4000);
const hasClarity = await page.evaluate(() => typeof window.clarity === 'function');
console.log('window.clarity 존재:', hasClarity);
console.log('clarity 관련 네트워크:');
clarityReqs.forEach((l) => console.log(l));
if (clarityReqs.length === 0) console.log('(요청 없음)');
await browser.close();
