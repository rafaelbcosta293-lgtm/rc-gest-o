import type { Metadata } from "next"
import Link from "next/link"
import { SearchXIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { Logotipo } from "@/components/logotipo"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Página não encontrada" }

/** Endereços que não existem (fora das páginas da app, que têm o seu próprio not-found). */
export default function PaginaNaoEncontrada() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-accent to-background px-4 py-10">
      <Link href="/" aria-label="Início" className="mb-8">
        <Logotipo className="scale-125" />
      </Link>
      <div className="w-full max-w-sm rounded-xl bg-card">
        <EstadoVazio
          paginaInteira
          icone={SearchXIcon}
          titulo="Página não encontrada"
          descricao="O endereço não existe ou mudou. Verifique se está bem escrito."
          acao={
            <Button asChild size="lg">
              <Link href="/">Voltar ao início</Link>
            </Button>
          }
        />
      </div>
    </main>
  )
}
