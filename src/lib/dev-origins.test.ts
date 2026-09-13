import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedDevOrigins, ipv4HostsFromInterfaces } from "./dev-origins";

describe("allowedDevOrigins", () => {
  it("always allows localhost and 127.0.0.1 so next dev HMR hydrates on loopback", () => {
    const origins = allowedDevOrigins();
    assert.ok(origins.includes("localhost"));
    assert.ok(origins.includes("127.0.0.1"));
  });

  it("includes a Tailscale MagicDNS pattern and extra LAN/Tailscale IPs", () => {
    const origins = allowedDevOrigins(["100.64.1.20", "192.168.1.40"]);
    assert.ok(origins.includes("**.ts.net"));
    assert.ok(origins.includes("100.64.1.20"));
    assert.ok(origins.includes("192.168.1.40"));
  });
});

describe("ipv4HostsFromInterfaces", () => {
  it("collects non-internal IPv4 addresses and skips loopback", () => {
    const hosts = ipv4HostsFromInterfaces({
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      tailscale0: [{ address: "100.64.1.20", family: "IPv4", internal: false }],
      eth0: [
        { address: "192.168.1.40", family: "IPv4", internal: false },
        { address: "fe80::1", family: "IPv6", internal: false },
      ],
    });
    assert.deepEqual(hosts.sort(), ["100.64.1.20", "192.168.1.40"]);
  });
});
