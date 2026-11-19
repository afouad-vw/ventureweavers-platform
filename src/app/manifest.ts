import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VentureWeavers",
    short_name: "VentureWeavers",
    description: "Experience, knowledge and access to MENA's venture ecosystem.",
    start_url: "/",
    display: "standalone",
    background_color: "#071112",
    theme_color: "#071112",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
