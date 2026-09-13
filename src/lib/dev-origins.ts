/** Extra hostnames `next dev` should accept for HMR / `_next/hmr` Origin checks. */
export type HostInterface = {
  address: string;
  family: string | number;
  internal: boolean;
};

/**
 * Next 16 matches the Origin hostname only (no scheme/port).
 * `**.ts.net` covers Tailscale MagicDNS (`machine.tailxxxx.ts.net`).
 * IPs cannot be wildcarded — pass LAN / Tailscale 100.x addresses explicitly.
 */
export function allowedDevOrigins(extraHosts: Iterable<string> = []): string[] {
  const hosts = new Set(["localhost", "127.0.0.1", "**.ts.net"]);
  for (const host of extraHosts) {
    const trimmed = host.trim();
    if (trimmed) hosts.add(trimmed);
  }
  return [...hosts];
}

export function ipv4HostsFromInterfaces(
  interfaces: Record<string, HostInterface[] | undefined>
): string[] {
  const hosts: string[] = [];
  for (const nets of Object.values(interfaces)) {
    for (const net of nets ?? []) {
      const ipv4 = net.family === "IPv4" || net.family === 4;
      if (ipv4 && !net.internal) hosts.push(net.address);
    }
  }
  return hosts;
}
