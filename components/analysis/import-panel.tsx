"use client";

import { useState, type ChangeEvent } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

import { parseGame, gameLink, type ImportedGame } from "@/lib/chess/import-game";

type ImportTab = "pgn" | "link" | "file";
const tabs: { id: ImportTab; label: string; icon: IconName }[] = [
  { id: "pgn", label: "Paste PGN", icon: "code" },
  { id: "link", label: "Game Link", icon: "link" },
  { id: "file", label: "Upload PGN", icon: "upload" },
];

export function ImportPanel({ onImport }: { onImport: (game: ImportedGame) => void }) {
  const [tab, setTab] = useState<ImportTab>("pgn");
  const [pgn, setPgn] = useState("");
  const [link, setLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [readingFile, setReadingFile] = useState(false);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError("");
    setFileName("");
    setFileText("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pgn")) {
      setError("Choose a .pgn file.");
      input.value = "";
      return;
    }
    if (file.size > 1_000_000) {
      setError("Please choose a PGN file smaller than 1 MB.");
      input.value = "";
      return;
    }
    setReadingFile(true);
    try {
      const text = await file.text();
      if (!text.trim()) setError("This file is empty. Choose a PGN file containing a game.");
      else { setFileName(file.name); setFileText(text); }
    } catch {
      setError("This file couldn’t be read. Please try selecting it again.");
    } finally {
      setReadingFile(false);
      input.value = "";
    }
  }

  async function analyze() {
    setError("");
    setLoading(true);
    try {
      let text = tab === "file" ? fileText : pgn;
      if (tab === "link") {
        gameLink(link);
        const response = await fetch("/api/import-game", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: link }), signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load the game. Paste its PGN instead.");
        text = data.pgn;
      }
      onImport(parseGame(text));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not import the game.");
    } finally { setLoading(false); }
  }

  return (
    <section className="import-panel">
      <div className="import-tabs" aria-label="Import method">
        {tabs.map((item) => <button key={item.id} aria-pressed={tab === item.id} disabled={loading} onClick={() => { setTab(item.id); setError(""); }}><Icon name={item.icon} />{item.label}</button>)}
      </div>
      <div className="import-fields">
        {tab === "pgn" && <><label htmlFor="pgn-input">Game notation <span>PGN</span></label><textarea id="pgn-input" value={pgn} onChange={(event) => setPgn(event.target.value)} maxLength={1_000_000} placeholder={'[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'} rows={6} spellCheck={false} /><p className="field-help">Copy the PGN from your game’s export or share menu.</p></>}
        {tab === "link" && <><label htmlFor="game-link">Game link</label><div className="input-with-icon"><Icon name="link" /><input id="game-link" type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://lichess.org/your-game-id" /></div><p className="field-help">Paste a public Chess.com or Lichess game link.</p></>}
        {tab === "file" && <><span className="field-label">PGN file</span><label className="upload-area" htmlFor="pgn-file"><Icon name={fileName ? "check" : "upload"} /><strong>{readingFile ? "Reading your file…" : fileName || "Choose a PGN file"}</strong><span>Browse files · .pgn, up to 1 MB</span><input id="pgn-file" type="file" accept=".pgn" onChange={selectFile} disabled={readingFile} aria-describedby={error ? "file-error" : undefined} /></label>{fileName && <><p className="field-help">File selected. Preview your notation below.</p><pre className="pgn-preview">{fileText.slice(0, 1200)}</pre></>}</>}
      </div>
      {error && <p className="field-error" role="alert" id="file-error">{error}</p>}
      <button className="primary-button" onClick={analyze} disabled={loading || readingFile || !(tab === "pgn" ? pgn.trim() : tab === "link" ? link.trim() : fileText.trim())}><Icon name="chart" />{loading ? "Loading game…" : "Analyze game"}</button>
    </section>
  );
}
