// 가격 편차 카드 전체(중앙값 막대 + 박스플롯)를 iframe 안에서 직접 스크롤해 캡처한다.
import { chromium } from "playwright";
const port = process.argv[2] ?? "8793";
const scheme = process.argv[3] ?? "light";
const out = process.argv[4] ?? "/tmp/pd_card.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, colorScheme: scheme });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
const handle = await page.locator("iframe").first().elementHandle();
const frame = await handle.contentFrame();
await frame.locator(".pd-box-chart").waitFor({ state: "visible", timeout: 20000 });
const target = frame.locator(".card.state-pending").last().locator(".metric-card");
const box = await target.boundingBox();
console.log("metric-card box:", JSON.stringify(box));
await target.screenshot({ path: out });
console.log("saved", out);
await browser.close();
