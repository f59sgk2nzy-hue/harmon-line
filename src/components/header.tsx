import Link from "next/link";

export function BoardHeader({
  dateLabel,
  week,
}: {
  dateLabel: string;
  week?: number | null;
}) {
  return (
    <header className="border-b border-white/10">
      <div className="espn-red-bar flex items-center justify-between gap-3 px-3 py-1.5 sm:px-5">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="font-display text-lg leading-none tracking-[0.14em] text-white sm:text-2xl">
            THE HARMON LINE
          </span>
          <span className="hidden rounded-sm bg-black/25 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.18em] text-white/90 sm:inline">
            CFB
          </span>
        </Link>
        <p className="text-right font-display text-[11px] tracking-[0.16em] text-white/90 sm:text-sm">
          {dateLabel.toUpperCase()}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b0b0b] px-3 py-2 sm:px-5">
        <p className="font-display text-[11px] tracking-[0.22em] text-[#f3c14b] sm:text-xs">
          COLLEGE FOOTBALL SCOREBOARD
          {week ? `  ·  WEEK ${week}` : ""}
        </p>
        <p className="font-mono text-[10px] tracking-[0.12em] text-white/55">
          FOR CHRISTIAN HARMON  ·  REAL ESPN PUBLIC FEED  ·  NO DEMO SCORES
        </p>
      </div>
    </header>
  );
}
