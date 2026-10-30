import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearCoordenacao } from '../actions'
import { corEstudio, PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import RadialProgress from '@/components/RadialProgress'
import type { Estudio } from '@/lib/supabase/database.types'

type ChecklistHoje = { tipo: string; concluidos: number; total: number }

export default async function CoordenacaoChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação — Checklist"
        destino="/painel/coordenacao/checklist"
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

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Checklist de hoje</h1>
      <p className="mt-1 text-sm text-muted">Abertura e fecho de cada estúdio, ao vivo.</p>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
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
              <ChecklistEstudio estudio={estudio} />
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

async function ChecklistEstudio({ estudio }: { estudio: Pick<Estudio, 'id' | 'slug'> }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const supabase = await createClient()

  const { data: checklistHojeData, error } = await supabase
    .from('checklist_registos')
    .select('tipo, concluidos, total')
    .eq('estudio_id', estudio.id)
    .eq('data', hoje)
  if (error) throw new Error(error.message)

  const checklistHoje = (checklistHojeData ?? []) as ChecklistHoje[]

  return (
    <div className="mt-2 flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
      <Link
        href={`/painel/${estudio.slug}/checklist`}
        className="text-xs text-muted underline hover:text-foreground"
      >
        abrir checklist
      </Link>
      <div className="ml-auto flex items-center gap-4">
        {['Abertura', 'Fecho'].map((tipo) => {
          const r = checklistHoje.find((c) => c.tipo === tipo)
          const pct = r && r.total > 0 ? (r.concluidos / r.total) * 100 : 0
          const completa = r && r.concluidos >= r.total && r.total > 0
          return (
            <div key={tipo} className="flex flex-col items-center gap-1.5">
              <RadialProgress
                valor={pct}
                tamanho={56}
                espessura={5}
                cor={completa ? PALETA.teal.tx : 'var(--accent)'}
              />
              <span className="text-[10px] font-medium text-muted">
                {tipo} · {r ? `${r.concluidos}/${r.total}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
