import { allowedDevOrigins, ipv4HostsFromInterfaces } from "./src/lib/dev-origins";
import type { NextConfig } from "next";
import os from "node:os";

const nextConfig: NextConfig = {
  // next dev Origin check: HMR websocket to /_next/hmr is rejected for
  // 127.0.0.1 and Tailscale/LAN hosts unless listed (localhost can work).
  // `**.ts.net` covers Tailscale MagicDNS. Next does not wildcard IPs, so
  // this machine's LAN / Tailscale 100.x addresses are collected here.
  // Production (`npm run build && npm start`) has no HMR and is preferred
  // for DELL / Home Screen / Tailscale.
  allowedDevOrigins: allowedDevOrigins(ipv4HostsFromInterfaces(os.networkInterfaces())),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "secure.espncdn.com" },
    ],
  },
};

export default nextConfig;
