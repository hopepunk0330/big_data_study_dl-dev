// SVG -> 고해상도 PNG 변환 (Word/PPT처럼 벡터 SVG를 못 받는 포맷용 에셋 생성)
// 사용법: node svg_to_png.mjs <입력.svg> <출력.png> [scale=3]
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const [, , svgPath, pngPath, scaleArg] = process.argv;
if (!svgPath || !pngPath) {
    console.error('사용법: node svg_to_png.mjs <입력.svg> <출력.png> [scale=3]');
    process.exit(1);
}
const scale = Number(scaleArg || 3);
const svg = readFileSync(resolve(svgPath), 'utf-8');

const widthMatch = svg.match(/width="([\d.]+)/);
const heightMatch = svg.match(/height="([\d.]+)/);
const viewBoxMatch = svg.match(/viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/);
const width = Math.ceil(Number(widthMatch?.[1] ?? viewBoxMatch?.[1] ?? 800));
const height = Math.ceil(Number(heightMatch?.[1] ?? viewBoxMatch?.[2] ?? 600));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
await page.locator('svg').screenshot({ path: resolve(pngPath), omitBackground: true });
await browser.close();
console.log(`saved: ${pngPath} (${width}x${height} @${scale}x)`);
