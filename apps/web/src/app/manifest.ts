import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bitramed Medical Revision",
    short_name: "Bitramed",
    description: "Medical revision, quizzes, and past-paper practice.",
    start_url: "/home/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7f8",
    theme_color: "#087f7a",
    orientation: "portrait-primary",
    categories: ["education", "medical"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
