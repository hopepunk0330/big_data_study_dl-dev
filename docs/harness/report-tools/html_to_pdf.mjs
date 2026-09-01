// HTML -> PDF 변환 (report-writer 파이프라인의 PDF 산출 단계)
// 사용법: node html_to_pdf.mjs <입력.html> <출력.pdf>
import { chromium } from 'playwright';
import { resolve } from 'path';

const [, , htmlPath, pdfPath] = process.argv;
if (!htmlPath || !pdfPath) {
    console.error('사용법: node html_to_pdf.mjs <입력.html> <출력.pdf>');
    process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: 'networkidle' });
await page.pdf({
    path: resolve(pdfPath),
    format: 'A4',
    margin: { top: '25mm', bottom: '25mm', left: '25mm', right: '25mm' },
    printBackground: true,
});
await browser.close();
console.log(`saved: ${pdfPath}`);
