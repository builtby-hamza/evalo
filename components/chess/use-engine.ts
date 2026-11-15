"use client";

import { useEffect, useRef, useState } from "react";
import type { Chess } from "chess.js";
import { downloadEngine, LocalEngine, type EngineKind, type Evaluation } from "@/lib/chess/engine";

export function useEngine(game: Chess) {
  const [kind, setKind] = useState<EngineKind>("lite");
  const [enabled, setEnabled] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: string; progress: number; error?: string }>({ status: "Loading", progress: 0 });
  const [ready, setReady] = useState(0);
  const [result, setResult] = useState<{ key: string; value: Evaluation } | null>(null);
  const client = useRef<LocalEngine | null>(null);
  const history = game.history({ verbose: true });
  const initialFen = history[0]?.before || game.fen();
  const moves = history.map((move) => move.from + move.to + (move.promotion || "")).join(" ");
  const key = `${kind}:${attempt}:${initialFen}:${moves}`;
  const white = game.turn() === "w";
  const over = game.isGameOver();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let engine: LocalEngine | undefined;
    async function start() {
      setState({ status: "Downloading", progress: 0 });
      setResult(null);
      try {
        const asset = await downloadEngine(kind, controller.signal, (progress) => {
          if (!controller.signal.aborted) setState({ status: progress === 100 ? "Starting" : "Downloading", progress });
        });
        if (controller.signal.aborted) return;
        engine = new LocalEngine(asset.script, asset.binary, () => {
          if (!controller.signal.aborted) { setState({ status: "Ready", progress: 100 }); setReady((value) => value + 1); }
        }, (error) => {
          if (!controller.signal.aborted) { client.current = null; setResult(null); setState({ status: "Error", progress: 0, error }); }
        });
        client.current = engine;
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: "Error", progress: 0, error: error instanceof Error ? error.message : "Engine download failed." });
      }
    }
    void start();
    return () => { controller.abort(); engine?.dispose(); client.current = null; };
  }, [kind, enabled, attempt]);

  useEffect(() => {
    if (!enabled || over) { client.current?.cancel(); return; }
    client.current?.analyze({ key, initialFen, moves, white, report: (value) => setResult({ key, value }) });
    return () => client.current?.cancel();
  }, [key, initialFen, moves, white, over, enabled, ready]);

  let evaluation = enabled && result?.key === key && state.status === "Ready" ? result.value : null;
  if (enabled && over) evaluation = game.isCheckmate()
    ? { mate: 0, cp: white ? -10000 : 10000, depth: 0, done: true }
    : { cp: 0, depth: 0, done: true };
  // Engine moves are validated against the displayed position before drawing.
  const best = evaluation?.move;
  const legal = best ? game.moves({ verbose: true }).find((move) => move.from + move.to + (move.promotion || "") === best) : undefined;
  return {
    kind, setKind, enabled, setEnabled, evaluation,
    arrow: legal ? { startSquare: legal.from, endSquare: legal.to } : null,
    bestMove: legal?.san,
    status: !enabled ? "Off" : over ? "Game over" : state.status !== "Ready" ? state.status : evaluation?.done ? "Ready" : "Analyzing",
    progress: state.progress, error: enabled ? state.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}
