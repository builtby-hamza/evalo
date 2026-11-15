export type EngineKind = "lite" | "full";
export type Evaluation = { cp?: number; mate?: number; depth: number; move?: string; done: boolean };
type Job = { initialFen: string; key: string; moves: string; white: boolean; report: (value: Evaluation) => void };
const root = "/engine/stockfish-19/";
const cacheName = "evalo-stockfish-19-v19.0.1";

export function parseInfo(line: string, white: boolean): Evaluation | null {
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  const depth = line.match(/\bdepth (\d+)/);
  if (!score || !depth || /\b(upperbound|lowerbound)\b/.test(line)) return null;
  const value = Number(score[2]) * (white ? 1 : -1);
  return { [score[1]]: value, depth: Number(depth[1]), move: line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1], done: false };
}

export async function downloadEngine(kind: EngineKind, signal: AbortSignal, progress: (percent: number) => void) {
  const name = kind === "lite" ? "stockfish-19-lite-single" : "stockfish-19-single";
  const url = `${root}${name}.wasm`;
  let cache: Cache | undefined;
  try { cache = await caches.open(cacheName); } catch { /* Storage can be unavailable in private browsing. */ }
  const cached = await cache?.match(url);
  if (cached) {
    progress(100);
    return { script: `${root}${name}.js`, binary: await cached.blob() };
  }
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Engine download failed (${response.status}).`);
  const total = Number(response.headers.get("content-length"));
  const reader = response.body?.getReader();
  if (!reader) throw new Error("This browser cannot download the engine.");
  const chunks: ArrayBuffer[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
    loaded += value.byteLength;
    if (total) progress(Math.min(99, Math.round(loaded / total * 100)));
  }
  signal.throwIfAborted();
  const binary = new Blob(chunks, { type: "application/wasm" });
  try { await cache?.put(url, new Response(binary, { headers: { "Content-Type": "application/wasm" } })); } catch { /* Analysis still works if storage is full. */ }
  progress(100);
  return { script: `${root}${name}.js`, binary };
}

/** Only one UCI search runs at once. A stopped search must finish before the next starts. */
export class LocalEngine {
  private worker: Worker;
  private binaryUrl: string;
  private active: Job | null = null;
  private wanted: Job | null = null;
  private last: Evaluation | null = null;
  private ready = false;
  private timer: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  constructor(script: string, binary: Blob, onReady: () => void, private onError: (message: string) => void) {
    this.binaryUrl = URL.createObjectURL(binary);
    this.worker = new Worker(`${script}#${encodeURIComponent(this.binaryUrl)}`);
    this.timer = setTimeout(() => this.fail("Engine startup timed out. Try again."), 30000);
    this.worker.onerror = (event) => { event.preventDefault(); this.fail("Engine could not start. Try Lite or retry the download."); };
    this.worker.onmessage = ({ data }) => {
      if (typeof data !== "string") return;
      if (data === "uciok") {
        this.send("setoption name Hash value 32");
        this.send("isready");
      } else if (data === "readyok" && !this.ready) {
        clearTimeout(this.timer);
        this.ready = true;
        onReady();
        this.pump();
      } else if (data.startsWith("info ") && this.active && this.active === this.wanted) {
        const result = parseInfo(data, this.active.white);
        if (result) { this.last = result; this.active.report(result); }
      } else if (data.startsWith("bestmove ")) {
        clearTimeout(this.searchTimer);
        if (this.active && this.active === this.wanted && this.last) {
          this.active.report({ ...this.last, done: true, move: data.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1] });
          this.wanted = null;
        }
        this.active = null;
        this.pump();
      }
    };
    this.send("uci");
  }
  private send(command: string) { this.worker.postMessage(command); }
  private fail(message: string) { this.dispose(); this.onError(message); }
  analyze(job: Job) {
    this.wanted = job;
    if (this.active) this.send("stop");
    else this.pump();
  }
  cancel() { this.wanted = null; if (this.active) this.send("stop"); }
  private pump() {
    if (!this.ready || this.active || !this.wanted) return;
    this.active = this.wanted;
    this.last = null;
    this.send(`position fen ${this.active.initialFen}${this.active.moves ? ` moves ${this.active.moves}` : ""}`);
    this.send("go movetime 1200");
    this.searchTimer = setTimeout(() => this.fail("Analysis timed out. Restart the engine to try again."), 15000);
  }
  dispose() {
    clearTimeout(this.timer);
    clearTimeout(this.searchTimer);
    this.worker.terminate();
    URL.revokeObjectURL(this.binaryUrl);
    this.active = this.wanted = null;
  }
}
