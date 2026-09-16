import { cn } from "@/lib/utils";
import { sportBoardHref } from "@/lib/board-url";
import {
  layoutOpsGraph,
  opsHrefForAgent,
  workIsActive,
  type OpsAgent,
  type OpsGraph,
  type OpsLayoutEdge,
  type OpsLayoutNode,
} from "@/lib/ops";
import type { LeagueId } from "@/lib/types";
import Link from "next/link";

function statusLabel(agent: OpsAgent): string {
  if (agent.kind === "retired") return "RETIRED";
  if (agent.kind === "skip") return "SKIP";
  return agent.duty === "busy" ? "BUSY" : "IDLE";
}

function nodeClass(agent: OpsAgent, role: "hub" | "spoke"): string {
  if (agent.kind === "retired" || agent.kind === "skip") return `ops-node ops-node-retired ops-${role}`;
  if (agent.duty === "busy") return `ops-node ops-node-busy ops-${role}`;
  return `ops-node ops-node-idle ops-${role}`;
}

function Edge({ edge }: { edge: OpsLayoutEdge }) {
  return (
    <g data-ops-edge={edge.spokeId} data-traffic={edge.traffic ? "true" : "false"}>
      <line
        x1={edge.x1}
        y1={edge.y1}
        x2={edge.x2}
        y2={edge.y2}
        className={edge.traffic ? "ops-edge ops-edge-traffic" : "ops-edge ops-edge-idle"}
      />
      {edge.traffic ? (
        <circle r="4" className="ops-particle" fill="#f3c14b">
          <animateMotion
            dur="1.35s"
            repeatCount="indefinite"
            path={`M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`}
          />
        </circle>
      ) : null}
    </g>
  );
}

function SpokeNode({
  node,
  hubY,
  href,
}: {
  node: OpsLayoutNode;
  hubY: number;
  href: string | null;
}) {
  const above = node.y < hubY;
  const labelY = above ? node.y - 58 : node.y + 46;
  const statusY = above ? node.y - 38 : node.y + 66;
  const body = (
    <>
      <circle
        cx={node.x}
        cy={node.y}
        r={node.agent.kind === "active" ? 28 : 22}
        className={nodeClass(node.agent, "spoke")}
      />
      <text
        x={node.x}
        y={node.y + 5}
        textAnchor="middle"
        className="ops-node-mark"
      >
        {node.agent.shortLabel}
      </text>
      <text x={node.x} y={labelY} textAnchor="middle" className="ops-node-label">
        {node.agent.label.toUpperCase()}
      </text>
      <text x={node.x} y={statusY} textAnchor="middle" className="ops-node-status">
        {statusLabel(node.agent)}
      </text>
    </>
  );

  return (
    <g
      data-ops-spoke={node.id}
      data-kind={node.agent.kind}
      data-duty={node.agent.duty}
    >
      {href ? (
        <a href={href} className="ops-spoke-link">
          {body}
        </a>
      ) : (
        body
      )}
    </g>
  );
}

export function OpsGraphMap({
  graph,
  league,
}: {
  graph: OpsGraph;
  league: LeagueId;
}) {
  const layout = layoutOpsGraph(graph, { width: 1000, height: 700 });
  const active = workIsActive(graph);
  const boardHref = sportBoardHref(league);

  return (
    <svg
      viewBox="0 0 1000 700"
      role="img"
      aria-label="Harmon Line agent graph. Chief Keef at the hub with The Board, CFB Edge, and Lab as spokes."
      className="ops-map h-auto w-full"
    >
      <title>Harmon Line agent graph</title>
      {layout.edges.map((edge) => (
        <Edge key={edge.spokeId} edge={edge} />
      ))}
      <g
        data-ops-hub={layout.hub.id}
        data-duty={graph.hub.duty}
        data-work-active={active ? "true" : "false"}
        transform={`translate(${layout.hub.x} ${layout.hub.y})`}
      >
        {active ? (
          <>
            <circle r="86" className="ops-radar ops-radar-a" />
            <circle r="86" className="ops-radar ops-radar-b" />
          </>
        ) : null}
        <circle r="52" className={nodeClass(graph.hub, "hub")} />
        <text y="6" textAnchor="middle" className="ops-hub-mark">
          {graph.hub.shortLabel}
        </text>
        <text y="86" textAnchor="middle" className="ops-node-label">
          {graph.hub.label.toUpperCase()}
        </text>
        <text y="106" textAnchor="middle" className="ops-node-status">
          ORCHESTRATOR · {statusLabel(graph.hub)}
        </text>
      </g>
      {layout.spokes.map((node) => (
        <SpokeNode
          key={node.id}
          node={node}
          hubY={layout.hub.y}
          href={opsHrefForAgent(node.id, boardHref)}
        />
      ))}
    </svg>
  );
}

export function OpsRosterList({
  graph,
  league,
}: {
  graph: OpsGraph;
  league: LeagueId;
}) {
  const boardHref = sportBoardHref(league);
  const rows: OpsAgent[] = [graph.hub, ...graph.spokes];
  return (
    <ol className="flex flex-col gap-1" aria-label="Agent roster">
      {rows.map((agent) => {
        const href = opsHrefForAgent(agent.id, boardHref);
        const inner = (
          <>
            <span className="font-display text-[15px] tracking-[0.12em] text-white">
              {agent.label.toUpperCase()}
            </span>
            <span className="font-mono text-[10px] tracking-[0.14em] text-white/45">
              {agent.role === "hub" ? "HUB" : "SPOKE"}
              {`  ·  ${statusLabel(agent)}`}
            </span>
            <span className="font-sans text-xs leading-relaxed text-white/55">{agent.note}</span>
          </>
        );
        return (
          <li key={agent.id}>
            {href ? (
              <Link
                href={href}
                transitionTypes={["nav-back"]}
                className={cn(
                  "pressable tap-row flex min-h-11 flex-col gap-0.5 px-3 py-2.5 no-underline",
                  agent.duty === "busy" ? "ops-row-busy" : "ops-row"
                )}
              >
                {inner}
              </Link>
            ) : (
              <div
                className={cn(
                  "flex min-h-11 flex-col gap-0.5 px-3 py-2.5",
                  agent.kind !== "active" ? "opacity-55" : "ops-row"
                )}
              >
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
