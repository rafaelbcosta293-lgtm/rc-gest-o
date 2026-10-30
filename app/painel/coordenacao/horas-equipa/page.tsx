import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearCoordenacao } from '../actions'
import { corEstudio, PALETA } from '@/lib/data/constantes'
import PortaSenha from '@/components/PortaSenha'
import BarMeter from '@/components/BarMeter'
import type { Estudio } from '@/lib/supabase/database.types'

type RegistoSemana = { horas: number; pt: { nome: string } | null }

export default async function CoordenacaoHorasEquipaPage({
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
        titulo="Coordenação — Horas da equipa"
        destino="/painel/coordenacao/horas-equipa"
        action={desbloquearCoordenacao}
        erro={sp.erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link
        href="/painel/coordenacao"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Resumo
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Horas da equipa</h1>
      <p className="mt-1 text-sm text-muted">Horas registadas por instrutor, esta semana.</p>

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
              <HorasEstudio estudio={estudio} />
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

async function HorasEstudio({ estudio }: { estudio: Pick<Estudio, 'id'> }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const inicioSemana = inicioDaSemana(hoje)
  const fimSemanaExclusivo = somarDias(inicioSemana, 7)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('registos_pt')
    .select('horas, pt:perfis!pt_id(nome)')
    .eq('estudio_id', estudio.id)
    .gte('data', inicioSemana)
    .lt('data', fimSemanaExclusivo)
  if (error) throw new Error(error.message)

  const registosSemana = (data ?? []) as unknown as RegistoSemana[]
  const horasPorPt = new Map<string, number>()
  for (const r of registosSemana) {
    const nome = r.pt?.nome ?? '—'
    horasPorPt.set(nome, (horasPorPt.get(nome) ?? 0) + r.horas)
  }
  const horasEquipa = [...horasPorPt.entries()]
    .map(([nome, horas]) => ({ nome, horas }))
    .sort((a, b) => b.horas - a.horas)

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
      {horasEquipa.map((h) => (
        <BarMeter
          key={h.nome}
          label={h.nome}
          valor={h.horas}
          total={horasEquipa[0].horas}
          mostrarPct={false}
          cor={PALETA.verde.tx}
        />
      ))}
      {horasEquipa.length === 0 && <p className="text-sm text-muted">Sem registos de horas esta semana.</p>}
    </div>
  )
}
