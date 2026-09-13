"use client";

import { useState } from "react";

export function DisclaimerModal({
  shortText,
  longText,
}: {
  shortText: string;
  longText: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div data-deep-dive-disclaimer className="border border-[#f3c14b]/50 bg-[#2a1200] px-3 py-3 sm:px-4">
      <p className="font-display text-[11px] tracking-[0.2em] text-[#f3c14b]">
        21+  ·  ENTERTAINMENT / ANALYSIS ONLY  ·  NOT FINANCIAL ADVICE
      </p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#f3c14b]/85">{shortText}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex min-h-11 items-center font-display text-[10px] tracking-[0.16em] text-[#f3c14b] underline-offset-2 hover:underline"
      >
        FULL DISCLAIMER · 1-800-GAMBLER
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="harmon-disclaimer-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
        >
          <div className="w-full max-w-lg border border-[#f3c14b]/40 bg-[#140d04] p-4">
            <h2
              id="harmon-disclaimer-title"
              className="font-display text-sm tracking-[0.16em] text-[#f3c14b]"
            >
              FULL DISCLAIMER
            </h2>
            <p className="mt-3 font-mono text-[12px] leading-relaxed text-white/80">{longText}</p>
            <p className="mt-3 font-display text-lg tracking-[0.12em] text-white">1-800-GAMBLER</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-[#cc0000] px-3 font-display text-[11px] tracking-[0.16em] text-white"
            >
              CLOSE
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DisclaimerFooter({ text }: { text: string }) {
  return (
    <footer
      data-deep-dive-disclaimer-footer
      className="border-t border-white/10 px-3 py-4 font-mono text-[10px] leading-relaxed text-white/45"
    >
      {text} · 1-800-GAMBLER
    </footer>
  );
}
