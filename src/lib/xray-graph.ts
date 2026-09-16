import type { WinProbSeries, WinProbTippingPoint } from "./espn-winprob";

export type XrayGraphPlot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type XrayGraphPlotted = {
  x: number;
  y: number;
  index: number;
  homeWinPct: number;
};

export type XrayGraphTipping = {
  x: number;
  y: number;
  index: number;
  label: string;
  swing: number;
};

export type XrayGraphLayout = {
  width: number;
  height: number;
  plot: XrayGraphPlot;
  points: XrayGraphPlotted[];
  path: string;
  areaPath: string;
  midlineY: number;
  tipping: XrayGraphTipping[];
};

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 360;

function yForPct(plot: XrayGraphPlot, homeWinPct: number): number {
  return plot.y + (1 - homeWinPct) * plot.height;
}

function xForIndex(plot: XrayGraphPlot, index: number, count: number): number {
  if (count <= 1) return plot.x + plot.width / 2;
  return plot.x + (index / (count - 1)) * plot.width;
}

function tipLabel(tip: WinProbTippingPoint): string {
  const signed = `${tip.swing >= 0 ? "+" : ""}${Math.round(tip.swing * 100)}`;
  const text = tip.playText?.trim();
  if (!text) return `${signed} WP`;
  const clipped = text.length > 42 ? `${text.slice(0, 41).trim()}…` : text;
  return `${signed}  ${clipped}`;
}

export function layoutXrayGraph(
  series: WinProbSeries,
  options: { width?: number; height?: number } = {}
): XrayGraphLayout {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const plot: XrayGraphPlot = {
    x: 56,
    y: 28,
    width: Math.max(1, width - 76),
    height: Math.max(1, height - 64),
  };
  const midlineY = plot.y + plot.height / 2;
  if (!series.available || series.points.length === 0) {
    return {
      width,
      height,
      plot,
      points: [],
      path: "",
      areaPath: "",
      midlineY,
      tipping: [],
    };
  }

  const count = series.points.length;
  const points: XrayGraphPlotted[] = series.points.map((point) => ({
    x: xForIndex(plot, point.index, count),
    y: yForPct(plot, point.homeWinPct),
    index: point.index,
    homeWinPct: point.homeWinPct,
  }));
  const path = points
    .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const areaPath = `${path} L ${last.x.toFixed(2)} ${midlineY.toFixed(2)} L ${first.x.toFixed(2)} ${midlineY.toFixed(2)} Z`;
  const byIndex = new Map(points.map((point) => [point.index, point]));
  const tipping: XrayGraphTipping[] = series.tippingPoints.flatMap((tip) => {
    const plotted = byIndex.get(tip.index);
    if (!plotted) return [];
    return [
      {
        x: plotted.x,
        y: plotted.y,
        index: tip.index,
        label: tipLabel(tip),
        swing: tip.swing,
      },
    ];
  });

  return { width, height, plot, points, path, areaPath, midlineY, tipping };
}

export function scrubIndexFromX(layout: XrayGraphLayout, x: number): number | null {
  if (layout.points.length === 0) return null;
  let best = layout.points[0]!;
  let bestDist = Math.abs(best.x - x);
  for (const point of layout.points) {
    const dist = Math.abs(point.x - x);
    if (dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }
  return best.index;
}

export function formatWinPct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
