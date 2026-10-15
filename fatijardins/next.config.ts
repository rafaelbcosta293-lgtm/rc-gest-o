import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // A app vive numa subpasta de outro repositório: fixar a raiz aqui para o
  // Next.js não usar o package-lock.json nem a configuração da pasta-mãe.
  outputFileTracingRoot: path.join(__dirname),
  // O PDF dos orçamentos lê a fonte Geist do disco (lib/pdf/fontes.ts).
  outputFileTracingIncludes: {
    "/orcamentos/*/pdf": ["./node_modules/geist/dist/fonts/geist-sans/Geist-{Regular,SemiBold,Bold}.ttf"],
  },
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
