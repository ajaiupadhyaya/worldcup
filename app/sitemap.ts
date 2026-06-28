import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://worldcup-sable.vercel.app");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/standings", "/predict", "/scenarios"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.8,
  }));
}
