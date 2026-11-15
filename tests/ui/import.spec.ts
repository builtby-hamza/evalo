import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseGame, gameLink } from "../../lib/chess/import-game";
import { POST } from "../../app/api/import-game/route";

const pgn = readFileSync("tests/fixtures/leooopeo.pgn", "utf8");

test("PGN parser accepts the supplied game and Markdown escapes, and rejects bad input", () => {
  expect(parseGame(pgn)).toMatchObject({ white: "Leooopeo", black: "RyanBaLa12", whiteElo: "419", blackElo: "293", result: "1-0", timeControl: "15 min + 10 sec" });
  expect(parseGame(pgn).moves).toHaveLength(55);
  expect(parseGame(pgn.replace(/\./g, "\\.").replace(/\n/g, "\\\n")).moves.at(-1)).toBe("Re8#");
  expect(() => parseGame("1. e4 e5 2. Ke8")).toThrow();
  expect(() => gameLink("http://localhost:3000/private")).toThrow();
  expect(() => gameLink("https://chess.com.evil.test/game/live/123")).toThrow();
  expect(gameLink("https://www.chess.com/game/live/186334723716?move=0")).toMatchObject({ site: "chesscom", id: "186334723716" });
});

test("pasted PGN updates players, history and board, and can be reset", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByLabel("Game notation").fill(pgn);
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await expect(page.locator(".bottom-player")).toContainText("Leooopeo (419)");
  await expect(page.locator(".player-row").first()).toContainText("RyanBaLa12 (293)");
  await expect(page.locator(".imported-game-summary")).toContainText("Result 1-0");
  await expect(page.locator(".move-count")).toHaveText("0 / 55");
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page.locator('[data-square="e8"] [data-piece="wR"]')).toBeVisible();
  await expect(page.locator(".turn-indicator")).toContainText("Checkmate");
  await page.screenshot({ path: testInfo.outputPath("imported-game.png"), fullPage: true });
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".move-count")).toHaveText("54 / 55");
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  await expect(page.locator(".bottom-player")).toContainText("RyanBaLa12 (293)");
  await page.getByRole("button", { name: "Reset board", exact: true }).click();
  await expect(page.locator(".imported-game-summary")).toHaveCount(0);
  await expect(page.locator(".move-count")).toHaveText("0 / 0");
});

test("file import works, invalid imports preserve the current game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByRole("button", { name: "Upload PGN", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles("tests/fixtures/leooopeo.pgn");
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByLabel("Game notation").fill("1. e4 e5 2. Ke8");
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await expect(page.locator("#file-error")).toContainText("invalid notation");
  await expect(page.locator(".move-count")).toHaveText("0 / 55");
});

test("game link imports load returned PGN and show provider errors", async ({ page }) => {
  await page.route("**/api/import-game", (route) => route.fulfill({ json: { pgn } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByRole("button", { name: "Game Link", exact: true }).click();
  await page.getByLabel("Game link", { exact: true }).fill("https://www.chess.com/game/live/186334723716?move=0");
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await expect(page.locator(".bottom-player")).toContainText("Leooopeo");
  await page.unroute("**/api/import-game");
  await page.route("**/api/import-game", (route) => route.fulfill({ status: 400, json: { error: "Provider unavailable. Paste its PGN instead." } }));
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByRole("button", { name: "Game Link", exact: true }).click();
  await page.getByLabel("Game link", { exact: true }).fill("https://lichess.org/abcdefgh");
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await expect(page.locator("#file-error")).toContainText("Paste its PGN");
});

test("link API uses allowlisted providers and validates fetched games", async () => {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input); requested.push(url);
    if (url.includes("callback")) return Response.json({ game: { pgnHeaders: { White: "Leooopeo", Date: "2026.11.01" } } });
    if (url.includes("api.chess.com")) return Response.json({ games: [{ url: "https://www.chess.com/game/live/186334723716", pgn }] });
    return new Response(pgn);
  };
  try {
    for (const url of ["https://lichess.org/abcdefgh", "https://www.chess.com/game/live/186334723716"]) {
      const response = await POST(new Request("http://localhost/api/import-game", { method: "POST", body: JSON.stringify({ url }) }));
      expect(response.status).toBe(200);
      expect((await response.json()).pgn).toBe(pgn);
    }
    expect(requested).toContain("https://api.chess.com/pub/player/leooopeo/games/2026/11");
    const count = requested.length;
    const rejected = await POST(new Request("http://localhost/api/import-game", { method: "POST", body: JSON.stringify({ url: "http://127.0.0.1/admin" }) }));
    expect(rejected.status).toBe(400);
    expect(requested).toHaveLength(count);
  } finally { globalThis.fetch = original; }
});

test("PGN starting from a custom position is preserved for the board and engine", async ({ page }) => {
  const custom = '[White "White player"]\n[Black "Black player"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 2. Nf3 *';
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze a Game", exact: true }).click();
  await page.getByLabel("Game notation").fill(custom);
  await page.getByRole("button", { name: "Analyze game", exact: true }).click();
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await expect(page.locator(".turn-indicator")).toContainText("Black to move");
  await expect(page.locator(".engine-status")).toContainText("Ready · Depth", { timeout: 15000 });
  await expect(page.locator('[data-engine-arrow] path')).toHaveCount(2);
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page.locator('[data-square="f3"] [data-piece="wN"]')).toBeVisible();
  await expect(page.locator(".move-history li").first()).toHaveText("1.e5");
});
