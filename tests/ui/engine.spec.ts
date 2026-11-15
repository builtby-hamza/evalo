import { expect, test } from "@playwright/test";
import { Chess } from "chess.js";
import { parseInfo } from "../../lib/chess/engine";

test("engine scores are normalized to White and bound scores are ignored", () => {
  expect(parseInfo("info depth 12 score cp 85 pv e2e4 e7e5", true)).toMatchObject({ cp: 85, move: "e2e4", depth: 12 });
  expect(parseInfo("info depth 12 score cp 85 pv e7e5", false)).toMatchObject({ cp: -85 });
  expect(parseInfo("info depth 20 score mate -3 pv a1a2", false)).toMatchObject({ mate: 3 });
  expect(parseInfo("info depth 12 score cp 90 lowerbound pv e2e4", true)).toBeNull();
});

test("Lite analyzes locally, follows history and flip, and stops when disabled", async ({ page }, testInfo) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Engine analysis" });
  await expect(panel).toContainText("Stockfish 19 Lite");
  await expect(panel.locator(".engine-status")).toContainText(/Ready · Depth \d+ · Best/, { timeout: 30000 });
  expect(requests.some((url) => url.endsWith("stockfish-19-single.wasm"))).toBe(false);
  const arrow = page.locator('[data-engine-arrow] path[marker-end]');
  await expect(arrow).toHaveCount(1);
  await expect(arrow).toHaveAttribute("stroke", "#318ce7");
  const square = (name: string) => page.locator(`[data-square="${name}"]`);
  await square("e2").click(); await square("e4").click();
  await square("e7").click(); await square("e5").click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(panel.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
  const chess = new Chess(); chess.move("e4");
  const legal = chess.moves({ verbose: true }).map((move) => `${move.from}-${move.to}`);
  expect(legal).toContain(await arrow.getAttribute("data-arrow"));
  const path = await arrow.getAttribute("d");
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  await expect(arrow).not.toHaveAttribute("d", path!);
  await expect(page.locator(".evaluation-bar")).toHaveAttribute("data-orientation", "black");
  await page.screenshot({ path: testInfo.outputPath("engine-analysis.png"), fullPage: true });
  await panel.getByRole("checkbox", { name: "Engine", exact: true }).uncheck();
  await expect(arrow).toHaveCount(0);
  await expect(panel.locator(".engine-status")).toHaveText("Off");
  await panel.getByRole("checkbox", { name: "Engine", exact: true }).check();
  await expect(panel.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
  expect(errors).toEqual([]);
});

test("full Stockfish 19 is opt-in, analyzes locally and is reused from browser cache", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(90000);
  let downloads = 0;
  page.on("request", (request) => { if (request.url().endsWith("stockfish-19-single.wasm")) downloads++; });
  await page.goto("/");
  await page.getByRole("button", { name: "Engine settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Engine settings" });
  await expect(dialog).toContainText("about 95 MB");
  expect(downloads).toBe(0);
  await dialog.getByRole("button", { name: "Download / use full engine" }).click();
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 60000 });
  expect(downloads).toBe(1);
  await expect(page.locator('[data-engine-arrow] path[marker-end]')).toHaveCount(1);
  await dialog.getByRole("button", { name: "Use Lite" }).click();
  await expect(page.locator(".engine-heading > strong")).toHaveText("Stockfish 19 Lite");
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
  await dialog.getByRole("button", { name: "Download / use full engine" }).click();
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 30000 });
  expect(downloads).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("engine download failures can be retried without breaking the board", async ({ page }) => {
  await page.route("**/stockfish-19-lite-single.wasm", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/");
  await expect(page.locator(".engine-panel > .engine-error")).toContainText("Engine download failed");
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await page.unroute("**/stockfish-19-lite-single.wasm");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
});

test("a finished game shows mate and no suggested move", async ({ page }) => {
  await page.goto("/");
  for (const square of ["f2", "f3", "e7", "e5", "g2", "g4", "d8", "h4"]) await page.locator(`[data-square="${square}"]`).click();
  await expect(page.locator(".engine-status")).toHaveText("Game over");
  await expect(page.locator(".evaluation-label")).toHaveText("Mate");
  await expect(page.locator('[data-engine-arrow]')).toHaveCount(0);
  await expect(page.locator(".evaluation-white")).toHaveCSS("height", "0px");
});


test("switching to Lite cancels a pending full-engine download", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/stockfish-19-single.wasm", async (route) => {
    await gate;
    await route.abort().catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Engine settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Download / use full engine" }).click();
  await expect(page.locator(".engine-status")).toContainText("Downloading");
  await dialog.getByRole("button", { name: "Use Lite" }).click();
  release();
  await expect(page.locator(".engine-heading > strong")).toHaveText("Stockfish 19 Lite");
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
  await expect(page.locator(".engine-panel > .engine-error")).toHaveCount(0);
});
