import { PUBLIC_BASE_PATH } from "./src/lib/base-path";
import { allowedDevOrigins, ipv4HostsFromInterfaces } from "./src/lib/dev-origins";
import type { NextConfig } from "next";
import os from "node:os";

const nextConfig: NextConfig = {
  // OS reverse proxy: https://os.versalink.online/line → DELL :43173/line.
  // Local and Tailscale dogfood use the same prefix. assetPrefix is unset:
  // basePath already prefixes /_next static assets; a CDN prefix is not used.
  basePath: PUBLIC_BASE_PATH,
  env: {
    NEXT_PUBLIC_BASE_PATH: PUBLIC_BASE_PATH,
  },
  // next dev Origin check: HMR websocket to /line/_next/hmr is rejected for
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
