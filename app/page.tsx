"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Chess, type Square } from "chess.js";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { Icon, KnightMark } from "@/components/ui/icon";
import { ImportPanel } from "@/components/analysis/import-panel";
import { evaloPieces } from "@/components/chess/pieces";
import { BoardArrows, type BoardArrow } from "@/components/chess/board-arrows";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Chessboard = dynamic(
  () => import("react-chessboard").then((module) => module.Chessboard),
  { ssr: false, loading: () => <div className="board-loading">Loading your board…</div> },
);

type Mode = "home" | "import" | "puzzle";
type Promotion = "q" | "r" | "b" | "n";
const pieceNames: Record<string, string> = { P: "pawn", R: "rook", N: "knight", B: "bishop", Q: "queen", K: "king" };

export default function Home() {
  const [mode, setMode] = useState<Mode>("home");
  const [moves, setMoves] = useState<string[]>([]);
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [promotion, setPromotion] = useState<Promotion>("q");
  const [selected, setSelected] = useState<Square | null>(null);
  const [focusedSquare, setFocusedSquare] = useState("e2");
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const [drawingArrow, setDrawingArrow] = useState<BoardArrow | null>(null);
  const arrowGesture = useRef<BoardArrow | null>(null);
  const arrowPointerId = useRef<number | null>(null);
  const game = useMemo(() => {
    const chess = new Chess();
    moves.slice(0, ply).forEach((move) => chess.move(move));
    return chess;
  }, [moves, ply]);

  const turn = game.turn() === "w" ? "White" : "Black";
  const status = game.isCheckmate()
    ? `Checkmate · ${turn === "White" ? "Black" : "White"} wins`
    : game.isStalemate() ? "Draw by stalemate"
      : game.isDraw() ? "Game drawn" : `${turn} to move${game.isCheck() ? " · Check" : ""}`;
  const lastMove = game.history({ verbose: true }).at(-1);
  const squareStyles: Record<string, CSSProperties> = {};
  const legalTargets = new Set<string>();
  if (lastMove) {
    for (const square of [lastMove.from, lastMove.to]) squareStyles[square] = { backgroundColor: "#c5d67a" };
  }
  if (selected) {
    squareStyles[selected] = { backgroundColor: "#d5dc80" };
    for (const move of game.moves({ square: selected, verbose: true })) {
      legalTargets.add(move.to);
      squareStyles[move.to] = {
        ...squareStyles[move.to],
        backgroundImage: game.get(move.to)
          ? "radial-gradient(circle, transparent 57%, #26332666 59%, #26332666 69%, transparent 71%)"
          : "radial-gradient(circle, #26332666 18%, transparent 20%)",
      };
    }
  }

  function navigate(nextPly: number) {
    setPly(nextPly);
    setSelected(null);
    clearArrows();
  }

  function clearArrows() {
    setArrows([]);
    cancelArrow();
  }

  function cancelArrow() {
    arrowGesture.current = null;
    arrowPointerId.current = null;
    setDrawingArrow(null);
  }

  function finishArrow(endSquare: string | null) {
    const gesture = arrowGesture.current;
    if (gesture && endSquare && gesture.startSquare !== endSquare) {
      const arrow = { startSquare: gesture.startSquare, endSquare };
      setArrows((current) => current.some((item) => item.startSquare === arrow.startSquare && item.endSquare === arrow.endSquare)
        ? current.filter((item) => item.startSquare !== arrow.startSquare || item.endSquare !== arrow.endSquare)
        : [...current, arrow]);
    }
    cancelArrow();
  }

  function squareAtPointer(event: PointerEvent<HTMLDivElement>): Square | null {
    const frame = event.currentTarget;
    const bounds = frame.getBoundingClientRect();
    const x = event.clientX - bounds.left - frame.clientLeft;
    const y = event.clientY - bounds.top - frame.clientTop;
    if (x < 0 || y < 0 || x >= frame.clientWidth || y >= frame.clientHeight) return null;
    const column = Math.floor(x / frame.clientWidth * 8);
    const row = Math.floor(y / frame.clientHeight * 8);
    const file = orientation === "white" ? column : 7 - column;
    const rank = orientation === "white" ? 8 - row : row + 1;
    return `${String.fromCharCode(97 + file)}${rank}` as Square;
  }

  function startBoardPointer(event: PointerEvent<HTMLDivElement>) {
    const square = squareAtPointer(event);
    if (event.button === 2 && square) {
      // Capture the right button before the board's drag sensors see it.
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      arrowPointerId.current = event.pointerId;
      arrowGesture.current = { startSquare: square, endSquare: square };
      setDrawingArrow(arrowGesture.current);
      return;
    }
    if (event.button !== 0) return;
    clearArrows();
    const piece = square ? game.get(square) : undefined;
    if (piece && (piece.color !== game.turn() || game.isGameOver())) {
      // Stop the lift itself; move validation alone only rejects the later drop.
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function moveBoardPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== arrowPointerId.current || !arrowGesture.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (!(event.buttons & 2)) {
      cancelArrow();
      return;
    }
    const square = squareAtPointer(event);
    if (square && square !== arrowGesture.current.endSquare) {
      arrowGesture.current = { ...arrowGesture.current, endSquare: square };
      setDrawingArrow(arrowGesture.current);
    }
  }

  function endBoardPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== arrowPointerId.current || event.button !== 2) return;
    event.preventDefault();
    event.stopPropagation();
    finishArrow(squareAtPointer(event));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function makeMove(from: string, to: string) {
    if (game.isGameOver()) return false;
    const nextGame = new Chess(game.fen());
    try {
      const move = nextGame.move({ from, to, promotion });
      setMoves([...moves.slice(0, ply), move.san]);
      setPly(ply + 1);
      setSelected(null);
      clearArrows();
      return true;
    } catch {
      return false;
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    return targetSquare ? makeMove(sourceSquare, targetSquare) : false;
  }

  function selectSquare(square: string) {
    if (game.isGameOver()) return;
    if (selected === square) {
      setSelected(null);
      return;
    }
    if (selected && makeMove(selected, square)) return;
    const piece = game.get(square as Square);
    setSelected(piece?.color === game.turn() ? square as Square : null);
  }

  return (
    <>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><KnightMark /><span>Evalo<span className="brand-dot">.</span></span><span className="brand-caption">A clearer game.</span></div>
          <span className="profile-icon" role="img" aria-label="Profile, account features not yet available" title="Profile · coming later"><Icon name="user" /></span>
        </div>
      </header>

      <main id="workspace" className="workspace" tabIndex={-1}>
        <div className="workspace-heading"><div><p className="eyebrow">YOUR CHESS WORKSPACE</p><h1>Make sense of every move.</h1></div><ThemeToggle /></div>
        <div className="workspace-grid">
          <section className="board-card" aria-label="Interactive chessboard">
            <div className="player-row"><span className={`player-avatar ${orientation === "white" ? "player-black" : "player-white"}`}><Icon name="user" /></span><div><strong>{orientation === "white" ? "Black" : "White"} pieces</strong><span>Local board</span></div><span className="player-color-label">{orientation === "white" ? "BLACK" : "WHITE"}</span></div>
            <div className="board-frame"
              onContextMenu={(event) => event.preventDefault()}
              onDragStartCapture={(event) => event.preventDefault()}
              onPointerDownCapture={startBoardPointer}
              onPointerMoveCapture={moveBoardPointer}
              onPointerUpCapture={endBoardPointer}
              onPointerCancel={cancelArrow}
              onLostPointerCapture={(event) => {
                if (event.pointerId === arrowPointerId.current) cancelArrow();
              }}>
              <Chessboard options={{
                id: "evalo-chessboard",
                position: game.fen(),
                pieces: evaloPieces,
                boardOrientation: orientation,
                onPieceDrop,
                onSquareClick: ({ square }) => selectSquare(square),
                onPieceDrag: ({ square }) => {
                  if (square && game.get(square as Square)?.color === game.turn()) setSelected(square as Square);
                },
                allowDragging: !game.isGameOver(),
                canDragPiece: ({ piece }) => piece.pieceType[0] === game.turn(),
                allowDrawingArrows: false,
                darkSquareStyle: { backgroundColor: "var(--board-dark, #769656)" },
                lightSquareStyle: { backgroundColor: "var(--board-light, #eeeed2)" },
                darkSquareNotationStyle: { color: "#f8faee", fontSize: "12px", fontWeight: 600 },
                lightSquareNotationStyle: { color: "#42642c", fontSize: "12px", fontWeight: 600 },
                squareStyles,
                squareRenderer: ({ square, piece, children }) => (
                  <div className="keyboard-square" style={squareStyles[square]} data-board-square={square} data-legal-target={legalTargets.has(square) || undefined} role="button" tabIndex={focusedSquare === square ? 0 : -1}
                    aria-label={`${square}${piece ? `, ${piece.pieceType[0] === "w" ? "white" : "black"} ${pieceNames[piece.pieceType[1]]}` : ", empty"}`}
                    aria-pressed={selected === square}
                    onFocus={() => setFocusedSquare(square)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectSquare(square);
                        return;
                      }
                      const offsets: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
                      const offset = offsets[event.key];
                      if (!offset) return;
                      event.preventDefault();
                      const direction = orientation === "white" ? 1 : -1;
                      const file = square.charCodeAt(0) + offset[0] * direction;
                      const rank = Number(square[1]) + offset[1] * direction;
                      if (file < 97 || file > 104 || rank < 1 || rank > 8) return;
                      const target = `${String.fromCharCode(file)}${rank}`;
                      event.currentTarget.closest(".board-frame")?.querySelector<HTMLElement>(`[data-board-square="${target}"]`)?.focus();
                    }}>{children}</div>
                ),
              }} />
              <BoardArrows arrows={arrows} preview={drawingArrow} orientation={orientation} />
            </div>
            <div className="player-row bottom-player"><span className={`player-avatar ${orientation === "white" ? "player-white" : "player-black"}`}><Icon name="user" /></span><div><strong>{orientation === "white" ? "White" : "Black"} pieces</strong><span>Local board</span></div><span className="turn-indicator" role="status"><span className="status-dot" />{status}</span></div>
            <div className="board-toolbar">
              <button className="icon-button" aria-label="Flip board" title="Flip board" onClick={() => setOrientation(orientation === "white" ? "black" : "white")}><Icon name="flip" /></button>
              <div className="move-navigation" aria-label="Move navigation">
                <button className="icon-button" aria-label="First move" title="First move" disabled={ply === 0} onClick={() => navigate(0)}><Icon name="start" /></button>
                <button className="icon-button" aria-label="Previous move" title="Previous move" disabled={ply === 0} onClick={() => navigate(ply - 1)}><Icon name="chevronLeft" /></button>
                <span className="move-count" aria-live="polite">{ply}<span> / {moves.length}</span></span>
                <button className="icon-button" aria-label="Next move" title="Next move" disabled={ply === moves.length} onClick={() => navigate(ply + 1)}><Icon name="chevronRight" /></button>
                <button className="icon-button" aria-label="Last move" title="Last move" disabled={ply === moves.length} onClick={() => navigate(moves.length)}><Icon name="end" /></button>
              </div>
              <button className="icon-button" aria-label="Reset board" title="Reset board" disabled={moves.length === 0} onClick={() => { setMoves([]); navigate(0); }}><Icon name="reset" /></button>
            </div>
            <p className="board-help">Click a piece to see legal moves. Right-click and drag to draw arrows.</p>
            <details className="board-options"><summary>Board options</summary><div className="board-options-inner"><label htmlFor="promotion">Promote pawns to</label><select id="promotion" value={promotion} onChange={(event) => setPromotion(event.target.value as Promotion)}><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></select><button className="text-button" disabled={!moves.length} onClick={() => { setMoves(moves.slice(0, -1)); navigate(Math.min(ply, moves.length - 1)); }}><Icon name="undo" />Undo last move</button></div><p className="piece-credit">Classic pieces by Colin M.L. Burnett, via Lichess. <a href="/pieces/cburnett/ATTRIBUTION.txt" target="_blank" rel="noreferrer">Source &amp; license</a></p></details>
          </section>

          <aside className="context-card" aria-label="Game workspace">
            {mode === "home" ? (
              <div className="home-panel">
                <div className="panel-symbol"><Icon name="chart" /></div>
                <p className="eyebrow">A FRESH PERSPECTIVE</p>
                <h2>Your game.<br />Your next breakthrough.</h2>
                <p className="panel-description">Look back at a game, find the moments that mattered, and discover a better next move.</p>
                <div className="home-actions">
                  <button className="action-card action-primary" onClick={() => setMode("import")}><span className="action-icon"><Icon name="chart" /></span><span><strong>Analyze a Game</strong><small>Bring a game. Find the lessons.</small></span><Icon name="arrow" /></button>
                  <button className="action-card action-secondary" onClick={() => setMode("puzzle")}><span className="action-icon"><Icon name="puzzle" /></span><span><strong>Solve a Puzzle</strong><small>A new perspective on a position.</small></span><Icon name="arrow" /></button>
                </div>
                <p className="home-board-tip"><Icon name="spark" />Just exploring? The board is yours to try.</p>
              </div>
            ) : (
              <>
                <button className="text-button back-button" onClick={() => setMode("home")}><Icon name="back" />Back to workspace</button>
                <div className="mode-switch" aria-label="Workspace mode"><button aria-pressed={mode === "import"} onClick={() => setMode("import")}><Icon name="chart" />Analyze a Game</button><button aria-pressed={mode === "puzzle"} onClick={() => setMode("puzzle")}><Icon name="puzzle" />Solve a Puzzle</button></div>
                <div hidden={mode !== "import"}><ImportPanel /></div>
                {mode === "puzzle" && <section className="puzzle-panel"><div className="panel-symbol"><Icon name="puzzle" /></div><p className="eyebrow">ONE POSITION. NEW POSSIBILITIES.</p><h2>A place to sharpen<br />your instincts.</h2><p className="panel-description">Tactical challenges will live here. Puzzle selection and solution checking are coming in a later step.</p><div className="notice"><Icon name="target" /><div><strong>For now, explore the board</strong><p>Try legal moves, flip the board, and step through your line. Engine replies and puzzle scoring aren’t connected yet.</p></div></div><button className="primary-button" onClick={() => setMode("home")}>Return to workspace<Icon name="arrow" /></button></section>}
              </>
            )}
            {moves.length > 0 && <section className="move-history" aria-label="Move history"><div className="section-heading"><h3>Your line</h3><span>{moves.length} half-moves</span></div><p className="line-hint">Select a move to revisit the position.</p><ol>{Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => <li key={index}><span className="move-number">{index + 1}.</span>{moves.slice(index * 2, index * 2 + 2).map((move, offset) => { const movePly = index * 2 + offset + 1; return <button key={movePly} aria-current={ply === movePly ? "step" : undefined} onClick={() => navigate(movePly)}>{move}</button>; })}</li>)}</ol></section>}
            <div className="workspace-features"><div><Icon name="chart" /><strong>Review</strong><span>Understand your moves</span></div><div><Icon name="branch" /><strong>Explore</strong><span>See other possibilities</span></div><div><Icon name="target" /><strong>Improve</strong><span>Learn from each game</span></div></div>
            <p className="panel-footnote"><Icon name="shield" />A focused space for your chess.</p>
          </aside>
        </div>
        <footer className="workspace-footer"><span>Made for the love of the game.</span><span>Study a little. See more.</span></footer>
      </main>
    </>
  );
}
