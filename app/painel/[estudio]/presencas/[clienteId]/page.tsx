import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { PRESENCAS } from '@/lib/data/constantes'
import {
  treinosPrevistos,
  intervaloMes,
  MESES,
  fmt,
  diasDoMes,
  offsetPrimeiroDia,
  DIAS_SEMANA,
} from '@/lib/data/presencas'
import { marcarPresenca, apagarPresenca } from '../actions'
import SubmitButton from '@/components/SubmitButton'

export default async function PresencasClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string; clienteId: string }>
  searchParams: Promise<{ ano?: string; mes?: string; error?: string }>
}) {
  const { estudio: slug, clienteId } = await params
  const agora = new Date()
  const { ano: anoParam, mes: mesParam, error } = await searchParams
  const ano = anoParam ? Number(anoParam) : agora.getFullYear()
  const mes = mesParam ? Number(mesParam) : agora.getMonth() + 1
  const hoje = agora.toISOString().slice(0, 10)

  const supabase = await createClient()
  const { inicio, fimExclusivo } = intervaloMes(ano, mes)

  const [estudio, { data: cliente }, { data: presencasData, error: erroPresencas }] =
    await Promise.all([
      getEstudioPorSlug(supabase, slug),
      supabase
        .from('clientes')
        .select('id, nome, frequencia_semanal, estudio_id')
        .eq('id', clienteId)
        .maybeSingle(),
      supabase
        .from('presencas')
        .select('id, data, estado, nota, pt:perfis!pt_id(nome)')
        .eq('cliente_id', clienteId)
        .gte('data', inicio)
        .lt('data', fimExclusivo)
        .order('data', { ascending: false }),
    ])

  if (!estudio || !cliente || cliente.estudio_id !== estudio.id) {
    notFound()
  }

  if (erroPresencas) {
    throw new Error(erroPresencas.message)
  }

  type PresencaComPt = {
    id: string
    data: string
    estado: string
    nota: string | null
    pt: { nome: string } | null
  }
  const lista = (presencasData ?? []) as unknown as PresencaComPt[]
  const feitos = lista.filter((p) => p.estado === 'Presente').length
  const faltas = lista.filter((p) => p.estado === 'Faltou').length
  const avisadas = lista.filter((p) => p.estado === 'Faltou (avisou)').length
  const prev = treinosPrevistos(cliente.frequencia_semanal, ano, mes)

  const porDia = new Map(lista.map((p) => [p.data, p]))
  const dias = diasDoMes(ano, mes)
  const offset = offsetPrimeiroDia(ano, mes)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}/presencas?ano=${ano}&mes=${mes}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Presenças
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        {cliente.nome}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {cliente.frequencia_semanal
          ? `${cliente.frequencia_semanal} treinos por semana`
          : 'frequência não definida'}{' '}
        · {MESES[mes - 1]} {ano}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
          <strong className="block text-lg text-green-700 dark:text-green-300">
            {feitos}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">treinos feitos</span>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <strong className="block text-lg text-black dark:text-zinc-50">
            {prev?.arredondado ?? '—'}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">previstos</span>
        </div>
        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950">
          <strong className="block text-lg text-red-700 dark:text-red-300">{faltas}</strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">faltas</span>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
          <strong className="block text-lg text-amber-700 dark:text-amber-300">
            {avisadas}
          </strong>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">avisadas</span>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-400">
          {DIAS_SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {dias.map((iso) => {
            const p = porDia.get(iso)
            const st = p ? (PRESENCAS[p.estado as keyof typeof PRESENCAS] ?? null) : null
            const numero = Number(iso.slice(8, 10))
            return (
              <div
                key={iso}
                title={p ? `${p.estado}${p.nota ? ' · ' + p.nota : ''}` : undefined}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${
                  iso === hoje ? 'ring-2 ring-teal-600 ring-offset-1 dark:ring-offset-zinc-950' : ''
                }`}
                style={st ? { background: st.bg, color: st.tx } : undefined}
              >
                <span className={!st ? 'text-zinc-300 dark:text-zinc-700' : undefined}>
                  {numero}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-500">
          {Object.entries(PRESENCAS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.tx }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Marcar presença
      </h2>
      <form className="mt-2 flex flex-wrap items-end gap-3" action={marcarPresenca}>
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="cliente_id" value={clienteId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dia</label>
          <input
            type="date"
            name="data"
            defaultValue={hoje}
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Estado</label>
          <select
            name="estado"
            defaultValue="Presente"
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          >
            {Object.keys(PRESENCAS).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Nota (opcional)
          </label>
          <input
            name="nota"
            placeholder="ex.: avisou de manhã"
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <SubmitButton
          pendingText="A registar…"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Registar
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        Só pode existir um registo por dia — marcar de novo substitui o anterior desse dia.
      </p>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Registos de {MESES[mes - 1]} ({lista.length})
      </h2>
      {lista.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-zinc-500 dark:border-white/10">
          Sem registos neste mês.
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {lista.map((p) => {
          const st = PRESENCAS[p.estado as keyof typeof PRESENCAS] ?? {
            bg: '#F2F5FA',
            tx: '#6B7688',
          }
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950"
            >
              <span className="w-16 text-xs text-zinc-500">{fmt(p.data)}</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: st.bg, color: st.tx }}
              >
                {p.estado}
              </span>
              <span className="text-xs text-zinc-500">{p.pt?.nome ?? '—'}</span>
              {p.nota && (
                <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                  {p.nota}
                </span>
              )}
              <form action={apagarPresenca}>
                <input type="hidden" name="estudio_slug" value={slug} />
                <input type="hidden" name="cliente_id" value={clienteId} />
                <input type="hidden" name="id" value={p.id} />
                <SubmitButton
                  pendingText="…"
                  aria-label="Apagar"
                  className="ml-auto text-lg text-zinc-400 hover:text-red-600"
                >
                  ×
                </SubmitButton>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
