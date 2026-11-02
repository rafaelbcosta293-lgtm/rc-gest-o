import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Só importa do pacote de ícones o que cada ficheiro usa, em vez de
    // o ficheiro todo do lucide-react (usado em ~50 sítios na app).
    optimizePackageImports: ["lucide-react"],
    // Ao voltar a uma página visitada há pouco (botão "Voltar", ou um
    // separador em que já se tinha estado), o Next mostra-a logo do
    // cache do próprio browser em vez de esperar por um pedido novo ao
    // servidor — sente-se instantâneo. 30s é o valor que o próprio
    // Next.js já usava por omissão antes da v15 mudar para 0.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
