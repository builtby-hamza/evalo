import { useId } from "react";

export type BoardArrow = { startSquare: string; endSquare: string };

export function BoardArrows({ arrows, preview, orientation, color = "#378331", engine = false }: {
  color?: string;
  engine?: boolean;
  arrows: BoardArrow[];
  preview: BoardArrow | null;
  orientation: "white" | "black";
}) {
  const markerId = `board-arrow-${useId().replace(/:/g, "")}`;
  function center(square: string) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return orientation === "white"
      ? { x: file * 100 + 50, y: (7 - rank) * 100 + 50 }
      : { x: (7 - file) * 100 + 50, y: rank * 100 + 50 };
  }
  const visibleArrows = preview && preview.startSquare !== preview.endSquare
    ? [...arrows, preview]
    : arrows;

  return (
    <svg data-engine-arrow={engine || undefined} className="board-arrows" viewBox="0 0 800 800" aria-hidden="true">
      <defs><marker id={markerId} markerUnits="userSpaceOnUse" markerWidth="34" markerHeight="42" refX="0" refY="21" orient="auto" overflow="visible"><path d="M0 0 34 21 0 42Z" fill={color} /></marker></defs>
      {visibleArrows.map((arrow, index) => {
        const start = center(arrow.startSquare);
        const end = center(arrow.endSquare);
        const distance = Math.hypot(end.x - start.x, end.y - start.y);
        if (!distance) return null;
        // The head starts at the shaft endpoint and extends to the target center.
        // Stopping the shaft here prevents its rounded cap poking through the tip.
        const shaftEnd = {
          x: end.x - (end.x - start.x) / distance * 34,
          y: end.y - (end.y - start.y) / distance * 34,
        };
        return <path key={`${arrow.startSquare}-${arrow.endSquare}-${index}`} data-arrow={`${arrow.startSquare}-${arrow.endSquare}`} d={`M${start.x} ${start.y} L${shaftEnd.x} ${shaftEnd.y}`} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" opacity={arrow === preview ? 0.5 : 0.7} markerEnd={`url(#${markerId})`} />;
      })}
    </svg>
  );
}
