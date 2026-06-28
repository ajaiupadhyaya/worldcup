import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Grain } from "@/components/editorial/Grain";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://worldcup-sable.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "World Cup MMXXVI — Live Dashboard",
  description:
    "Live World Cup scores, group standings, qualification probabilities, and tactical analysis — editorial sports intelligence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1A1A1A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteNav />
          <main className="w-full flex-1">{children}</main>
          <SiteFooter />
        </Providers>
        <Grain />
      </body>
    </html>
  );
}
