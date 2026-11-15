import Image from "next/image";
import type { PieceRenderObject } from "react-chessboard";

const pieceCodes = ["wP", "wR", "wN", "wB", "wQ", "wK", "bP", "bR", "bN", "bB", "bQ", "bK"];

// Unmodified Cburnett SVGs, with artwork attribution and GPL license in public/pieces/cburnett.
export const evaloPieces: PieceRenderObject = Object.fromEntries(
  pieceCodes.map((code) => [
    code,
    function ClassicPiece() {
      return (
        <Image
          src={`/pieces/cburnett/${code}.svg`}
          alt=""
          width={45}
          height={45}
          className="chess-piece"
          draggable={false}
          loading="eager"
          unoptimized
        />
      );
    },
  ]),
);
