import Link from 'next/link'
import { ArrowLeft, CalendarCheck2, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { desbloquearCoordenacao } from './actions'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import StatCard from '@/components/StatCard'

export default async function CoordenacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const { error, erroSenha } = sp

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação"
        destino="/painel/coordenacao"
        action={desbloquearCoordenacao}
        erro={erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)
  const idsEstudios = estudios.map((e) => e.id)
  const hoje = new Date().toISOString().slice(0, 10)

  const [{ data: checklistData, error: erroChecklist }, { data: leadsHojeData, error: erroLeadsHoje }] =
    await Promise.all([
      supabase.from('checklist_registos').select('concluidos, total').in('estudio_id', idsEstudios).eq('data', hoje),
      supabase.from('leads').select('id').in('estudio_id', idsEstudios).eq('visita_data', hoje),
    ])
  for (const erro of [erroChecklist, erroLeadsHoje]) {
    if (erro) throw new Error(erro.message)
  }

  const concluidos = (checklistData ?? []).reduce((soma, c) => soma + c.concluidos, 0)
  const total = (checklistData ?? []).reduce((soma, c) => soma + c.total, 0)
  const sessoesHoje = (leadsHojeData ?? []).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/painel"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trocar de conta
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Coordenação</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <span className="live-dot" aria-hidden />
        {estudios.map((e) => e.nome).join(' e ')} · resumo rápido, ao vivo.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="bg-tech-grid mt-6 grid grid-cols-1 gap-3 rounded-2xl p-1 sm:grid-cols-2">
        <StatCard
          icone={KeyRound}
          cor={PALETA.neutro}
          label="Checklist hoje"
          valor={total > 0 ? `${concluidos}/${total}` : '—'}
        />
        <StatCard icone={CalendarCheck2} cor={PALETA.roxo} label="Sessões experimentais hoje" valor={sessoesHoje} />
      </div>

      <p className="mt-6 text-sm text-muted">
        Usa o menu no topo para ver Pendências, Horas da equipa, Marketing, Horários e Timeline.
      </p>
    </div>
  )
}
