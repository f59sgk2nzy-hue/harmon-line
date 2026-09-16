"use client";

import { EmptyState } from "@/components/empty-state";
import { sportResearchHref } from "@/lib/board-url";
import type { WinProbPoint, WinProbSeries } from "@/lib/espn-winprob";
import { formatWinPct, layoutXrayGraph, scrubIndexFromX } from "@/lib/xray-graph";
import type { LeagueId } from "@/lib/types";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

function clientToSvgX(svg: SVGSVGElement, clientX: number): number {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const viewBox = svg.viewBox.baseVal;
  return viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width;
}

function periodClock(point: WinProbPoint): string | null {
  const bits: string[] = [];
  if (point.clock) bits.push(point.clock);
  if (point.period != null) bits.push(`P${point.period}`);
  return bits.length > 0 ? bits.join("  ·  ") : null;
}

function scoreLine(point: WinProbPoint, series: WinProbSeries): string | null {
  if (point.awayScore == null || point.homeScore == null) return null;
  const away = series.awayAbbr ?? "AWAY";
  const home = series.homeAbbr ?? "HOME";
  return `${away} ${point.awayScore}–${point.homeScore} ${home}`;
}

export function XrayGraph({
  series,
  variant = "detail",
  league,
  briefId = null,
}: {
  series: WinProbSeries;
  variant?: "detail" | "featured";
  league: LeagueId;
  briefId?: string | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = useMemo(
    () =>
      layoutXrayGraph(series, {
        width: 1000,
        height: variant === "featured" ? 200 : 360,
      }),
    [series, variant]
  );
  const lastIndex = series.points.length > 0 ? series.points.length - 1 : 0;
  const [scrub, setScrub] = useState<number | null>(series.available ? lastIndex : null);
  const index = scrub ?? lastIndex;
  const active = series.points[index] ?? null;
  const plotted = layout.points[index] ?? null;

  const applyPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !series.available) return;
    const next = scrubIndexFromX(layout, clientToSvgX(svg, event.clientX));
    if (next != null) setScrub(next);
  };

  const kicker =
    variant === "featured" ? "FEATURED X-RAY  ·  MOMENTUM WAVE" : "TACTICAL X-RAY  ·  MOMENTUM WAVE";

  return (
    <section
      data-xray-graph={variant}
      data-xray-available={series.available ? "true" : "false"}
      className="overflow-hidden border border-white/10 bg-[#0c0c0c]"
    >
      <div className="espn-red-bar flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <p className="font-display text-[10px] tracking-[0.18em] text-white">{kicker}</p>
        <p className="font-mono text-[10px] tracking-[0.12em] text-white/85">{series.evidenceLabel}</p>
      </div>
      <div className="espn-gold-rule" />

      {!series.available ? (
        <EmptyState
          kicker="X-RAY GRAPH"
          headline={series.honesty.headline}
          detail={series.honesty.detail}
          className="border-0 bg-transparent shadow-none"
        />
      ) : (
        <div className="flex flex-col gap-2 px-2 py-2 sm:px-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="font-display text-[11px] tracking-[0.16em] text-white">
              {(series.awayAbbr ?? "AWAY") + " @ " + (series.homeAbbr ?? "HOME")}
            </p>
            <p className="font-mono text-[10px] tracking-[0.12em] text-white/45">
              HOME WP vs PLAY INDEX  ·  DEMO FALSE
            </p>
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="xray-graph-svg h-auto w-full touch-none"
            role="slider"
            tabIndex={0}
            aria-label="ESPN win probability timeline. Scrub to inspect published plays."
            aria-valuemin={0}
            aria-valuemax={Math.max(0, series.points.length - 1)}
            aria-valuenow={index}
            aria-valuetext={active?.playText ?? `${formatWinPct(active?.homeWinPct ?? 0)} home`}
            data-xray-scrub={index}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              applyPointer(event);
            }}
            onPointerMove={(event) => {
              const hoveringMouse = event.pointerType === "mouse";
              const dragging =
                event.currentTarget.hasPointerCapture(event.pointerId) || event.buttons !== 0;
              if (!hoveringMouse && !dragging) return;
              applyPointer(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setScrub(Math.max(0, index - 1));
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                setScrub(Math.min(series.points.length - 1, index + 1));
              }
            }}
          >
            <title>ESPN win probability series</title>
            <line
              x1={layout.plot.x}
              x2={layout.plot.x + layout.plot.width}
              y1={layout.midlineY}
              y2={layout.midlineY}
              className="xray-midline"
            />
            <text
              x={layout.plot.x - 8}
              y={layout.plot.y + 12}
              textAnchor="end"
              className="xray-axis-label"
            >
              {series.homeAbbr ?? "H"} 100
            </text>
            <text
              x={layout.plot.x - 8}
              y={layout.midlineY + 4}
              textAnchor="end"
              className="xray-axis-label"
            >
              50
            </text>
            <text
              x={layout.plot.x - 8}
              y={layout.plot.y + layout.plot.height}
              textAnchor="end"
              className="xray-axis-label"
            >
              {series.awayAbbr ?? "A"} 0
            </text>
            {layout.areaPath ? <path d={layout.areaPath} className="xray-wave-fill" /> : null}
            {layout.path ? <path d={layout.path} className="xray-wave-line" /> : null}
            {variant === "detail"
              ? layout.tipping.map((tip) => (
                  <g key={`tip-${tip.index}`} data-xray-tipping={tip.index}>
                    <rect
                      x={tip.x - 5}
                      y={tip.y - 5}
                      width={10}
                      height={10}
                      transform={`rotate(45 ${tip.x} ${tip.y})`}
                      className="xray-tip"
                    />
                    <text
                      x={Math.min(layout.plot.x + layout.plot.width - 8, tip.x + 10)}
                      y={Math.max(16, tip.y - 12)}
                      className="xray-tip-label"
                    >
                      {tip.label}
                    </text>
                  </g>
                ))
              : null}
            {plotted ? (
              <g data-xray-playhead>
                <line
                  x1={plotted.x}
                  x2={plotted.x}
                  y1={layout.plot.y}
                  y2={layout.plot.y + layout.plot.height}
                  className="xray-playhead"
                />
                <circle cx={plotted.x} cy={plotted.y} r={6} className="xray-playhead-dot" />
              </g>
            ) : null}
          </svg>
          {active ? (
            <div
              data-xray-readout
              className="min-h-11 border border-white/10 bg-[#111] px-3 py-2"
              aria-live="polite"
            >
              <p className="font-display text-[12px] tracking-[0.14em] text-[#f3c14b]">
                HOME {formatWinPct(active.homeWinPct)}
                {"  ·  "}
                AWAY {formatWinPct(active.awayWinPct)}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/70">
                {[periodClock(active), scoreLine(active, series)].filter(Boolean).join("  ·  ") ||
                  `PLAY ${active.index + 1}`}
              </p>
              <p className="mt-1 font-sans text-sm leading-relaxed text-white/80">
                {active.playText ?? "No play text on this ESPN WP tick."}
              </p>
            </div>
          ) : null}
          {series.rgFootnote ? (
            <p className="px-1 font-mono text-[10px] leading-relaxed text-white/40">
              {series.rgFootnote}
            </p>
          ) : null}
        </div>
      )}

      {variant === "featured" && briefId ? (
        <div className="border-t border-white/10 px-3 py-2">
          <Link
            href={sportResearchHref(league, briefId)}
            className="inline-flex min-h-11 items-center font-display text-xs tracking-[0.16em] text-white/80"
          >
            OPEN POST-GAME X-RAY
          </Link>
        </div>
      ) : null}
    </section>
  );
}
