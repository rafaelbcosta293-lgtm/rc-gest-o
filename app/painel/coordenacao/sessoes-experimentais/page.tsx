import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { fmt } from '@/lib/data/presencas'
import { somarDias } from '@/lib/data/horarios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearCoordenacao } from '../actions'
import { corEstudio, ESTADOS_LEAD } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import type { Estudio, Lead } from '@/lib/supabase/database.types'

type LeadDoDia = Pick<Lead, 'id' | 'nome' | 'visita_hora' | 'estado'>
type SP = Record<string, string | undefined>

// Cada estúdio navega o seu próprio dia nesta página combinada, sem
// pisar o do outro — a chave de cada parâmetro leva o slug à frente
// ("fatima_dia", "leiria_dia") e comQuery preserva tudo o resto.
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

export default async function CoordenacaoSessoesExperimentaisPage({
  searchParams,
}: {
  searchParams: Promise<SP & { erroSenha?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação — Sessões experimentais"
        destino="/painel/coordenacao/sessoes-experimentais"
        action={desbloquearCoordenacao}
        erro={sp.erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/painel/coordenacao"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Resumo
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Sessões experimentais</h1>
      <p className="mt-1 text-sm text-muted">Visitas agendadas, por dia e por estúdio.</p>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-2">
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
              <SessoesEstudio estudio={estudio} sp={sp} />
            </Suspense>
          </section>
        ))}
      </div>
    </div>
  )
}

function EsqueletoEstudio() {
  return <div className="mt-2 h-24 animate-pulse rounded-2xl border border-border-subtle bg-border-subtle" />
}

async function SessoesEstudio({ estudio, sp }: { estudio: Pick<Estudio, 'id' | 'slug'>; sp: SP }) {
  const slug = estudio.slug
  const pk = (nome: string) => `${slug}_${nome}`
  const hoje = new Date().toISOString().slice(0, 10)

  const diaSessoes = sp[pk('dia')] || hoje
  const diaSessoesEhHoje = diaSessoes === hoje
  const diaSessoesAnterior = somarDias(diaSessoes, -1)
  const diaSessoesSeguinte = somarDias(diaSessoes, 1)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('id, nome, visita_hora, estado')
    .eq('estudio_id', estudio.id)
    .eq('visita_data', diaSessoes)
    .order('visita_hora', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)

  const sessoesDoDia = (data ?? []) as LeadDoDia[]

  return (
    <>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/painel/coordenacao/sessoes-experimentais${comQuery(sp, { [pk('dia')]: diaSessoesAnterior })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ←
        </Link>
        <span className="text-sm font-medium">{diaSessoesEhHoje ? 'Hoje' : fmt(diaSessoes)}</span>
        <Link
          href={`/painel/coordenacao/sessoes-experimentais${comQuery(sp, { [pk('dia')]: diaSessoesSeguinte })}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          →
        </Link>
        {!diaSessoesEhHoje && (
          <Link
            href={`/painel/coordenacao/sessoes-experimentais${comQuery(sp, { [pk('dia')]: undefined })}`}
            className="text-xs text-muted underline"
          >
            voltar a hoje
          </Link>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {sessoesDoDia.map((l) => {
          const cor = ESTADOS_LEAD[l.estado as keyof typeof ESTADOS_LEAD]
          return (
            <Link
              key={l.id}
              href={`/painel/${slug}/leads/${l.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-3 text-sm transition-colors hover:border-border-strong"
            >
              <span className="flex items-center gap-2">
                {l.visita_hora && (
                  <span className="text-xs text-muted">{l.visita_hora.slice(0, 5)}</span>
                )}
                <span className="font-medium text-foreground">{l.nome}</span>
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: cor.bg, color: cor.tx }}
              >
                {l.estado}
              </span>
            </Link>
          )
        })}
        {sessoesDoDia.length === 0 && (
          <p className="text-sm text-muted">Nenhuma sessão experimental agendada para este dia.</p>
        )}
      </div>
    </>
  )
}
