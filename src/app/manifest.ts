import { pwaManifestFields } from "@/lib/base-path";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const pwa = pwaManifestFields();
  return {
    name: "The Harmon Line",
    short_name: "Harmon Line",
    description:
      "ESPN-style college football scoreboard for NCAA D1, D2, and NAIA — real public ESPN feeds, no demo scores.",
    start_url: pwa.start_url,
    scope: pwa.scope,
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["sports"],
    icons: [
      {
        src: pwa.icons[0],
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: pwa.icons[1],
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: pwa.icons[1],
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: pwa.icons[2],
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
