"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icon";
import type { useEngine } from "./use-engine";

export function EngineControls({ engine }: { engine: ReturnType<typeof useEngine> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const name = engine.kind === "lite" ? "Stockfish 19 Lite" : "Stockfish 19";
  return (
    <section className="engine-panel" aria-label="Engine analysis">
      <div className="engine-heading">
        <strong>{name}</strong>
        <label className="engine-switch"><input type="checkbox" checked={engine.enabled} onChange={(event) => engine.setEnabled(event.target.checked)} />Engine</label>
        <button className="icon-button" aria-label="Engine settings" title="Engine settings" onClick={() => dialog.current?.showModal()}><Icon name="settings" /></button>
      </div>
      <p className="engine-status" role="status">{engine.status}{engine.status === "Downloading" ? ` ${engine.progress}%` : ""}{engine.evaluation && engine.evaluation.depth > 0 ? ` · Depth ${engine.evaluation.depth}` : ""}{engine.bestMove ? ` · Best ${engine.bestMove}` : ""}</p>
      {engine.error && <p className="engine-error" role="alert">{engine.error} <button className="text-button" onClick={engine.retry}>Retry</button></p>}
      <dialog ref={dialog} className="engine-dialog" aria-labelledby="engine-settings-title" onKeyDown={(event) => event.stopPropagation()}>
        <div className="engine-heading"><h2 id="engine-settings-title">Engine settings</h2><button className="icon-button" aria-label="Close engine settings" onClick={() => dialog.current?.close()}>×</button></div>
        <p>Analysis runs on your device. Your positions are not sent to a server.</p>
        <div className="engine-choice">
          <div><strong>Stockfish 19 Lite</strong><p>Small download · about 2 MB</p></div>
          <button className="primary-button" disabled={engine.kind === "lite" && engine.enabled} onClick={() => { engine.setKind("lite"); engine.setEnabled(true); }}>Use Lite</button>
        </div>
        <div className="engine-choice">
          <div><strong>Stockfish 19 · Full</strong><p>Stronger analysis · about 95 MB</p></div>
          <button className="primary-button" disabled={engine.kind === "full" && engine.enabled} onClick={() => { engine.setKind("full"); engine.setEnabled(true); }}>Download / use full engine</button>
        </div>
        {engine.enabled && <p role="status">{name}: {engine.status}{engine.status === "Downloading" ? ` ${engine.progress}%` : ""}</p>}
        {engine.enabled && engine.status === "Downloading" && <progress aria-label="Engine download" value={engine.progress} max={100} />}
        {engine.error && <p className="engine-error">{engine.error} <button className="text-button" onClick={engine.retry}>Retry download</button></p>}
        <p className="engine-storage-note">Downloads are saved in this browser when storage is available. Both engines use one CPU thread. Switching to Lite cancels a full-engine download.</p>
        <a href="/engine/stockfish-19/SOURCE.txt" target="_blank" rel="noreferrer">Stockfish source &amp; license</a>
      </dialog>
    </section>
  );
}
