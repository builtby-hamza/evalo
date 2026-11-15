import type { Evaluation } from "@/lib/chess/engine";

export function EvaluationBar({ evaluation, orientation, enabled }: { evaluation: Evaluation | null; orientation: "white" | "black"; enabled: boolean }) {
  const mate = evaluation?.mate;
  const cp = evaluation?.cp ?? 0;
  const whiteShare = !evaluation ? 50 : mate !== undefined ? (mate === 0 ? (cp > 0 ? 100 : 0) : mate > 0 ? 100 : 0) : 100 / (1 + Math.exp(-cp / 250));
  const label = !enabled ? "Off" : !evaluation ? "…" : mate !== undefined ? (mate === 0 ? "Mate" : `${mate < 0 ? "−" : ""}M${Math.abs(mate)}`) : `${cp > 0 ? "+" : ""}${(cp / 100).toFixed(1)}`;
  return <div className="evaluation-bar" role="img" aria-label={`Evaluation from White's perspective: ${label}`} data-orientation={orientation} title="Positive scores favor White; negative scores favor Black.">
    <div className="evaluation-white" style={{ height: `${whiteShare}%`, [orientation === "white" ? "bottom" : "top"]: 0 }} />
    <span className="evaluation-label">{label}</span>
  </div>;
}
