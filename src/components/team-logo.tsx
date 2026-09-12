"use client";

import { useState } from "react";

export function TeamLogo({
  src,
  alt,
  color,
  abbreviation,
  size = 36,
}: {
  src: string;
  alt: string;
  color?: string | null;
  abbreviation: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-sm font-display text-[10px] font-bold tracking-wide text-white"
        style={{
          width: size,
          height: size,
          background: color || "#3a3a3a",
        }}
        aria-hidden
      >
        {abbreviation.slice(0, 3)}
      </span>
    );
  }

  return (
    // ESPN CDN logos; unoptimized so we don't block first paint on the optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
