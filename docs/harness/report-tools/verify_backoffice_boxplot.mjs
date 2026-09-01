// SCR-007 가격 편차 박스플롯(FN-010 IQR 전환) 실렌더 검증.
// 칩(pill) 2개가 사라지고 A안·B안 박스플롯 + Q1/중앙값/Q3/전체범위 수치 라벨이
// 실제로 그려지는지, 그리고 explain 토글이 열리는지를 브라우저에서 직접 확인한다.
// 사용법: node verify_backoffice_boxplot.mjs <포트> <스크린샷접미사>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = process.argv[2] ?? "8793";
const suffix = process.argv[3] ?? "01-박스플롯";
// 이 파일(docs/harness/report-tools/) 기준 상대경로 — 사용자명·프로젝트
// 폴더명이 박힌 절대경로를 하드코딩하지 않는다(data-harness-auditor
// 2026-08-28 지적, 다른 프로젝트로 포크되면 즉시 깨지는 패턴).
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "screenshot");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const frame = page.frameLocator("iframe").first();
const chart = frame.locator(".pd-box-chart").first();
await chart.waitFor({ state: "visible", timeout: 20000 });

// 1) 옛 칩(pill)이 완전히 사라졌는지
check("옛 pd-stat-chip 제거", (await frame.locator(".pd-stat-chip").count()) === 0);
const cardText = (await frame.locator(".pd-box-chart").first().innerText()).replace(/\s+/g, " ");
// 옛 칩은 "평균 12.3%" / "범위 4.1~23.0%" 형태였다("전체 범위"는 새 라벨이라 제외)
check("평균/범위 칩 문구 없음", !/평균 [\d.]+%/.test(cardText) && !/(^|[^체] )범위 [\d.]+~/.test(cardText),
    cardText.slice(0, 120));

// 2) 박스플롯 구성요소가 실제로 그려졌는지(A안·B안 2줄)
const boxes = await chart.locator('svg rect[stroke-width="1.6"]').count();
const medians = await chart.locator('svg line[stroke-width="3"]').count();
check("상자(Q1~Q3) 2개", boxes === 2, `count=${boxes}`);
check("중앙선 2개", medians === 2, `count=${medians}`);

// 3) 수치 라벨 4종이 A·B 각각에 있는지
const statRows = chart.locator(".pd-box-stats");
check("수치 라벨 행 2개(A안·B안)", (await statRows.count()) === 2);
for (const [i, label] of [["0", "A안"], ["1", "B안"]]) {
    const row = (await statRows.nth(Number(i)).innerText()).replace(/\s+/g, " ");
    const ok = row.includes(label) && /Q1 [\d.]+%/.test(row) && /중앙값 [\d.]+%/.test(row)
        && /Q3 [\d.]+%/.test(row) && /전체 범위 [\d.]+~[\d.]+%/.test(row);
    check(`${label} 수치 라벨(Q1·중앙값·Q3·전체범위)`, ok, row);
}

// 4) 상자가 실제로 화면에서 보이는 크기인지(0폭으로 찌그러지지 않았는지)
const boxRect = await chart.locator('svg rect[stroke-width="1.6"]').first().boundingBox();
check("상자가 보이는 크기", boxRect && boxRect.width >= 2 && boxRect.height >= 8,
    boxRect ? `${boxRect.width.toFixed(1)}x${boxRect.height.toFixed(1)}` : "null");

// 5) 차트가 카드 폭을 넘지 않는지(오버플로 회귀 방지)
const overflow = await chart.evaluate((el) => ({
    scroll: el.scrollWidth, client: el.clientWidth,
    svgTop: el.querySelector("svg").getBoundingClientRect().top,
}));
check("가로 오버플로 없음", overflow.scroll <= overflow.client + 1, `${overflow.scroll} vs ${overflow.client}`);

// 6) 해석 문구 + 이 라운드에서 갱신한 explain 토글
check("박스플롯 해석 문구", cardText.length > 0 && (await frame.locator(".item-note").allInnerTexts())
    .some((t) => t.includes("상자가 넓을수록")));
// 가격 편차 카드(=마지막 state-pending 카드) 안의 토글을 이름이 아니라 위치로 특정한다
const pdCard = frame.locator(".card.state-pending").last();
await pdCard.locator(".explain-toggle").click();
await page.waitForTimeout(600);
const pdPanel = (await pdCard.locator(".explain-panel").innerText()).replace(/\s+/g, " ");
check("가격편차 토글에 박스플롯 설명 추가됨", pdPanel.includes("박스플롯 읽는 법") && pdPanel.includes("왜 최소~최대가 아니라 상자인가요"), pdPanel.slice(0, 100));

// 7) 푸터 캡션 — 예시 데이터일 때만 "예시입니다" 문장
const badge = await frame.locator(".sample-badge").count();
const caption = (await frame.locator("p.caption").innerText()).replace(/\s+/g, " ");
const captionHasSampleNote = caption.includes("모든 수치는 예시입니다");
check("캡션 예시 안내 = 배지 유무와 일치", (badge > 0) === captionHasSampleNote,
    `badge=${badge}, caption앞부분="${caption.slice(0, 40)}"`);

await chart.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const cardShot = `${outDir}/backoffice-boxplot-${suffix}-카드.png`;
await frame.locator(".card.state-pending").last().screenshot({ path: cardShot });
const fullShot = `${outDir}/backoffice-boxplot-${suffix}-전체.png`;
await page.screenshot({ path: fullShot, fullPage: true });

// 8) 다크 모드에서도 대비가 유지되는지
const darkPage = await browser.newPage({ viewport: { width: 1280, height: 1100 }, colorScheme: "dark" });
await darkPage.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await darkPage.waitForTimeout(3500);
const darkFrame = darkPage.frameLocator("iframe").first();
const darkChart = darkFrame.locator(".pd-box-chart").first();
await darkChart.waitFor({ state: "visible", timeout: 20000 });
await darkChart.scrollIntoViewIfNeeded();
const darkShot = `${outDir}/backoffice-boxplot-${suffix}-다크.png`;
await darkFrame.locator(".card.state-pending").last().screenshot({ path: darkShot });
check("다크 모드 렌더", (await darkChart.locator("svg").count()) === 1);

await browser.close();

for (const r of results) console.log(`${r.ok ? "[PASS]" : "[FAIL]"} ${r.name} — ${r.detail}`);
console.log(`스크린샷: ${cardShot}\n          ${fullShot}\n          ${darkShot}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
