// 진단 전용 1회성 스크립트 — Clarity 스크립트 삽입 후 문법 오류·window.clarity 존재 확인.
import { chromium } from 'playwright';
const URL = 'file://' + process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const hasClarity = await page.evaluate(() => typeof window.clarity === 'function');
console.log('clarity 함수 존재:', hasClarity);
console.log('콘솔/페이지 에러:', errs.length, errs);
await browser.close();
