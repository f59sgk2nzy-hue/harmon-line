"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

type Tone = "default" | "inverse" | "red" | "live";

export function FilterChip({
  href,
  active,
  tone = "default",
  children,
  onSelect,
  className,
  prefetch = true,
}: {
  href: string;
  active: boolean;
  tone?: Tone;
  children: React.ReactNode;
  onSelect?: () => void;
  className?: string;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (!onSelect) return;
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        "pressable chip-hit no-underline",
        tone === "live" && active && "chip-live",
        active && tone === "red" && "chip-red",
        active && (tone === "default" || tone === "inverse") && "chip-inverse",
        !active && "chip-idle",
        className
      )}
    >
      {tone === "live" ? (
        <span className={active ? "live-dot" : "live-dot live-dot-idle"} />
      ) : null}
      {children}
    </Link>
  );
}
