import type { DivisionId, StatusFilter, SubdivisionId } from "@/lib/types";

export function boardHref(options: {
  division: DivisionId;
  date: string;
  subdivision?: SubdivisionId;
  conference?: string;
  status?: StatusFilter;
  q?: string;
}): string {
  const params = new URLSearchParams();
  params.set("division", options.division);
  params.set("date", options.date);
  if (options.division === "d1" && options.subdivision && options.subdivision !== "all") {
    params.set("subdivision", options.subdivision);
  }
  if (options.conference && options.conference !== "all") {
    params.set("conference", options.conference);
  }
  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }
  const query = options.q?.trim();
  if (query) params.set("q", query);
  return `/?${params.toString()}`;
}

export function parseStatusFilter(value: string | null | undefined): StatusFilter {
  if (value === "live" || value === "final" || value === "upcoming" || value === "all") {
    return value;
  }
  return "all";
}
