import { cn } from "@/lib/utils";
import { SportSwitcher } from "@/components/sport-switcher";
import Link from "next/link";

const NAV = [
  { href: "/", id: "board", label: "SCOREBOARD" },
  { href: "/rankings", id: "rankings", label: "RANKINGS" },
] as const;

export function BoardHeader({
  dateLabel,
  week,
  section = "board",
}: {
  dateLabel: string;
  week?: number | null;
  section?: "board" | "rankings";
}) {
  return (
    <header className="border-b border-white/10" style={{ viewTransitionName: "site-header" }}>
      <div className="espn-red-bar flex items-center justify-between gap-3 px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-5">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="pressable flex items-center gap-2.5 no-underline"
        >
          <span className="font-display text-lg leading-none tracking-[0.14em] text-white sm:text-2xl">
            THE HARMON LINE
          </span>
          <SportSwitcher current="cfb" />
        </Link>
        <p className="text-right font-display text-[11px] tracking-[0.16em] text-white/90 sm:text-sm">
          {dateLabel.toUpperCase()}
        </p>
      </div>
      <div className="espn-gold-rule" />
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b0b0b]/90 px-3 py-2 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <nav aria-label="Site" className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                transitionTypes={item.id === "rankings" ? ["nav-forward"] : ["nav-back"]}
                aria-current={section === item.id ? "page" : undefined}
                className={cn(
                  "pressable chip-hit chip-hit-lg no-underline",
                  section === item.id ? "chip-inverse" : "chip-idle"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p
            className={cn(
              "font-display text-[11px] tracking-[0.22em] text-[#f3c14b] sm:text-xs",
              section === "rankings" && "hidden sm:block"
            )}
          >
            {section === "rankings" ? "COLLEGE FOOTBALL RANKINGS" : "COLLEGE FOOTBALL SCOREBOARD"}
            {week ? `  ·  WEEK ${week}` : ""}
          </p>
        </div>
        <p className="font-mono text-[10px] tracking-[0.12em] text-white/55">
          FOR CHRISTIAN HARMON  ·  REAL ESPN PUBLIC FEED  ·  NO DEMO SCORES
        </p>
      </div>
    </header>
  );
}
