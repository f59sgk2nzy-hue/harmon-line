"use client";

import { CLIP_EMPTY_HEADLINE, type ClipLookup } from "@/lib/scrub-film";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

export function ClipOutbound({
  clip,
}: {
  clip: ClipLookup;
}) {
  const [open, setOpen] = useState(false);
  const match = clip.match;

  if (match) {
    return (
      <a
        href={match.watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-clip-state="match"
        title={match.title}
        aria-label={`Open YouTube clip: ${match.title}`}
        className="pressable inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-sm bg-[#cc0000] px-2.5 font-display text-[10px] tracking-[0.16em] text-white no-underline"
      >
        CLIP
        <ExternalLink className="size-3" aria-hidden />
      </a>
    );
  }

  return (
    <div className="min-w-11">
      <button
        type="button"
        data-clip-state="empty"
        aria-expanded={open}
        aria-label={CLIP_EMPTY_HEADLINE}
        onClick={() => setOpen((value) => !value)}
        className="pressable inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-white/20 bg-black/40 px-2.5 font-display text-[10px] tracking-[0.16em] text-white/70"
      >
        CLIP
      </button>
      {open ? (
        <div
          data-clip-empty
          className="mt-2 border border-white/10 bg-black/50 px-3 py-2"
        >
          <p className="font-display text-[11px] tracking-[0.16em] text-[#f3c14b]">
            {CLIP_EMPTY_HEADLINE}
          </p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-white/45">
            No matching YouTube clip on this highlights feed. Titles and watch URLs
            are never invented.
          </p>
          <a
            href={clip.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable mt-2 inline-flex min-h-11 items-center gap-1.5 font-display text-[10px] tracking-[0.16em] text-[#ffb3b3] no-underline"
          >
            SEARCH YOUTUBE
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      ) : null}
    </div>
  );
}
