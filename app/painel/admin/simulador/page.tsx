import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SimuladorForm from './SimuladorForm'
import type { CenarioSimulador } from '@/lib/supabase/database.types'

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const { error, erroSenha } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Simulador"
        destino="/painel/admin/simulador"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  const { data: cenariosData, error: erroCenarios } = await supabase
    .from('cenarios_simulador')
    .select('*')
    .order('criado_em', { ascending: false })
  if (erroCenarios) throw new Error(erroCenarios.message)

  const cenarios = (cenariosData ?? []) as CenarioSimulador[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Simulador &quot;E se…&quot;</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Hipótese pura — estes resultados não leem nenhum dado real, só as fórmulas de negócio sobre
        os valores que escolheres abaixo.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <SimuladorForm cenarios={cenarios} />
    </div>
  )
}
