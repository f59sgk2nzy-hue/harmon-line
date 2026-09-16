"use client";

export function DisclaimerModal({
  shortText,
  longText,
  id = "harmon-disclaimer",
}: {
  shortText: string;
  longText: string;
  id?: string;
}) {
  return (
    <div data-deep-dive-disclaimer className="border border-[#f3c14b]/50 bg-[#2a1200] px-3 py-3 sm:px-4">
      <p className="font-display text-[11px] tracking-[0.2em] text-[#f3c14b]">
        21+  ·  ENTERTAINMENT / ANALYSIS ONLY  ·  NOT FINANCIAL ADVICE
      </p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#f3c14b]/85">{shortText}</p>
      <label
        htmlFor={id}
        className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-sm border border-[#f3c14b] bg-[#3d1a00] px-3 font-display text-[10px] tracking-[0.16em] text-[#f3c14b]"
      >
        FULL DISCLAIMER · 1-800-GAMBLER
      </label>
      <input id={id} type="checkbox" className="peer sr-only" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="pointer-events-none invisible fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 peer-checked:pointer-events-auto peer-checked:visible sm:items-center"
      >
        <div className="w-full max-w-lg border border-[#f3c14b]/40 bg-[#140d04] p-4">
          <h2
            id={`${id}-title`}
            className="font-display text-sm tracking-[0.16em] text-[#f3c14b]"
          >
            FULL DISCLAIMER
          </h2>
          <p className="mt-3 font-mono text-[12px] leading-relaxed text-white/80">{longText}</p>
          <p className="mt-3 font-display text-lg tracking-[0.12em] text-white">1-800-GAMBLER</p>
          <label
            htmlFor={id}
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-sm bg-[#cc0000] px-3 font-display text-[11px] tracking-[0.16em] text-white"
          >
            CLOSE
          </label>
        </div>
      </div>
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
