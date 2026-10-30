import Link from 'next/link'
import { ArrowLeft, Megaphone, TrendingUp, UserPlus, Euro, Dumbbell } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { MESES } from '@/lib/data/presencas'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { corEstudio, PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import StatCard from '@/components/StatCard'
import type { Cliente, Estudio, Lead } from '@/lib/supabase/database.types'

type ClienteResumo = Pick<Cliente, 'id' | 'estado' | 'inicio_contrato'>
type LeadResumo = Pick<Lead, 'estado' | 'entrada' | 'fecho_em'>
type SP = Record<string, string | undefined>

// Cada estúdio navega o seu próprio mês nesta página combinada, sem
// mexer no do outro — os parâmetros vêm prefixados com o slug
// ("fatima_mes", "leiria_mes") e comQuery preserva tudo o resto.
function comQuery(sp: SP, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined) params.set(k, v)
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function AdminEsteMesPage({
  searchParams,
}: {
  searchParams: Promise<SP & { erroSenha?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Este mês"
        destino="/painel/admin/este-mes"
        action={desbloquearAdmin}
        erro={sp.erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href="/painel/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Resumo
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Este mês</h1>
      <p className="mt-1 text-sm text-muted">
        {estudios.map((e) => e.nome).join(' e ')} · leads, conversões, receita e treinos do mês.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-2">
        {estudios.map((estudio) => (
          <section key={estudio.id}>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: corEstudio(estudio.slug).cor }}
              />
              <h2 className="text-lg font-semibold text-foreground">{estudio.nome}</h2>
            </div>
            <Suspense fallback={<EsqueletoEstudio />}>
              <EsteMesEstudio estudio={estudio} sp={sp} />
            </Suspense>
          </section>
        ))}
      </div>
    </div>
  )
}

function EsqueletoEstudio() {
  return <div className="mt-3 h-28 animate-pulse rounded-2xl border border-border-subtle bg-border-subtle" />
}

async function EsteMesEstudio({ estudio, sp }: { estudio: Pick<Estudio, 'id' | 'slug' | 'nome'>; sp: SP }) {
  const slug = estudio.slug
  const pk = (nome: string) => `${slug}_${nome}`

  const agora = new Date()
  const mesParam = sp[pk('mes')]
  const ano = mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear()
  const mes = mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimMesExclusivo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`
  const mesAnteriorAno = mes === 1 ? ano - 1 : ano
  const mesAnteriorMes = mes === 1 ? 12 : mes - 1
  const mesSeguinteAno = mes === 12 ? ano + 1 : ano
  const mesSeguinteMes = mes === 12 ? 1 : mes + 1
  const mesAnteriorParam = `${mesAnteriorAno}-${String(mesAnteriorMes).padStart(2, '0')}`
  const mesSeguinteParam = `${mesSeguinteAno}-${String(mesSeguinteMes).padStart(2, '0')}`

  const supabase = await createClient()

  const [{ data: clientesData, error: erroClientes }, { data: leadsData, error: erroLeads }] = await Promise.all([
    supabase.from('clientes').select('id, estado, inicio_contrato').eq('estudio_id', estudio.id),
    supabase.from('leads').select('estado, entrada, fecho_em').eq('estudio_id', estudio.id),
  ])
  if (erroClientes || erroLeads) {
    throw new Error((erroClientes ?? erroLeads)!.message)
  }

  const clientes = (clientesData ?? []) as ClienteResumo[]
  const novosClientes = clientes.filter(
    (c) => c.inicio_contrato && c.inicio_contrato >= inicioMes && c.inicio_contrato < fimMesExclusivo
  ).length
  const leads = (leadsData ?? []) as LeadResumo[]
  const leadsNovas = leads.filter((l) => l.entrada >= inicioMes && l.entrada < fimMesExclusivo).length
  const leadsConvertidas = leads.filter(
    (l) => l.estado === 'Ganha' && l.fecho_em && l.fecho_em >= inicioMes && l.fecho_em < fimMesExclusivo
  ).length

  const idsClientes = clientes.map((c) => c.id)
  const [{ data: pagamentosMesData, error: erroPagamentosMes }, { data: presencasMesData, error: erroPresencasMes }] =
    await Promise.all([
      idsClientes.length
        ? supabase
            .from('pagamentos')
            .select('valor')
            .in('cliente_id', idsClientes)
            .gte('data_pagamento', inicioMes)
            .lt('data_pagamento', fimMesExclusivo)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('presencas')
        .select('cliente_id, clientes!inner(estudio_id)')
        .eq('clientes.estudio_id', estudio.id)
        .eq('estado', 'Presente')
        .gte('data', inicioMes)
        .lt('data', fimMesExclusivo),
    ])
  if (erroPagamentosMes || erroPresencasMes) {
    throw new Error((erroPagamentosMes ?? erroPresencasMes)!.message)
  }
  const receitaMes = (pagamentosMesData ?? []).reduce((soma, p) => soma + Number(p.valor), 0)
  const treinosRealizados = (presencasMesData ?? []).length

  return (
    <>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/admin/este-mes${comQuery(sp, { [pk('mes')]: mesAnteriorParam })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">
          {MESES[mes - 1]} {ano}
        </span>
        <Link
          href={`/painel/admin/este-mes${comQuery(sp, { [pk('mes')]: mesSeguinteParam })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
      </div>
      <div className="bg-tech-grid mt-3 grid grid-cols-2 gap-3 rounded-2xl p-1 sm:grid-cols-3">
        <StatCard icone={Megaphone} cor={PALETA.laranja} label="Leads novas" valor={leadsNovas} />
        <StatCard icone={TrendingUp} cor={PALETA.teal} label="Convertidas" valor={leadsConvertidas} />
        <StatCard icone={UserPlus} cor={PALETA.azul} label="Novos clientes" valor={novosClientes} />
        <StatCard icone={Euro} cor={PALETA.ambar} label="Receita" valor={`€${receitaMes.toFixed(0)}`} />
        <StatCard
          icone={Dumbbell}
          cor={PALETA.roxo}
          label="Treinos realizados"
          valor={treinosRealizados}
          formula="Presenças com estado 'Presente' no mês, neste estúdio."
        />
      </div>
    </>
  )
}
