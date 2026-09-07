import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tutr",
    short_name: "tutr",
    description: "Lernbegleitung fürs Schuljahr: Vokabeln, Karten, Prüfungen, Tutor.",
    lang: "de",
    start_url: "/heute",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f6f3",
    theme_color: "#f5f6f3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
