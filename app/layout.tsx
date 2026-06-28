import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TickerBar } from "@/components/TickerBar";
import { SiteNav } from "@/components/SiteNav";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://worldcup-sable.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Floodlit — World Cup Tactical Intelligence",
  description:
    "Live World Cup scores, group standings, and free/open-data tactical breakdowns — the broadcast tactics-cam, in your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080908",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col tactics-grain">
        <Providers>
          {/* Persistent lower-third: live ticker + nav */}
          <TickerBar />
          <SiteNav />
          <main className="flex-1 w-full">{children}</main>
          <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
            Floodlit · data via API-Football & ESPN · free/open-data tactical analysis ·
            not affiliated with FIFA
          </footer>
        </Providers>
      </body>
    </html>
  );
}
