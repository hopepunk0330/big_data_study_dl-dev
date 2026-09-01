// 진단 전용 1회성 스크립트 — 실서비스 배포 URL에서 Amplitude SDK가 실제로 로드/초기화/전송되는지 확인.
import { chromium, webkit } from 'playwright';

const URL = 'https://01-ml-mercari-price-2608.vercel.app/';

async function diagOne(browserType, name) {
    const browser = await browserType.launch();
    const page = await browser.newPage();
    const consoleMsgs = [];
    const ampRequests = [];

    page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`));
    page.on('request', (req) => {
        if (req.url().includes('amplitude')) {
            ampRequests.push(`REQUEST ${req.method()} ${req.url()}`);
        }
    });
    page.on('response', (res) => {
        if (res.url().includes('amplitude')) {
            ampRequests.push(`RESPONSE ${res.status()} ${res.url()}`);
        }
    });
    page.on('requestfailed', (req) => {
        if (req.url().includes('amplitude')) {
            ampRequests.push(`FAILED ${req.url()} — ${req.failure()?.errorText}`);
        }
    });

    await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);

    const ampState = await page.evaluate(() => {
        const a = window.amplitude;
        return {
            exists: !!a,
            hasInit: !!(a && typeof a.init === 'function'),
            hasTrack: !!(a && typeof a.track === 'function'),
            invoked: a ? !!a.invoked : null,
            keys: a ? Object.keys(a) : [],
        };
    });

    console.log(`\n=== ${name} ===`);
    console.log('window.amplitude 상태:', JSON.stringify(ampState));
    console.log('--- amplitude 관련 네트워크 ---');
    if (ampRequests.length === 0) console.log('(amplitude로 나간 요청이 하나도 없음)');
    ampRequests.forEach((l) => console.log(l));
    console.log('--- 콘솔 메시지 ---');
    if (consoleMsgs.length === 0) console.log('(콘솔 메시지 없음)');
    consoleMsgs.forEach((l) => console.log(l));

    await browser.close();
}

await diagOne(chromium, 'chromium');
await diagOne(webkit, 'webkit (Safari 엔진)');
