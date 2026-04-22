import { chromium, devices } from "playwright";

const BASE = "http://localhost:8765/chinese/";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});

const errors = [];
const logs = [];

async function fail(msg) {
  errors.push(msg);
  console.error("FAIL:", msg);
}

async function page_info(page) {
  return await page.evaluate(() => ({
    cardCount: document.querySelectorAll(".card").length,
    cardsText: Array.from(document.querySelectorAll(".card .char")).map((e) => e.textContent),
    modalOpen: document.querySelector(".modal-root.open") !== null,
  }));
}

// 1) Desktop viewport
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => logs.push(`[console ${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(BASE);
  await page.waitForSelector(".card", { timeout: 5000 });
  const info1 = await page_info(page);
  console.log("Grid:", info1);
  if (info1.cardCount !== 11) await fail(`expected 11 cards, got ${info1.cardCount}`);
  const expected = ["叫","对","你","好","我","老师","学生","水","瓶","一","咖啡"];
  const actual = info1.cardsText;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    await fail(`card order mismatch\n expected: ${expected.join(" ")}\n actual:   ${actual.join(" ")}`);
  }

  // 2) Click "你" and verify detail opens with components
  const ni = page.locator(".card", { hasText: "你" });
  await ni.click();
  await page.waitForSelector(".modal-root.open .char-section", { timeout: 3000 });
  const detail = await page.evaluate(() => ({
    sections: document.querySelectorAll(".char-section").length,
    title: document.querySelector(".modal-title")?.textContent?.trim(),
    components: Array.from(document.querySelectorAll(".component-char")).map((e) => ({
      char: e.textContent,
      role: Array.from(e.classList).find((c) => c.startsWith("role-")),
    })),
    hasEtym: !!document.querySelector(".etym"),
  }));
  console.log("你 detail:", detail);
  if (detail.sections !== 1) await fail(`expected 1 char-section for 你, got ${detail.sections}`);
  if (!detail.components.find((c) => c.char === "亻" && c.role === "role-meaning")) {
    await fail("expected 亻 as meaning component of 你");
  }
  if (!detail.components.find((c) => c.char === "尔" && c.role === "role-sound")) {
    await fail("expected 尔 as sound component of 你");
  }

  // 3) Click component 亻 to navigate
  await page.locator(".component-row", { hasText: "亻" }).first().click();
  await page.waitForTimeout(300);
  const nested = await page.evaluate(() => ({
    title: document.querySelector(".modal-title")?.textContent?.trim(),
    sections: document.querySelectorAll(".char-section").length,
  }));
  console.log("component nav (亻):", nested);
  if (!nested.title?.startsWith("亻")) await fail(`expected title to start with 亻, got "${nested.title}"`);

  // 4) Browser back should return to 你 detail
  await page.goBack();
  await page.waitForTimeout(300);
  const afterBack = await page.evaluate(() => document.querySelector(".modal-title")?.textContent?.trim());
  console.log("after goBack:", afterBack);
  if (!afterBack?.startsWith("你")) await fail(`expected 你 after back, got "${afterBack}"`);

  // 5) Back again closes modal
  await page.goBack();
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => !document.querySelector(".modal-root.open"));
  console.log("modal closed after 2nd back:", closed);
  if (!closed) await fail("expected modal to close after second back");

  // 6) Open 老师 and verify two stacked char sections
  await page.locator(".card", { hasText: "老师" }).click();
  await page.waitForSelector(".modal-root.open .char-section", { timeout: 3000 });
  const laoshi = await page.evaluate(() => ({
    sections: document.querySelectorAll(".char-section").length,
    chars: Array.from(document.querySelectorAll(".char-section .char-big")).map((e) => e.textContent),
  }));
  console.log("老师 detail:", laoshi);
  if (laoshi.sections !== 2) await fail(`expected 2 char-sections for 老师, got ${laoshi.sections}`);
  if (JSON.stringify(laoshi.chars) !== JSON.stringify(["老", "师"])) {
    await fail(`expected chars [老, 师], got ${JSON.stringify(laoshi.chars)}`);
  }

  // 7) Mnemonic persistence
  const ta = page.locator(".mnemonic textarea").first();
  await ta.click();
  await ta.fill("my story for 老");
  await page.waitForTimeout(500);
  // Reload: app should deep-link back into 老师 via hash, and mnemonic should load from localStorage.
  await page.reload();
  await page.waitForSelector(".modal-root.open .mnemonic textarea", { timeout: 5000 });
  const storedVal = await page.locator(".mnemonic textarea").first().inputValue();
  console.log("mnemonic after reload:", JSON.stringify(storedVal));
  if (storedVal !== "my story for 老") await fail(`mnemonic did not persist, got "${storedVal}"`);
  // Clear it so reruns are idempotent.
  await page.evaluate(() => localStorage.removeItem("chinese.mnemonic.老"));

  // 8) Screenshot for visual verification
  await page.screenshot({ path: "/tmp/chinese-laoshi.png", fullPage: true });

  await page.goto(BASE);
  await page.waitForSelector(".card", { timeout: 3000 });
  await page.screenshot({ path: "/tmp/chinese-grid.png", fullPage: true });

  await context.close();
}

// Mobile viewport smoke
{
  const context = await browser.newContext({ ...devices["iPhone 14"] });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror(mobile): ${e.message}`));
  await page.goto(BASE);
  await page.waitForSelector(".card", { timeout: 5000 });
  await page.locator(".card", { hasText: "咖啡" }).click();
  await page.waitForSelector(".modal-root.open .char-section", { timeout: 3000 });
  await page.screenshot({ path: "/tmp/chinese-mobile-kafei.png", fullPage: true });
  const mobile = await page.evaluate(() => ({
    sections: document.querySelectorAll(".char-section").length,
    chars: Array.from(document.querySelectorAll(".char-big")).map((e) => e.textContent),
  }));
  console.log("mobile 咖啡:", mobile);
  if (mobile.sections !== 2) await fail(`mobile 咖啡 expected 2 sections, got ${mobile.sections}`);
  await context.close();
}

await browser.close();

if (logs.length) {
  console.log("\n--- Console logs ---");
  for (const l of logs) console.log(l);
}
if (errors.length) {
  console.error(`\n${errors.length} FAILURE(S):`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
