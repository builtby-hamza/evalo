import { gameLink, parseGame } from "@/lib/chess/import-game";

async function readLimited(body: ReadableStream<Uint8Array> | null, max: number) {
  if (!body) throw new Error("Empty response.");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.length;
      if (size > max) throw new Error("The game response is too large. Paste the PGN instead.");
      text += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel(); }
}

export async function POST(request: Request) {
  try {
    const body = JSON.parse(await readLimited(request.body, 4096));
    if (typeof body.url !== "string") throw new Error("Enter a game link.");
    const link = gameLink(body.url);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
    async function get(url: string, max = 1_000_000) {
      const response = await fetch(url, { signal, redirect: "error", cache: "no-store", headers: { Accept: "application/x-chess-pgn, application/json, text/plain", "User-Agent": "Evalo/1.0 game-import" } });
      if (!response.ok) throw new Error(response.status === 429 ? "The game provider is busy. Try again shortly or paste the PGN." : "The provider could not share this game. It may be private, unavailable, or blocking link imports. Paste its PGN instead.");
      return readLimited(response.body, max);
    }
    let pgn: string;
    if (link.site === "lichess") {
      pgn = await get(`https://lichess.org/game/export/${link.id}?clocks=false&evals=false&opening=true`);
    } else {
      // Chess.com has no documented PGN-by-ID endpoint. Its game metadata
      // identifies the player/month needed for the official public archive.
      const data = JSON.parse(await get(`https://www.chess.com/callback/${link.kind}/game/${link.id}`));
      if (typeof data.pgn === "string" || typeof data.game?.pgn === "string") {
        pgn = data.pgn || data.game.pgn;
      } else {
        const headers = data.game?.pgnHeaders;
        const player = headers?.White;
        const date = typeof headers?.Date === "string" ? headers.Date.match(/^(\d{4})\.(\d{2})\./) : null;
        if (typeof player !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(player) || !date) throw new Error("Chess.com did not provide the game export. Paste its PGN instead.");
        const archive = JSON.parse(await get(`https://api.chess.com/pub/player/${encodeURIComponent(player.toLowerCase())}/games/${date[1]}/${date[2]}`, 8_000_000));
        const game = Array.isArray(archive.games) && archive.games.find((entry: { url?: string }) => {
          try { const candidate = gameLink(entry.url || ""); return candidate.site === "chesscom" && candidate.kind === link.kind && candidate.id === link.id; } catch { return false; }
        });
        if (!game || typeof game.pgn !== "string") throw new Error("This game is not in the public archive yet. Paste its PGN instead.");
        pgn = game.pgn;
      }
    }
    // Do not replace a board with an invalid upstream export.
    parseGame(pgn);
    return Response.json({ pgn });
  } catch (error) {
    const message = error instanceof Error && /timeout|abort|fetch failed/i.test(error.message)
      ? "The game provider did not respond. Try again or paste the PGN."
      : error instanceof SyntaxError ? "The provider returned an unreadable game. Paste the PGN instead."
      : error instanceof Error ? error.message : "Could not import this game. Paste its PGN instead.";
    return Response.json({ error: message }, { status: 400 });
  }
}
