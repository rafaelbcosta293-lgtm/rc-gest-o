import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getEstudios } from '@/lib/data/estudios'
import { fmt, MESES, DIAS_SEMANA, diasDoMes, offsetPrimeiroDia } from '@/lib/data/presencas'
import { somarDias, inicioDaSemana } from '@/lib/data/horarios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { corEstudio } from '@/lib/data/constantes'
import { desbloquearCoordenacao } from '../actions'
import { metricasNoIntervalo, METRICAS_MARKETING, type LeadMarketing, type MetricasMarketing } from '@/lib/data/marketing'
import PortaSenha from '@/components/PortaSenha'
import type { Estudio } from '@/lib/supabase/database.types'

const VISTAS = ['dia', 'semana', 'mes', 'ano'] as const
type Vista = (typeof VISTAS)[number]
const LABEL_VISTA: Record<Vista, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano' }

function ehVista(v: string | undefined): v is Vista {
  return VISTAS.includes(v as Vista)
}

function ehMetrica(v: string | undefined): v is keyof MetricasMarketing {
  return METRICAS_MARKETING.some((m) => m.chave === v)
}

function TituloEstudio({ estudio }: { estudio: Pick<Estudio, 'slug' | 'nome'> }) {
  return (
    <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold text-black dark:text-zinc-50">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corEstudio(estudio.slug).cor }} />
      {estudio.nome}
    </h3>
  )
}

function TabelaMetricas({ metricas }: { metricas: MetricasMarketing }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
      {METRICAS_MARKETING.map((m) => (
        <div key={m.chave}>
          <strong
            className={`block text-sm ${
              m.chave === 'totalFechos' ? 'text-teal-700 dark:text-teal-400' : 'text-black dark:text-zinc-50'
            }`}
          >
            {metricas[m.chave]}
          </strong>
          <span className="text-[10px] text-zinc-500">{m.label}</span>
        </div>
      ))}
    </div>
  )
}

