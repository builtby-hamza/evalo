import { Chess, DEFAULT_POSITION } from "chess.js";

export type ImportedGame = {
  moves: string[];
  initialFen: string;
  white: string;
  black: string;
  whiteElo: string;
  blackElo: string;
  result: string;
  event: string;
  date: string;
  timeControl: string;
};

export function parseGame(text: string): ImportedGame {
  if (new TextEncoder().encode(text).length > 1_000_000) throw new Error("Choose a PGN smaller than 1 MB.");
  // Accept notation copied from Markdown as well as plain PGN exports.
  const pgn = text.replace(/\\\r?\n/g, "\n").trim().replace(/^```(?:pgn)?\s*\n?/i, "").replace(/\n?```$/, "")
    .replace(/\\([.:/\[\]])/g, "$1");
  if (!pgn) throw new Error("Paste a PGN game first.");
  const chess = new Chess();
  try { chess.loadPgn(pgn); } catch { throw new Error("This PGN contains invalid notation or an illegal move. Paste one complete game export."); }
  const headers = chess.getHeaders();
  if (headers.Variant && !/^(standard|chess|normal)$/i.test(headers.Variant)) throw new Error("Only standard chess games are supported.");
  const moves = chess.history();
  if (!moves.length) throw new Error("No moves found. Paste the game moves along with the PGN headers.");
  const clean = (name: string, fallback = "") => headers[name] && headers[name] !== "?" ? headers[name] : fallback;
  const clock = clean("TimeControl").match(/^(\d+)\+(\d+)$/);
  const timeControl = clock ? `${Number(clock[1]) / 60} min + ${clock[2]} sec` : clean("TimeControl");
  return {
    timeControl, moves, initialFen: headers.FEN || DEFAULT_POSITION,
    white: clean("White", "White"), black: clean("Black", "Black"),
    whiteElo: clean("WhiteElo"), blackElo: clean("BlackElo"),
    result: ["1-0", "0-1", "1/2-1/2"].includes(headers.Result) ? headers.Result : "*",
    event: clean("Event"), date: clean("Date").replace(/\./g, "-"),
  };
}

export function gameLink(input: string): { site: "lichess" | "chesscom"; id: string; kind?: string } {
  let url: URL;
  try { url = new URL(input.trim().replace(/\\([.:/])/g, "$1")); } catch { throw new Error("Enter a complete Chess.com or Lichess game link."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("Enter a public Chess.com or Lichess game link.");
  if (["lichess.org", "www.lichess.org"].includes(url.hostname)) {
    const match = url.pathname.match(/^\/([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?(?:\/(?:white|black))?\/?$/);
    if (match) return { site: "lichess", id: match[1] };
  }
  if (["chess.com", "www.chess.com"].includes(url.hostname)) {
    const match = url.pathname.match(/^\/(?:analysis\/)?game\/(live|daily)\/(\d+)(?:\/analysis)?\/?$/);
    if (match) return { site: "chesscom", kind: match[1], id: match[2] };
  }
  throw new Error("Use a direct Chess.com or Lichess game link, not a profile or analysis-board link.");
}
