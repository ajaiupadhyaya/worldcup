import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Floodlit World Cup Intelligence",
    short_name: "Floodlit",
    description: "Live World Cup scores, standings, probability, and tactical intelligence.",
    start_url: "/",
    display: "standalone",
    background_color: "#080908",
    theme_color: "#080908",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
