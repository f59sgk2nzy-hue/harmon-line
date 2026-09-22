import { TooltipProvider } from "@/components/ui/tooltip";
import { pwaManifestFields } from "@/lib/base-path";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Oswald, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pwa = pwaManifestFields();

export const metadata: Metadata = {
  title: "The Harmon Line — College Football Scoreboard",
  description:
    "Nostalgic ESPN-style live scoreboard for NCAA Division I, Division II, and NAIA college football, built for Christian Harmon.",
  applicationName: "The Harmon Line",
  manifest: pwa.manifestHref,
  appleWebApp: {
    capable: true,
    title: "The Harmon Line",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: pwa.icons[0], sizes: "192x192", type: "image/png" },
      { url: pwa.icons[1], sizes: "512x512", type: "image/png" },
      { url: pwa.icons[2], type: "image/svg+xml" },
    ],
    apple: [{ url: pwa.appleTouchIcon, sizes: "180x180" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${sourceSans.variable} ${oswald.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#0a0a0a] text-white">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
