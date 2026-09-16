export type OpsAgentRole = "hub" | "spoke";
export type OpsAgentKind = "active" | "retired" | "skip";
export type OpsDuty = "idle" | "busy";

export type OpsAgent = {
  id: string;
  label: string;
  shortLabel: string;
  role: OpsAgentRole;
  kind: OpsAgentKind;
  duty: OpsDuty;
  note: string;
};

export type OpsHonesty = {
  headline: string;
  detail: string;
};

export type OpsGraph = {
  source: "static-roster";
  demo: false;
  liveFeed: false;
  busyOverride: boolean;
  generatedAt: string;
  honesty: OpsHonesty;
  hub: OpsAgent;
  spokes: OpsAgent[];
};

export type OpsLayoutNode = {
  id: string;
  x: number;
  y: number;
  agent: OpsAgent;
};

export type OpsLayoutEdge = {
  spokeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  traffic: boolean;
};

export type OpsLayout = {
  width: number;
  height: number;
  hub: OpsLayoutNode;
  spokes: OpsLayoutNode[];
  edges: OpsLayoutEdge[];
};

type OpsRosterEntry = Omit<OpsAgent, "duty">;

const HUB: OpsRosterEntry = {
  id: "chief-keef",
  label: "Chief Keef",
  shortLabel: "CK",
  role: "hub",
  kind: "active",
  note: "Orchestrator mark. No live dispatch feed is connected.",
};

const SPOKES: readonly OpsRosterEntry[] = [
  {
    id: "the-board",
    label: "The Board",
    shortLabel: "B",
    role: "spoke",
    kind: "active",
    note: "Live Harmon Line scoreboard (CFB / MBB / NFL / NBA / MLB). Agent-status feed is not wired.",
  },
  {
    id: "cfb-edge",
    label: "CFB Edge",
    shortLabel: "E",
    role: "spoke",
    kind: "retired",
    note: "Retired / skip. Not a live Harmon Line surface on this board.",
  },
  {
    id: "lab",
    label: "Lab",
    shortLabel: "L",
    role: "spoke",
    kind: "skip",
    note: "Skip. Lab is not a live Harmon Line surface on this board.",
  },
];

const ALIASES: Record<string, string> = {
  "chief-keef": "chief-keef",
  keef: "chief-keef",
  ck: "chief-keef",
  hub: "chief-keef",
  orchestrator: "chief-keef",
  "the-board": "the-board",
  board: "the-board",
  "cfb-edge": "cfb-edge",
  edge: "cfb-edge",
  lab: "lab",
};

const STATIC_HEADLINE = "STATIC ROSTER";
const STATIC_DETAIL =
  "Live agent-status feed is not connected. Nodes are a fixed Harmon Line roster. Busy/idle lights default to idle.";
const DOGFOOD_DETAIL =
  "Live agent-status feed is not connected. Busy lights below are a dogfood overlay from ?busy=, not live traffic.";

function withDuty(entry: OpsRosterEntry, duty: OpsDuty): OpsAgent {
  return { ...entry, duty };
}

function canAcceptBusy(entry: OpsRosterEntry): boolean {
  return entry.kind === "active";
}

export function parseBusyParam(value: string | null | undefined): string[] {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return [];
  if (raw === "all") return [HUB.id, ...SPOKES.filter(canAcceptBusy).map((spoke) => spoke.id)];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const token of raw.split(",")) {
    const id = ALIASES[token.trim()];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function buildOpsGraph(options: { busy?: string | null; now?: Date } = {}): OpsGraph {
  const requested = new Set(parseBusyParam(options.busy));
  const applied = new Set(
    [...requested].filter((id) => {
      if (id === HUB.id) return canAcceptBusy(HUB);
      const spoke = SPOKES.find((entry) => entry.id === id);
      return spoke ? canAcceptBusy(spoke) : false;
    })
  );
  const busyOverride = applied.size > 0;
  return {
    source: "static-roster",
    demo: false,
    liveFeed: false,
    busyOverride,
    generatedAt: (options.now ?? new Date()).toISOString(),
    honesty: {
      headline: STATIC_HEADLINE,
      detail: busyOverride ? DOGFOOD_DETAIL : STATIC_DETAIL,
    },
    hub: withDuty(HUB, applied.has(HUB.id) ? "busy" : "idle"),
    spokes: SPOKES.map((spoke) => withDuty(spoke, applied.has(spoke.id) ? "busy" : "idle")),
  };
}

export function workIsActive(graph: OpsGraph): boolean {
  if (graph.hub.duty === "busy") return true;
  return graph.spokes.some((spoke) => spoke.kind === "active" && spoke.duty === "busy");
}

export function spokeHasTraffic(spoke: OpsAgent): boolean {
  return spoke.role === "spoke" && spoke.kind === "active" && spoke.duty === "busy";
}

export function layoutOpsGraph(
  graph: OpsGraph,
  size: { width: number; height: number } = { width: 1000, height: 640 }
): OpsLayout {
  const hubX = size.width / 2;
  const hubY = size.height / 2;
  const radius = Math.min(size.width, size.height) * 0.32;
  const hub: OpsLayoutNode = { id: graph.hub.id, x: hubX, y: hubY, agent: graph.hub };
  const spokes = graph.spokes.map((agent, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / graph.spokes.length;
    return {
      id: agent.id,
      x: hubX + Math.cos(angle) * radius,
      y: hubY + Math.sin(angle) * radius,
      agent,
    };
  });
  const edges: OpsLayoutEdge[] = spokes.map((node) => ({
    spokeId: node.id,
    x1: hubX,
    y1: hubY,
    x2: node.x,
    y2: node.y,
    traffic: spokeHasTraffic(node.agent),
  }));
  return { width: size.width, height: size.height, hub, spokes, edges };
}

export function opsHrefForAgent(agentId: string, leagueBoardHref: string): string | null {
  return agentId === "the-board" ? leagueBoardHref : null;
}
