import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Militia War Room",
    short_name: "Militia",
    description: "Free mint. Join the draft, climb the ranks and secure your Militia allowlist spot.",
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
