import Link from 'next/link'
import { ArrowLeft, UserCheck, Megaphone, Euro } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { intervaloMes } from '@/lib/data/presencas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from './actions'
import { PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import StatCard from '@/components/StatCard'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const { error, erroSenha } = sp

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha titulo="Administração" destino="/painel/admin" action={desbloquearAdmin} erro={erroSenha} />
    )
  }

  const estudios = await getEstudios(supabase)
  const idsEstudios = estudios.map((e) => e.id)

  const agora = new Date()
  const { inicio, fimExclusivo } = intervaloMes(agora.getFullYear(), agora.getMonth() + 1)

  const [
    { data: clientesData, error: erroClientes },
    { data: leadsData, error: erroLeads },
    { data: pagamentosData, error: erroPagamentos },
  ] = await Promise.all([
    supabase.from('clientes').select('estado').in('estudio_id', idsEstudios),
    supabase.from('leads').select('entrada').in('estudio_id', idsEstudios).gte('entrada', inicio).lt('entrada', fimExclusivo),
    supabase.from('pagamentos').select('valor').gte('data_pagamento', inicio).lt('data_pagamento', fimExclusivo),
  ])
  for (const erro of [erroClientes, erroLeads, erroPagamentos]) {
    if (erro) throw new Error(erro.message)
  }

  const clientesAtivos = (clientesData ?? []).filter((c) => c.estado === 'Ativo').length
  const leadsNovas = (leadsData ?? []).length
  const receitaMes = (pagamentosData ?? []).reduce((soma, p) => soma + Number(p.valor), 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href="/painel"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trocar de conta
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Administração</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <span className="live-dot" aria-hidden />
        {estudios.map((e) => e.nome).join(' e ')} · resumo rápido, ao vivo.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="bg-tech-grid mt-6 grid grid-cols-1 gap-3 rounded-2xl p-1 sm:grid-cols-3">
        <StatCard icone={UserCheck} cor={PALETA.teal} label="Clientes ativos" valor={clientesAtivos} aoVivo />
        <StatCard icone={Megaphone} cor={PALETA.laranja} label="Leads novas este mês" valor={leadsNovas} />
        <StatCard icone={Euro} cor={PALETA.ambar} label="Receita este mês" valor={`€${receitaMes.toFixed(0)}`} />
      </div>

      <p className="mt-6 text-sm text-muted">
        Usa o menu no topo para ver os detalhes por estúdio (Este mês, Agora), relatórios, financeiro
        e as restantes áreas.
      </p>
    </div>
  )
}
