import Link from "next/link"
import { MapPinIcon, TreesIcon, UsersIcon, type LucideIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"

function Indicador({
  href,
  icone: Icone,
  rotulo,
  valor,
}: {
  href: string
  icone: LucideIcon
  rotulo: string
  valor: number | null
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50 sm:gap-3 sm:p-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground sm:size-11">
        <Icone className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-tight font-semibold tabular-nums">{valor ?? "—"}</span>
        <span className="block text-sm leading-tight text-balance text-muted-foreground">{rotulo}</span>
      </span>
    </Link>
  )
}

/** Contadores do gerente e do chefe de equipa. */
export async function Resumo() {
  const supabase = await createClient()
  const [clientes, locais, colaboradores, equipas] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("locais").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("colaboradores").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("equipas").select("id", { count: "exact", head: true }).eq("ativa", true),
  ])

  return (
    <section aria-label="Resumo" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
      <Indicador href="/clientes" icone={TreesIcon} rotulo="Clientes ativos" valor={clientes.count} />
      <Indicador href="/clientes" icone={MapPinIcon} rotulo="Locais / jardins" valor={locais.count} />
      <Indicador href="/equipa" icone={UsersIcon} rotulo="Colaboradores" valor={colaboradores.count} />
      <Indicador href="/equipa/equipas" icone={UsersIcon} rotulo="Equipas" valor={equipas.count} />
    </section>
  )
}
