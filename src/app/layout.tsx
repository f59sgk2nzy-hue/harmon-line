import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
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
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Harmon Line — College Football Scoreboard",
  description:
    "Nostalgic ESPN-style live scoreboard for NCAA Division I, Division II, and NAIA college football, built for Christian Harmon.",
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
