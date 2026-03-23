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

// Get computed styles and dimensions
const info = await page.evaluate(() => {
  const app = document.getElementById('app');
  const panel = document.getElementById('palette-panel');
  const controls = document.getElementById('palette-controls');
  const buttons = document.querySelectorAll('.ctrl-btn');
  const waterJar = document.getElementById('water-jar');
  const cs = getComputedStyle;
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    app: {
      cols: cs(app).gridTemplateColumns,
      rows: cs(app).gridTemplateRows,
      w: app.offsetWidth, h: app.offsetHeight
    },
    panel: {
      w: panel.offsetWidth, h: panel.offsetHeight,
      overflow: cs(panel).overflow,
      display: cs(panel).display,
      flexDir: cs(panel).flexDirection
    },
    controls: {
      w: controls.offsetWidth, h: controls.offsetHeight,
      display: cs(controls).display,
      gridCols: cs(controls).gridTemplateColumns,
      overflow: cs(controls).overflow
    },
    buttons: [...buttons].map(b => ({
      text: b.textContent,
      w: b.offsetWidth, h: b.offsetHeight,
      visible: b.offsetWidth > 0 && b.offsetHeight > 0,
      rect: b.getBoundingClientRect()
    })),
    waterJar: {
      w: waterJar.offsetWidth,
      textOverflow: cs(document.getElementById('water-jar-label')).textOverflow
    }
  };
});
console.log(JSON.stringify(info, null, 2));

// Screenshot of just controls
const controls = await page.$('#palette-controls');
if (controls) {
  await controls.screenshot({ path: '/home/user/Ai-/mobile-controls.png' });
}

await page.screenshot({ path: '/home/user/Ai-/mobile-full.png', fullPage: false });
const panel = await page.$('#palette-panel');
if (panel) {
  await panel.screenshot({ path: '/home/user/Ai-/mobile-palette.png' });
}

await browser.close();
