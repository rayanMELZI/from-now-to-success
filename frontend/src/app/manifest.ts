import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "fromNowToSuccess",
    short_name: "FNTS",
    description: "Your habit roadmap, from now to success",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#fffbeb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
