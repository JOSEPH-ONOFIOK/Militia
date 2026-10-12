import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swolediers War Room",
    short_name: "Swolediers",
    description: "Get drafted, climb the ranks and secure your Swolediers allowlist spot.",
    start_url: "/",
    display: "standalone",
    background_color: "#050704",
    theme_color: "#050704",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
