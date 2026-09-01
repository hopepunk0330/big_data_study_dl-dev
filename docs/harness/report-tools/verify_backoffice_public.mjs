// SCR-007 백오피스 공개화 검증 — 비밀번호 게이트 없이 대시보드가 바로 뜨는지,
// COLLECTION_CLOSED 값에 따라 상태 배너가 갈리는지 실제 렌더로 확인한다.
// 사용법: node verify_backoffice_public.mjs <포트> <스크린샷접미사> <기대배너: in-progress|complete>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = process.argv[2] ?? "8791";
const suffix = process.argv[3] ?? "01-진행중";
const expected = process.argv[4] ?? "in-progress";
// 이 파일(docs/harness/report-tools/) 기준 상대경로 — 사용자명·프로젝트
// 폴더명이 박힌 절대경로를 하드코딩하지 않는다(data-harness-auditor
// 2026-08-28 지적, 다른 프로젝트로 포크되면 즉시 깨지는 패턴).
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "screenshot");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

// 1) 비밀번호 입력란이 없어야 한다
const pwInputs = await page.locator('input[type="password"]').count();
check("비밀번호 입력란 없음", pwInputs === 0, `count=${pwInputs}`);

// 2) 토글 위젯이 없어야 한다
const toggles = await page.locator('[data-testid="stCheckbox"], [data-testid="stToggle"]').count();
check("수집 완료 토글 없음", toggles === 0, `count=${toggles}`);

// 3) 대시보드 iframe이 바로 렌더돼야 한다
const frame = page.frameLocator('iframe[title="st.iframe"], iframe[title="streamlit_component"], iframe').first();
const banner = frame.locator(".status-banner").first();
await banner.waitFor({ state: "visible", timeout: 20000 });
const bannerClass = await banner.getAttribute("class");
const bannerText = (await banner.innerText()).replace(/\s+/g, " ").trim();
check(`상태 배너=${expected}`, bannerClass.includes(expected), `class="${bannerClass}" text="${bannerText}"`);

// 4) 대시보드 본문(핵심 카드)이 실제로 그려졌는지
const cards = await frame.locator(".card, .kpi, .verdict-title").count();
check("대시보드 본문 렌더", cards > 0, `요소 ${cards}개`);

const file = `${outDir}/backoffice-public-${suffix}.png`;
await page.screenshot({ path: file, fullPage: true });
await browser.close();

for (const r of results) console.log(`${r.ok ? "[PASS]" : "[FAIL]"} ${r.name} — ${r.detail}`);
console.log(`스크린샷: ${file}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
