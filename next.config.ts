import { PUBLIC_BASE_PATH } from "./src/lib/base-path";
import { allowedDevOrigins, ipv4HostsFromInterfaces } from "./src/lib/dev-origins";
import type { NextConfig } from "next";
import os from "node:os";

const nextConfig: NextConfig = {
  // Production: https://os.versalink.online/line/ on VPS srv1958956.
  // Laptop dogfood uses the same prefix at http://localhost:43173/line.
  // assetPrefix is unset: basePath already prefixes /_next static assets.
  basePath: PUBLIC_BASE_PATH,
  env: {
    NEXT_PUBLIC_BASE_PATH: PUBLIC_BASE_PATH,
  },
  // next dev Origin check: HMR websocket to /line/_next/hmr is rejected for
  // 127.0.0.1 unless listed (localhost can work). allowedDevOrigins also
  // includes `**.ts.net` for laptop MagicDNS during next dev. Next does not
  // wildcard IPs, so this machine's IPv4 addresses are collected here.
  // Laptop dogfood prefers `npm run build && npm start` (no HMR) at
  // http://localhost:43173/line. Production users open
  // https://os.versalink.online/line/.
  allowedDevOrigins: allowedDevOrigins(ipv4HostsFromInterfaces(os.networkInterfaces())),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "secure.espncdn.com" },
    ],
  },
};

export default nextConfig;
