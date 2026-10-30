import Link from 'next/link'
import { ArrowLeft, UserCheck, PauseCircle, UserMinus, CalendarCheck2 } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { corEstudio, PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import StatCard from '@/components/StatCard'
import type { Cliente, Estudio, Lead } from '@/lib/supabase/database.types'

type ClienteResumo = Pick<Cliente, 'estado'>
type LeadResumo = Pick<Lead, 'estado' | 'visita_data'>

export default async function AdminAgoraPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Agora"
        destino="/painel/admin/agora"
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

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Agora</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <span className="live-dot" aria-hidden />
        {estudios.map((e) => e.nome).join(' e ')} · estado atual, ao vivo.
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
              <AgoraEstudio estudio={estudio} />
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

async function AgoraEstudio({ estudio }: { estudio: Pick<Estudio, 'id' | 'nome'> }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const [{ data: clientesData, error: erroClientes }, { data: leadsData, error: erroLeads }] = await Promise.all([
    supabase.from('clientes').select('estado').eq('estudio_id', estudio.id),
    supabase.from('leads').select('estado, visita_data').eq('estudio_id', estudio.id),
  ])
  if (erroClientes || erroLeads) {
    throw new Error((erroClientes ?? erroLeads)!.message)
  }

  const clientes = (clientesData ?? []) as ClienteResumo[]
  const clientesAtivos = clientes.filter((c) => c.estado === 'Ativo').length
  const clientesSuspensos = clientes.filter((c) => c.estado === 'Suspenso').length
  const clientesInativos = clientes.filter((c) => c.estado === 'Ex-cliente').length
  const leads = (leadsData ?? []) as LeadResumo[]
  const sessoesAgendadas = leads.filter(
    (l) => l.visita_data && l.visita_data >= hoje && l.estado !== 'Perdida' && l.estado !== 'Ganha'
  ).length

  return (
    <div className="bg-tech-grid mt-3 grid grid-cols-2 gap-3 rounded-2xl p-1">
      <StatCard icone={UserCheck} cor={PALETA.teal} label="Clientes ativos" valor={clientesAtivos} aoVivo />
      <StatCard icone={PauseCircle} cor={PALETA.ambar} label="Suspensos" valor={clientesSuspensos} />
      <StatCard icone={UserMinus} cor={PALETA.neutro} label="Inativos" valor={clientesInativos} />
      <StatCard icone={CalendarCheck2} cor={PALETA.roxo} label="Sessões agendadas" valor={sessoesAgendadas} />
    </div>
  )
}
