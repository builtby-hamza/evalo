const paths = {
  chart: "M4 20V13h4v7M10 20V8h4v12M16 20V3h4v17",
  puzzle: "M9 3H5a2 2 0 0 0-2 2v4h2a3 3 0 1 1 0 6H3v4a2 2 0 0 0 2 2h4v-2a3 3 0 1 1 6 0v2h4a2 2 0 0 0 2-2v-4h-2a3 3 0 1 1 0-6h2V5a2 2 0 0 0-2-2h-4v2a3 3 0 1 1-6 0V3Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  chevronLeft: "m14 6-6 6 6 6",
  chevronRight: "m10 6 6 6-6 6",
  start: "M5 5v14m13-13-6 6 6 6",
  end: "M19 5v14M6 6l6 6-6 6",
  flip: "M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4",
  reset: "M3 10a9 9 0 1 1 2 8M3 4v6h6",
  undo: "M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  link: "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  check: "m5 12 4 4L19 6",
  target: "M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5",
  branch: "M6 6v12m0-6h8a4 4 0 0 0 4-4V6M8 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0m0 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8m-8 4h5",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function KnightMark() {
  return <svg width="32" height="36" viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M7 30h21v4H5v-2l2-2ZM10 28c0-5 6-6 6-12l-6 4-6-4 7-9 1-5 6 4c8 1 11 8 9 22H10Z" fill="currentColor"/><path d="m10 15 5-3M19 8l2 3" stroke="var(--header)" strokeWidth="2" strokeLinecap="round"/></svg>;
}
