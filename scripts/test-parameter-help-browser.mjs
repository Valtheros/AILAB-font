// API writes are mocked: this check never creates tasks or starts real training.
// PLAYWRIGHT_MODULE=/path/to/playwright OUTPUT_DIR=/home/... node scripts/test-parameter-help-browser.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href : "playwright");
const base = process.env.HELP_TEST_URL || "http://127.0.0.1:3001";
const output = process.env.OUTPUT_DIR;

async function main() {
  assert(output && path.isAbsolute(output), "Set OUTPUT_DIR to an absolute workspace path");
  await fs.mkdir(output, { recursive: true });
  const catalog = await (await fetch(process.env.CATALOG_URL || "http://127.0.0.1:8000/api/model-catalog")).json();
  const deviceSpec = catalog.common_params.find((spec) => spec.key === "device");
  deviceSpec.default = "0";
  deviceSpec.options = [{ value: "0", label: "Test GPU" }, { value: "cpu", label: "CPU" }];
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  let screenshots = 0;

  async function setup(width, theme, language, modelId = "yolo", scale = 1) {
    const context = await browser.newContext({ viewport: { width, height: 900 / scale }, deviceScaleFactor: scale, hasTouch: width < 768 && scale === 1, isMobile: width < 768 && scale === 1 });
    await context.addCookies([
      { name: "theme", value: theme, url: base },
      { name: "language", value: language, url: base },
    ]);
    await context.addInitScript(({ theme, language }) => {
      localStorage.setItem("theme", theme);
      localStorage.setItem("language", language);
    }, { theme, language });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    const group = catalog.tasks.find((item) => item.models.some((model) => model.id === modelId));
    const model = group.models.find((item) => item.id === modelId);
    const params = Object.fromEntries([...catalog.common_params, ...model.params].map((spec) => [spec.key, spec.default]));
    Object.assign(params, model.safe_defaults);
    let task = {
      id: "help-test", status: "draft", displayName: "Help test", projectName: "Help test",
      taskType: group.id, modelType: model.id, modelName: model.model_name,
      datasetName: "help-dataset", params, epochs: params.epochs, batchSize: params.batch_size,
      workers: params.workers, amp: params.amp, seed: params.seed, device: params.device, deviceSelection: "manual",
    };
    const writes = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url()).pathname;
      let body = {};
      if (url.includes("/auth/get-session")) {
        // Let the server-rendered loading boundary hydrate before resolving auth.
        await new Promise((resolve) => setTimeout(resolve, 500));
        body = {
        user: { id: "help-user", name: "Help Tester", email: "help@example.com", emailVerified: true },
        session: { id: "help-session", userId: "help-user", expiresAt: "2099-01-01T00:00:00.000Z" },
        };
      }
      else if (url.endsWith("/api/model-catalog")) body = catalog;
      else if (url.endsWith("/api/datasets")) body = { datasets: [{
        id: "help-dataset", name: "help-dataset", images: 80, formats: model.dataset_formats, tasks: [group.id],
        compatibleModels: catalog.tasks.flatMap((item) => item.models.map((m) => ({ id: m.id, ready: true }))),
        labelSchema: { origin: "ailab_label", task: "semantic_segmentation", classes: [{ name: "Road", train_id: 1 }] },
      }] };
      else if (url.endsWith("/resource-plan/preview")) body = { estimatedVramMb: 2000, safeLimitMb: 10000, isWithinLimit: true };
      else if (url.endsWith("/tasks/help-test/start")) { writes.push({ method: "POST", url }); }
      else if (url.endsWith("/tasks/help-test")) {
        if (request.method() === "PATCH") {
          const payload = request.postDataJSON();
          writes.push({ method: "PATCH", payload });
          task = { ...task, epochs: payload.epochs, params: payload.params, displayName: payload.display_name };
        }
        body = task;
      }
      else if (!['GET', 'HEAD'].includes(request.method())) {
        errors.push(`Unexpected write: ${request.method()} ${url}`);
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${base}/tasks/help-test`);
    await page.getByRole("button", { name: "Save draft", exact: true }).waitFor();
    await page.waitForTimeout(600);
    return { page, context, writes };
  }

  async function withinViewport(page) {
    const bounds = await page.getByRole("dialog").boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1, "Dialog overflows horizontally");
    assert(bounds.y >= -1 && bounds.y + bounds.height <= viewport.height + 1, "Dialog overflows vertically");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page overflows horizontally");
  }

  try {
    for (const language of ["en", "th"]) for (const theme of ["light", "dark"]) for (const width of [360, 390, 768, 1440]) {
      const { page, context, writes } = await setup(width, theme, language);
      const help = page.getByRole("button", { name: /^(About|คำอธิบาย):.*(Batch size)/ });
      const before = await page.locator("input").evaluateAll((inputs) => inputs.map((input) => input.value));
      assert(await page.getByRole("button", { name: "Save draft", exact: true }).isDisabled());
      if (width >= 768) {
        await help.hover();
        await page.getByRole("tooltip").waitFor();
      }
      if (width < 768) await help.tap(); else await help.click();
      await page.getByRole("dialog").waitFor();
      assert.equal(await page.getByRole("tooltip").count(), 0);
      await withinViewport(page);
      await page.screenshot({ path: path.join(output, `help-${language}-${theme}-${width}.png`) });
      screenshots++;
      console.log(`Verified ${language}/${theme}/${width}`);
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForFunction((name) => document.activeElement?.getAttribute("aria-label") === name, await help.getAttribute("aria-label"));
      assert(await help.evaluate((button) => document.activeElement === button), "Focus did not return to Help");
      assert.deepEqual(await page.locator("input").evaluateAll((inputs) => inputs.map((input) => input.value)), before);
      assert(await page.getByRole("button", { name: "Save draft", exact: true }).isDisabled());
      assert.equal(writes.length, 0);
      await page.screenshot({ path: path.join(output, `form-${language}-${theme}-${width}.png`), fullPage: true });
      await context.close();
    }

    const { page, context, writes } = await setup(1440, "dark", "en");
    const batchHelp = page.getByRole("button", { name: /^About:.*Batch size/ });
    await batchHelp.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label")?.includes("Batch size"));
    await page.keyboard.press("Space");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByLabel("Training rounds (Epochs)", { exact: true }).fill("51");
    await page.getByRole("tooltip").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: /^About:.*Epochs/ }).click();
    assert.match(await page.getByRole("dialog").innerText(), /51/);
    assert.match(await page.getByRole("dialog").innerText(), /50/);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent === 'Save draft' && button.disabled));
    await batchHelp.click();
    await page.keyboard.press("Escape");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].payload.epochs, 51);
    await page.getByRole("button", { name: "Train", exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(writes[1]?.method, "POST");

    await page.getByRole("button", { name: /^Faster R-CNN/ }).click();
    await page.getByRole("button", { name: /^About:.*Short side/ }).click();
    assert.match(await page.getByRole("dialog").innerText(), /preserving aspect ratio/);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Switch language to Thai" }).click();
    await page.getByRole("button", { name: /^คำอธิบาย:.*Short side/ }).click();
    assert.match(await page.getByRole("dialog").innerText(), /รักษาอัตราส่วนภาพ/);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Switch language to English" }).click();

    await context.close();

    // Emulate the CSS viewport and pixel density of 1440x900 at 200% zoom.
    const zoom = await setup(720, "dark", "en", "faster_rcnn", 2);
    await zoom.page.getByRole("button", { name: /^About:.*Memory Safety/ }).click();
    await withinViewport(zoom.page);
    const shot = await zoom.page.screenshot({ path: path.join(output, "help-zoom-200.png") });
    assert(shot.length > 10000, "Zoom screenshot appears blank");
    await zoom.page.getByRole("dialog").evaluate((dialog) => { dialog.scrollTop = dialog.scrollHeight; });
    await zoom.page.screenshot({ path: path.join(output, "help-zoom-200-scrolled.png") });
    await zoom.context.close();

    for (const model of ["resnet", "efficientnet", "faster_rcnn", "mask_rcnn", "deeplabv3plus"]) {
      const { page, context } = await setup(390, "light", "th", model);
      const key = model === "deeplabv3plus" ? /Mask classes/ : /Batch size/;
      await page.getByRole("button", { name: key }).tap();
      const text = await page.getByRole("dialog").innerText();
      assert(!text.includes("undefined"));
      if (model === "deeplabv3plus") {
        assert(text.includes("อัตโนมัติ"));
        assert.equal(await page.getByRole("spinbutton", { name: /Mask classes/ }).count(), 0);
      }
      await withinViewport(page);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${screenshots} viewport/theme/language cases, keyboard, isolated Help state, defaults, managed classes and mocked Save -> Train`);
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
