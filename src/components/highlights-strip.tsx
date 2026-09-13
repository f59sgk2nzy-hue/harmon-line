"use client";

import { HIGHLIGHTS_REFRESH_MS, sampleHighlightVideos, type HighlightsResponse } from "@/lib/youtube";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function sourceNote(board: HighlightsResponse): string {
  if (board.sample) {
    return "SAMPLE CARDS  ·  LIVE YOUTUBE FEED UNAVAILABLE  ·  NOT LIVE SCORES";
  }
  if (board.source === "mixed") return "YOUTUBE RSS + DATA API  ·  NO DEMO SCORES";
  if (board.source === "youtube-data-api") return "YOUTUBE DATA API  ·  NO DEMO SCORES";
  return "YOUTUBE RSS  ·  NO API KEY  ·  NO DEMO SCORES";
}

export function HighlightsStrip() {
  const [board, setBoard] = useState<HighlightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, x: 0, scroll: 0 });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/highlights", { cache: "no-store" });
      const payload = (await response.json()) as HighlightsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Highlights request failed");
      }
      setBoard(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Highlights request failed");
      setBoard((prev) =>
        prev ?? {
          source: "sample",
          sample: true,
          seasonYear: new Date().getUTCFullYear(),
          generatedAt: new Date().toISOString(),
          apiKeyConfigured: false,
          videos: sampleHighlightVideos(new Date().getUTCFullYear()),
        }
      );
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, HIGHLIGHTS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 280, behavior: "smooth" });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || event.pointerType === "touch") return;
    drag.current = { active: true, moved: false, x: event.clientX, scroll: el.scrollLeft };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || !drag.current.active) return;
    const delta = event.clientX - drag.current.x;
    if (Math.abs(delta) <= 16) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = drag.current.scroll - delta;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    drag.current.active = false;
    if (el && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
  };

  const videos = board?.videos ?? [];
  const seasonYear = board?.seasonYear;

  return (
    <section
      aria-label="College football highlights and reactions"
      className="border-b border-white/10 bg-[#0c0c0c]"
    >
      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-5">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-1 bg-[#cc0000]" />
              <h2 className="font-display text-sm tracking-[0.22em] text-white sm:text-base">
                HIGHLIGHTS / REACTIONS
              </h2>
              {seasonYear ? (
                <span className="rounded-sm bg-[#cc0000] px-1.5 py-0.5 font-display text-[10px] tracking-[0.16em] text-white">
                  CFB {seasonYear}
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-white/45">
              <span className="sm:hidden">SWIPE  ·  </span>
              {board ? sourceNote(board) : "LOADING YOUTUBE FEED"}
              {error ? `  ·  ${error}` : ""}
            </p>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              aria-label="Scroll highlights left"
              onClick={() => scrollByCard(-1)}
              className="inline-flex size-7 items-center justify-center rounded-sm border border-white/15 bg-black text-white hover:border-white/40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Scroll highlights right"
              onClick={() => scrollByCard(1)}
              className="inline-flex size-7 items-center justify-center rounded-sm border border-white/15 bg-black text-white hover:border-white/40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="highlights-scroller flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
        >
          {videos.length === 0
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[196px] w-[240px] shrink-0 animate-pulse border border-white/10 bg-[#161616]"
                />
              ))
            : videos.map((video) => (
                <a
                  key={video.id}
                  href={video.watchUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(event) => {
                    if (drag.current.moved) event.preventDefault();
                  }}
                  className="score-cell group w-[min(78vw,240px)] shrink-0 snap-start no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#cc0000]"
                >
                  <div className="relative aspect-video overflow-hidden bg-[#111]">
                    {video.thumbnailUrl ? (
                      // YouTube thumbs; unoptimized so score polling stays off the image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={480}
                        height={360}
                        draggable={false}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[#1a1a1a] font-display text-xs tracking-[0.18em] text-white/35">
                        SAMPLE
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/75 px-1.5 py-0.5 font-display text-[10px] tracking-[0.16em] text-white">
                      {video.kind === "reaction" ? "REACTION" : "HIGHLIGHT"}
                    </span>
                    {video.sample ? (
                      <span className="absolute right-1.5 top-1.5 rounded-sm bg-[#f3c14b] px-1.5 py-0.5 font-display text-[10px] tracking-[0.16em] text-black">
                        SAMPLE
                      </span>
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#cc0000]/90 text-white shadow-md group-hover:bg-[#e01111]">
                        <Play className="size-4 fill-white" />
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1 px-2.5 py-2">
                    <p className="line-clamp-2 font-display text-sm leading-snug tracking-wide text-white">
                      {video.title}
                    </p>
                    <p className="truncate font-mono text-[11px] text-white/50">{video.channel}</p>
                  </div>
                </a>
              ))}
        </div>
      </div>
    </section>
  );
}
