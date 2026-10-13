import type { MetadataRoute } from "next"

/** Manifesto da app (servido em /manifest.webmanifest): permite instalá-la no telemóvel. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Fatijardins",
    short_name: "Fatijardins",
    description:
      "Gestão da Fatijardins: equipa, clientes e locais de manutenção e construção de jardins.",
    lang: "pt-PT",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7faf5",
    theme_color: "#15803d",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  }
}