function CalendarioDia({
  leads,
  anoMes,
  mesMes,
  metricaAtual,
  hoje,
}: {
  leads: LeadMarketing[]
  anoMes: number
  mesMes: number
  metricaAtual: keyof MetricasMarketing
  hoje: string
}) {
  const dias = diasDoMes(anoMes, mesMes)
  const offset = offsetPrimeiroDia(anoMes, mesMes)
  const metricasPorDia = new Map(dias.map((d) => [d, metricasNoIntervalo(leads, d, somarDias(d, 1))]))
  const maxValor = Math.max(1, ...dias.map((d) => metricasPorDia.get(d)![metricaAtual]))

  return (
    <div className="mt-2 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-400">
        {DIAS_SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {dias.map((dia) => {
          const m = metricasPorDia.get(dia)!
          const valor = m[metricaAtual]
          const intensidade = valor === 0 ? 0 : 0.15 + Math.min(1, valor / maxValor) * 0.55
          const numero = Number(dia.slice(8, 10))
          const tooltip = METRICAS_MARKETING.map((mm) => `${mm.label}: ${m[mm.chave]}`).join(' · ')
          return (
            <div
              key={dia}
              title={tooltip}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg ${
                dia === hoje ? 'ring-2 ring-teal-600 ring-offset-1 dark:ring-offset-zinc-950' : ''
              }`}
              style={{ background: `rgba(14, 149, 148, ${intensidade})` }}
            >
              <span className="text-[10px] text-zinc-500">{numero}</span>
              <strong className="text-sm text-black dark:text-zinc-50">{valor}</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListaSemanas({ leads, anoMes, mesMes }: { leads: LeadMarketing[]; anoMes: number; mesMes: number }) {
  const dias = diasDoMes(anoMes, mesMes)
  const primeiroDia = dias[0]
  const ultimoDia = dias[dias.length - 1]
  const semanas: string[] = []
  for (let cursor = inicioDaSemana(primeiroDia); cursor <= ultimoDia; cursor = somarDias(cursor, 7)) {
    semanas.push(cursor)
  }
  return (
    <div className="mt-2 flex flex-col gap-2">
      {semanas.map((inicioSemana) => {
        const fimSemana = somarDias(inicioSemana, 6)
        const metricas = metricasNoIntervalo(leads, inicioSemana, somarDias(inicioSemana, 7))
        return (
          <div
            key={inicioSemana}
            className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <p className="text-xs font-medium text-zinc-500">
              {fmt(inicioSemana)} – {fmt(fimSemana)}
            </p>
            <TabelaMetricas metricas={metricas} />
          </div>
        )
      })}
    </div>
  )
}

function ListaMeses({ leads, anoSelecionado }: { leads: LeadMarketing[]; anoSelecionado: number }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const inicio = `${anoSelecionado}-${String(m).padStart(2, '0')}-01`
        const fimExclusivo =
          m === 12 ? `${anoSelecionado + 1}-01-01` : `${anoSelecionado}-${String(m + 1).padStart(2, '0')}-01`
        const metricas = metricasNoIntervalo(leads, inicio, fimExclusivo)
        return (
          <div
            key={m}
            className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
          >
            <p className="text-xs font-medium text-zinc-500">{MESES[m - 1]}</p>
            <TabelaMetricas metricas={metricas} />
          </div>
        )
      })}
    </div>
  )
}

function ResumoAno({ leads, anoSelecionado }: { leads: LeadMarketing[]; anoSelecionado: number }) {
  const inicio = `${anoSelecionado}-01-01`
  const fimExclusivo = `${anoSelecionado + 1}-01-01`
  const metricas = metricasNoIntervalo(leads, inicio, fimExclusivo)
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {METRICAS_MARKETING.map((m) => (
        <div
          key={m.chave}
          className={`rounded-xl border border-black/10 p-4 dark:border-white/10 ${
            m.chave === 'totalFechos' ? 'bg-teal-50 dark:bg-teal-950' : 'bg-white dark:bg-zinc-950'
          }`}
        >
          <strong
            className={`block text-2xl ${
              m.chave === 'totalFechos' ? 'text-teal-800 dark:text-teal-200' : 'text-black dark:text-zinc-50'
            }`}
          >
            {metricas[m.chave]}
          </strong>
          <span className="text-xs text-zinc-500">{m.label}</span>
        </div>
      ))}
    </div>
  )
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; mes?: string; ano?: string; metrica?: string; erroSenha?: string }>
}) {
  const { vista: vistaParam, mes: mesParam, ano: anoParam, metrica: metricaParam, erroSenha } = await searchParams
  const vista: Vista = ehVista(vistaParam) ? vistaParam : 'dia'
  const metricaAtual = ehMetrica(metricaParam) ? metricaParam : 'totalFechos'

  const agora = new Date()
  const hoje = agora.toISOString().slice(0, 10)
  const anoAgora = agora.getFullYear()
  const mesAgora = agora.getMonth() + 1

  // Dia e Semana navegam por mês; Mês e Ano navegam por ano. Os dois
  // estúdios partilham a mesma navegação, para comparar o mesmo período.
  const anoMes = mesParam ? Number(mesParam.slice(0, 4)) : anoAgora
  const mesMes = mesParam ? Number(mesParam.slice(5, 7)) : mesAgora
  const mesAtualParam = `${anoMes}-${String(mesMes).padStart(2, '0')}`
  const mesAnteriorAno = mesMes === 1 ? anoMes - 1 : anoMes
  const mesAnteriorMes = mesMes === 1 ? 12 : mesMes - 1
  const mesSeguinteAno = mesMes === 12 ? anoMes + 1 : anoMes
  const mesSeguinteMes = mesMes === 12 ? 1 : mesMes + 1
  const mesAnteriorParam = `${mesAnteriorAno}-${String(mesAnteriorMes).padStart(2, '0')}`
  const mesSeguinteParam = `${mesSeguinteAno}-${String(mesSeguinteMes).padStart(2, '0')}`

  const anoSelecionado = anoParam ? Number(anoParam) : anoAgora

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'coordenacao')
  const desbloqueada = protegida ? await areaDesbloqueada('coordenacao') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Coordenação"
        destino="/painel/coordenacao/marketing"
        action={desbloquearCoordenacao}
        erro={erroSenha}
      />
    )
  }

  const estudios = await getEstudios(supabase)
  const leadsPorEstudio = await Promise.all(
    estudios.map(async (estudio) => {
      const { data, error } = await supabase
        .from('leads')
        .select('estado, entrada, visita_data, visita_marcada_em, walk_in')
        .eq('estudio_id', estudio.id)
      if (error) {
        throw new Error(error.message)
      }
      return { estudio, leads: (data ?? []) as LeadMarketing[] }
    })
  )

  const toggleVista = (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {VISTAS.map((v) => (
        <Link
          key={v}
          href={`/painel/coordenacao/marketing?vista=${v}`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            vista === v
              ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
              : 'border-black/10 text-zinc-600 dark:border-white/10 dark:text-zinc-400'
          }`}
        >
          {LABEL_VISTA[v]}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/painel/coordenacao" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← Coordenação
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">Marketing</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudios.map((e) => e.nome).join(' e ')} · funil de leads ao longo do tempo, lado a lado.
      </p>

      {toggleVista}

      {vista === 'dia' && (
        <>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href={`/painel/coordenacao/marketing?vista=dia&mes=${mesAnteriorParam}&metrica=${metricaAtual}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              ←
            </Link>
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              {MESES[mesMes - 1]} {anoMes}
            </span>
            <Link
              href={`/painel/coordenacao/marketing?vista=dia&mes=${mesSeguinteParam}&metrica=${metricaAtual}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              →
            </Link>
          </div>

          <p className="mt-3 text-xs text-zinc-500">Ver no calendário:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {METRICAS_MARKETING.map((m) => (
              <Link
                key={m.chave}
                href={`/painel/coordenacao/marketing?vista=dia&mes=${mesAtualParam}&metrica=${m.chave}`}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  metricaAtual === m.chave
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-black/10 text-zinc-600 dark:border-white/10 dark:text-zinc-400'
                }`}
              >
                {m.label}
              </Link>
            ))}
          </div>

          {leadsPorEstudio.map(({ estudio, leads }) => (
            <div key={estudio.id}>
              <TituloEstudio estudio={estudio} />
              <CalendarioDia leads={leads} anoMes={anoMes} mesMes={mesMes} metricaAtual={metricaAtual} hoje={hoje} />
            </div>
          ))}
        </>
      )}

      {vista === 'semana' && (
        <>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href={`/painel/coordenacao/marketing?vista=semana&mes=${mesAnteriorParam}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              ←
            </Link>
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              {MESES[mesMes - 1]} {anoMes}
            </span>
            <Link
              href={`/painel/coordenacao/marketing?vista=semana&mes=${mesSeguinteParam}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              →
            </Link>
          </div>

          {leadsPorEstudio.map(({ estudio, leads }) => (
            <div key={estudio.id}>
              <TituloEstudio estudio={estudio} />
              <ListaSemanas leads={leads} anoMes={anoMes} mesMes={mesMes} />
            </div>
          ))}
        </>
      )}

      {vista === 'mes' && (
        <>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href={`/painel/coordenacao/marketing?vista=mes&ano=${anoSelecionado - 1}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              ←
            </Link>
            <span className="text-sm font-medium text-black dark:text-zinc-50">{anoSelecionado}</span>
            <Link
              href={`/painel/coordenacao/marketing?vista=mes&ano=${anoSelecionado + 1}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              →
            </Link>
          </div>

          {leadsPorEstudio.map(({ estudio, leads }) => (
            <div key={estudio.id}>
              <TituloEstudio estudio={estudio} />
              <ListaMeses leads={leads} anoSelecionado={anoSelecionado} />
            </div>
          ))}
        </>
      )}

      {vista === 'ano' && (
        <>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href={`/painel/coordenacao/marketing?vista=ano&ano=${anoSelecionado - 1}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              ←
            </Link>
            <span className="text-sm font-medium text-black dark:text-zinc-50">{anoSelecionado}</span>
            <Link
              href={`/painel/coordenacao/marketing?vista=ano&ano=${anoSelecionado + 1}`}
              className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
            >
              →
            </Link>
          </div>

          {leadsPorEstudio.map(({ estudio, leads }) => (
            <div key={estudio.id}>
              <TituloEstudio estudio={estudio} />
              <ResumoAno leads={leads} anoSelecionado={anoSelecionado} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
