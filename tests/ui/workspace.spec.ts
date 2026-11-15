import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-square="e2"] [data-piece="wP"]')).toBeVisible();
});

test("light theme, visible board, responsive layout, and panel switching", async ({ page }, testInfo) => {
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(230, 227, 217)");
  await expect(page.locator(".context-card")).toHaveCSS("background-color", "rgb(243, 240, 231)");
  await expect(page.locator('[data-square="a8"]')).toHaveCSS("background-color", "rgb(238, 238, 210)");
  await expect(page.locator('[data-square="b8"]')).toHaveCSS("background-color", "rgb(118, 150, 86)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("workspace.png"), fullPage: true });
  await page.getByRole("button", { name: "Analyze a Game" }).click();
  await page.getByLabel("Game notation").fill("1. e4 e5 2. Nf3 Nc6");
  await page.getByRole("button", { name: "Game Link", exact: true }).click();
  await page.getByLabel("Game link", { exact: true }).fill("https://lichess.org/example");
  await page.getByRole("button", { name: "Paste PGN", exact: true }).click();
  await expect(page.getByLabel("Game notation")).toHaveValue("1. e4 e5 2. Nf3 Nc6");
  await page.getByRole("button", { name: "Solve a Puzzle", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Puzzles" })).toBeVisible();
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await expect(page.getByLabel("Game notation")).toHaveValue("1. e4 e5 2. Nf3 Nc6");
  await expect(page.getByRole("button", { name: "Analyze game", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("import.png"), fullPage: true });
  await page.getByRole("button", { name: "Back to workspace" }).click();
  await expect(page.getByRole("button", { name: "Analyze a Game", exact: true })).toBeVisible();
});

test("legal moves, invalid moves, history navigation, flip, and reset", async ({ page }) => {
  const square = (name: string) => page.locator(`[data-square="${name}"]`);
  await square("e2").click();
  await square("e5").click();
  await expect(square("e2").locator('[data-piece="wP"]')).toBeVisible();
  await square("e2").click();
  await square("e4").click();
  await expect(square("e4").locator('[data-piece="wP"]')).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Black to move" })).toBeVisible();
  await square("e7").click();
  await square("e5").click();
  await expect(square("e5").locator('[data-piece="bP"]')).toBeVisible();
  await page.getByRole("button", { name: "First move", exact: true }).click();
  await expect(square("e2").locator('[data-piece="wP"]')).toBeVisible();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(square("e4").locator('[data-piece="wP"]')).toBeVisible();
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(square("e5").locator('[data-piece="bP"]')).toBeVisible();
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  const firstSquare = page.locator("[data-square]").first();
  await expect(firstSquare).toHaveAttribute("data-square", "h1");
  await page.getByRole("button", { name: "Reset board", exact: true }).click();
  await expect(square("e2").locator('[data-piece="wP"]')).toBeVisible();
  await expect(page.getByRole("region", { name: "Move history" })).toHaveCount(0);
});

test("file selection displays notation and handles invalid or empty files", async ({ page }) => {
  await page.getByRole("button", { name: "Analyze a Game" }).click();
  await page.getByRole("button", { name: "Upload PGN", exact: true }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.locator("#file-error")).toHaveText("Choose a .pgn file.");
  await fileInput.setInputFiles({ name: "empty.pgn", mimeType: "text/plain", buffer: Buffer.from("") });
  await expect(page.locator("#file-error")).toContainText("This file is empty");
  await fileInput.setInputFiles({ name: "game.pgn", mimeType: "text/plain", buffer: Buffer.from("1. e4 e5 2. Nf3 Nc6") });
  await expect(page.locator(".pgn-preview")).toHaveText("1. e4 e5 2. Nf3 Nc6");
  await expect(page.locator("#file-error")).toHaveCount(0);
});

test("pieces can be moved with the keyboard", async ({ page }) => {
  await page.getByRole("button", { name: "e2, white pawn", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
});

test("pieces can be dragged to a legal destination", async ({ page }) => {
  const source = await page.locator('[data-square="e2"]').boundingBox();
  const target = await page.locator('[data-square="e4"]').boundingBox();
  if (!source || !target) throw new Error("Board squares are missing");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
});

test("selection shows legal targets and only the side to move can be selected", async ({ page }) => {
  const square = (name: string) => page.locator(`[data-square="${name}"]`);
  const tile = (name: string) => page.locator(`[data-board-square="${name}"]`);
  await square("e7").click();
  await expect(page.locator('[data-board-square][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator("[data-legal-target]")).toHaveCount(0);
  await square("e2").click();
  await expect(tile("e2")).toHaveAttribute("aria-pressed", "true");
  await expect(tile("e2")).toHaveCSS("background-color", "rgb(213, 220, 128)");
  await expect(page.locator("[data-legal-target]")).toHaveCount(2);
  await expect(tile("e3")).toHaveAttribute("data-legal-target", "true");
  await expect(tile("e4")).toHaveCSS("background-image", /radial-gradient/);
  await square("e2").click();
  await expect(page.locator("[data-legal-target]")).toHaveCount(0);
  await square("e2").click();
  await square("e4").click();
  await square("g1").click();
  await expect(page.locator('[data-board-square][aria-pressed="true"]')).toHaveCount(0);
  await square("e7").click();
  await expect(tile("e7")).toHaveAttribute("aria-pressed", "true");
  await expect(tile("e6")).toHaveAttribute("data-legal-target", "true");
  await expect(tile("e5")).toHaveAttribute("data-legal-target", "true");
});

test("a legal capture is highlighted and remains playable", async ({ page }) => {
  const square = (name: string) => page.locator(`[data-square="${name}"]`);
  await square("e2").click();
  await square("e4").click();
  await square("d7").click();
  await square("d5").click();
  await square("e4").click();
  await expect(page.locator('[data-board-square="d5"]')).toHaveAttribute("data-legal-target", "true");
  await expect(page.locator('[data-board-square="d5"]')).toHaveCSS("background-image", /radial-gradient\(circle, rgba\(0, 0, 0, 0\) 57%/);
  await square("d5").click();
  await expect(square("d5").locator('[data-piece="wP"]')).toBeVisible();
  await expect(square("d5").locator('[data-piece="bP"]')).toHaveCount(0);
});

test("right-drag draws green arrows, toggles them, and left-click clears them", async ({ page }, testInfo) => {
  const arrows = page.locator('.board-arrows:not([data-engine-arrow]) path[marker-end]');
  async function drawArrow(from: string, to: string) {
    const start = await page.locator(`[data-square="${from}"]`).boundingBox();
    const end = await page.locator(`[data-square="${to}"]`).boundingBox();
    if (!start || !end) throw new Error("Board squares are missing");
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
    await page.mouse.up({ button: "right" });
  }
  await drawArrow("b8", "c6");
  await expect(arrows).toHaveCount(1);
  await expect(arrows.first()).toHaveAttribute("stroke", "#378331");
  // A knight annotation stays straight, like the other arrows.
  expect((await arrows.first().getAttribute("d"))?.match(/L/g)).toHaveLength(1);
  await expect(page.locator('[data-square="b8"] [data-piece="bN"]')).toBeVisible();
  await drawArrow("c7", "d6");
  await expect(arrows).toHaveCount(2);
  const unflippedPath = await arrows.first().getAttribute("d");
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  await expect(arrows.first()).not.toHaveAttribute("d", unflippedPath!);
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("arrows.png"), fullPage: true });
  await drawArrow("b8", "c6");
  await expect(arrows).toHaveCount(1);
  await page.locator('[data-square="e2"]').click();
  await expect(arrows).toHaveCount(0);
  await drawArrow("e2", "f5");
  await expect(arrows).toHaveCount(1);
  await page.locator(".board-frame").screenshot({ path: testInfo.outputPath("arrowhead.png") });
});

test("classic assets load and the desktop board fits the viewport", async ({ page }, testInfo) => {
  const images = page.locator(".board-frame img.chess-piece");
  await expect(images).toHaveCount(32);
  await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0))).toBe(true);
  await expect(images.first()).toHaveAttribute("src", /\/pieces\/cburnett\/bR.svg/);
  if (testInfo.project.name === "desktop") {
    const board = await page.locator(".board-frame").boundingBox();
    const panel = await page.locator(".context-card").boundingBox();
    expect(board!.width).toBeGreaterThan(panel!.width);
    const card = await page.locator(".board-card").boundingBox();
    expect(card!.y + card!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
});

test("out-of-turn pieces never lift while the left button is held", async ({ page }) => {
  const square = (name: string) => page.locator(`[data-square="${name}"]`);
  async function attemptLift(name: string) {
    await square(name).scrollIntoViewIfNeeded();
    const piece = square(name).locator("[data-piece]");
    const before = await piece.boundingBox();
    if (!before) throw new Error("Piece is missing");
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(before.x + before.width / 2 + 65, before.y + before.height / 2 - 65, { steps: 10 });
      // A drag clone or native selection must not appear, even before release.
      await expect(page.locator(".board-frame [data-piece]")).toHaveCount(32);
      expect(await piece.boundingBox()).toEqual(before);
      await expect(page.locator('[data-board-square][aria-pressed="true"]')).toHaveCount(0);
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
    } finally {
      await page.mouse.up();
    }
  }
  await attemptLift("g8");
  await square("e2").click();
  await square("e4").click();
  await expect(page.getByRole("status").filter({ hasText: "Black to move" })).toBeVisible();
  await attemptLift("a2");
  await attemptLift("g1");
  await square("e7").click();
  await square("e5").click();
  await expect(page.getByRole("status").filter({ hasText: "White to move" })).toBeVisible();
  await attemptLift("g8");
  await attemptLift("a7");
});

test("right-button arrows preview while held and survive leaving and reentering the board", async ({ page }) => {
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  // Start on an out-of-turn white piece, just as in the reported gesture.
  await page.locator('[data-square="e4"]').scrollIntoViewIfNeeded();
  const start = await page.locator('[data-square="e4"]').boundingBox();
  const target = await page.locator('[data-square="c5"]').boundingBox();
  const board = await page.locator(".board-frame").boundingBox();
  if (!start || !target || !board) throw new Error("Board is missing");
  const arrow = page.locator('.board-arrows [data-arrow="e4-c5"]');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down({ button: "right" });
  try {
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await expect(arrow).toHaveAttribute("opacity", "0.5");
    await expect(page.locator(".board-frame [data-piece]")).toHaveCount(32);
    await page.mouse.move(board.x - 15, target.y + target.height / 2, { steps: 8 });
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await expect(arrow).toHaveAttribute("opacity", "0.5");
  } finally {
    await page.mouse.up({ button: "right" });
  }
  await expect(arrow).toHaveAttribute("opacity", "0.7");
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Black to move" })).toBeVisible();
});

test("dark mode themes the workspace, preserves the active position, and survives reload", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 29, 25)");
  await expect(page.locator(".context-card")).toHaveCSS("background-color", "rgb(35, 43, 36)");
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Black to move" })).toBeVisible();
  await page.getByRole("button", { name: "Analyze a Game" }).click();
  await expect(page.getByLabel("Game notation")).toHaveCSS("background-color", "rgb(35, 43, 36)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("dark-mode.png"), fullPage: true });
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 29, 25)");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(230, 227, 217)");
  expect(errors).toEqual([]);
});


test("arrow keys navigate history without changing text input, and right-click toggles red marks", async ({ page }) => {
  const square = (name: string) => page.locator(`[data-square="${name}"]`);
  const tile = page.locator('[data-board-square="e4"]');
  await square("e2").click();
  await square("e4").click();
  await square("e4").click({ button: "right" });
  await expect(tile).toHaveCSS("background-color", "rgb(230, 107, 100)");
  await square("e4").click({ button: "right" });
  await expect(tile).not.toHaveCSS("background-color", "rgb(230, 107, 100)");
  await square("e4").click({ button: "right" });
  await page.keyboard.press("ArrowLeft");
  await expect(square("e2").locator('[data-piece="wP"]')).toBeVisible();
  await expect(tile).not.toHaveCSS("background-color", "rgb(230, 107, 100)");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".move-count")).toHaveText("0 / 1");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(square("e4").locator('[data-piece="wP"]')).toBeVisible();
  await expect(page.locator(".move-count")).toHaveText("1 / 1");
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByLabel("Game notation").fill("1. e4");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".move-count")).toHaveText("1 / 1");
});


test("vertical arrow keys do not scroll the page", async ({ page }) => {
  await page.locator(".brand").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".board-options")).toHaveCount(0);
});

test("workspace fits laptop, monitor, and wide desktop viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }, { width: 1920, height: 720 }]) {
    await page.setViewportSize(viewport);
    const card = page.locator(".board-card");
    await expect.poll(async () => {
      const bounds = await card.boundingBox();
      return bounds ? bounds.y + bounds.height : Infinity;
    }).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
    const panel = await page.locator(".context-card").boundingBox();
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(viewport.height);
    await page.getByRole("button", { name: "Back to workspace" }).click();
  }
  await page.screenshot({ path: testInfo.outputPath("viewport-fit.png"), fullPage: true });
});
