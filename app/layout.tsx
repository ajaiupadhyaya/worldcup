import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TickerBar } from "@/components/TickerBar";
import { SiteNav } from "@/components/SiteNav";

// Anton — scoreboard / lower-third supers. Hanken — tactical prose.
// Spline Sans Mono — clocks, xG, formation labels, tables.
const anton = Anton({ weight: "400", variable: "--font-anton", subsets: ["latin"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
const splineMono = Spline_Sans_Mono({ variable: "--font-spline-mono", subsets: ["latin"] });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Floodlit — World Cup Tactical Intelligence",
  description:
    "Live World Cup scores, group standings, and Claude-powered tactical breakdowns — the broadcast tactics-cam, in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${hanken.variable} ${splineMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col tactics-grain">
        <Providers>
          {/* Persistent lower-third: live ticker + nav */}
          <TickerBar />
          <SiteNav />
          <main className="flex-1 w-full">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
            Floodlit · data via API-Football & ESPN · tactical analysis by Claude ·
            not affiliated with FIFA
          </footer>
        </Providers>
      </body>
    </html>
  );
}
