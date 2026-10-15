import Link from "next/link"

import { Logotipo } from "@/components/logotipo"
import { Skeleton } from "@/components/ui/skeleton"
import { exigirSessao } from "@/lib/auth"
import { NOMES_PERFIL } from "@/lib/perfis"
import { itensBarraInferior, itensParaPerfil } from "./itens"
import { LigacoesInferiores, LigacoesLaterais } from "./ligacoes-navegacao"

/** Menu lateral no PC e barra inferior no telemóvel, conforme o perfil. */
export async function Navegacao() {
  const sessao = await exigirSessao()
  const itens = itensParaPerfil(sessao.colaborador.perfil)
  const barra = itensBarraInferior(itens)

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Link href="/" className="mb-8 px-2 py-1">
          <Logotipo claro />
        </Link>
        <LigacoesLaterais itens={itens} />
        <Link
          href="/perfil"
          className="mt-auto rounded-lg border border-sidebar-border px-3 py-2.5 transition-colors hover:bg-sidebar-accent/60"
        >
          <p className="truncate text-sm font-medium">{sessao.colaborador.nome}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">
            {NOMES_PERFIL[sessao.colaborador.perfil]}
          </p>
        </Link>
      </aside>
      <LigacoesInferiores itens={barra.principais} mais={barra.mais} />
    </>
  )
}

export function NavegacaoEsqueleto() {
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-3 bg-sidebar p-4 md:flex">
        <Skeleton className="mb-6 h-9 w-40 bg-sidebar-accent" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-sidebar-accent" />
        ))}
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 h-16 border-t bg-background md:hidden" />
    </>
  )
}
