import { chromium, devices } from 'playwright';

const iPhone = devices['iPhone 14'];

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const context = await browser.newContext({
  ...iPhone,
});
const page = await context.newPage();
await page.goto('file:///home/user/Ai-/palette.html');
await page.waitForTimeout(2000);

// Select a color (e.g., the 3rd swatch - red)
const swatches = await page.$$('.color-swatch');
if (swatches.length > 2) {
  await swatches[2].click();
}
await page.waitForTimeout(300);

// Get canvas bounding box
const canvasBox = await page.$eval('#drawing-canvas', el => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

console.log('Canvas box:', canvasBox);

// Helper to simulate a brush stroke
async function paintStroke(points) {
  if (points.length < 2) return;
  const [start, ...rest] = points;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const p of rest) {
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
}

const cx = canvasBox.x + canvasBox.w / 2;
const cy = canvasBox.y + canvasBox.h / 2;

// Stroke 1: horizontal line across center
await paintStroke([
  { x: canvasBox.x + 30, y: cy },
  { x: canvasBox.x + canvasBox.w - 30, y: cy },
]);
await page.waitForTimeout(200);

// Select blue (swatch index 4)
if (swatches.length > 4) {
  await swatches[4].click();
}
await page.waitForTimeout(300);

// Stroke 2: vertical line
await paintStroke([
  { x: cx, y: canvasBox.y + 30 },
  { x: cx, y: canvasBox.y + canvasBox.h - 30 },
]);
await page.waitForTimeout(200);

// Select yellow (swatch index 1)
if (swatches.length > 1) {
  await swatches[1].click();
}
await page.waitForTimeout(300);

// Stroke 3: diagonal
await paintStroke([
  { x: canvasBox.x + 30, y: canvasBox.y + 30 },
  { x: canvasBox.x + canvasBox.w - 30, y: canvasBox.y + canvasBox.h - 30 },
]);
await page.waitForTimeout(200);

// Stroke 4: circle-ish curve
const radius = Math.min(canvasBox.w, canvasBox.h) * 0.25;
const circlePoints = [];
for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 12) {
  circlePoints.push({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });
}
// Select green (swatch index 6 or so)
if (swatches.length > 6) {
  await swatches[6].click();
}
await page.waitForTimeout(300);
await paintStroke(circlePoints);

// Wait for rendering
await page.waitForTimeout(1000);

// Take screenshots
await page.screenshot({ path: '/home/user/Ai-/mobile-full.png', fullPage: false });
const canvas = await page.$('#drawing-canvas');
if (canvas) {
  await canvas.screenshot({ path: '/home/user/Ai-/mobile-canvas.png' });
}
const panel = await page.$('#palette-panel');
if (panel) {
  await panel.screenshot({ path: '/home/user/Ai-/mobile-palette.png' });
}

console.log('Paint test screenshots saved');
await browser.close();
