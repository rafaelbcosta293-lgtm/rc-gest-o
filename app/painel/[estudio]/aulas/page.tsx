import Link from '@/components/LinkRapido'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug, getEquipaDoEstudio } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa } from '@/lib/data/acessos'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { diasDaSemana, inicioDaSemana, somarDias } from '@/lib/data/horarios'
import { fmt, DIAS_SEMANA } from '@/lib/data/presencas'
import { carregarServicos } from '@/lib/data/servicos'
import { DIAS_SEMANA_LONGOS, SEMANAS_ABERTAS, gerarAulas, ocupadas, type Aula, type HorarioAula, type InscricaoAula } from '@/lib/data/aulas'
import { criarAulaAvulsa, guardarHorarioAula, guardarJanelaReserva, terminarHorarioAula } from './actions'
import JanelaAula, { type ClienteOpcaoAula, type InscritoNaJanela } from './JanelaAula'
import SubmitButton from '@/components/SubmitButton'

const campoCls = 'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand'
const rotuloCls = 'flex flex-col gap-1 text-xs font-medium text-muted'

// Cor de cada serviço de grupo nos cartões das aulas.
const COR_SERVICO: Record<string, string> = {
  acompanhado: 'border-l-sky-500',
  pilates: 'border-l-fuchsia-500',
}

const hhmm = (t: string) => t.slice(0, 5)

function query(base: Record<string, string | undefined>, extra: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...base, ...extra })) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

// Aulas de grupo (Treino Acompanhado, Pilates): a semana com as aulas
// abertas e a lotação de cada uma; clicar numa aula abre os inscritos.
// Por baixo, o horário semanal que gera as aulas.
export default async function AulasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ data?: string; servico?: string; aula?: string; error?: string; ok?: string; ficaram?: string }>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) notFound()

  const hoje = hojeEmLisboa()
  const inicio = inicioDaSemana(sp.data ?? hoje)
  const dias = diasDaSemana(inicio)
  const fim = dias[6]
  const servicoFiltro = Number(sp.servico) || null

  const sessao = await getSessaoAtual()
  const podeEscrever = ehContaFixa(sessao.email) || !!sessao.agendaEscrita
  const { ehGestao, ehAdmin } = papeisDaSessao(sessao)

  // Abre as aulas das próximas semanas a partir do horário (idempotente).
  if (podeEscrever) await gerarAulas(supabase, estudio.id, hoje)

  const [servicosTodos, equipa, { data: aulasData }, { data: horariosData }, { data: fechadosData }] = await Promise.all([
    carregarServicos(supabase, { soAtivos: true }),
    getEquipaDoEstudio(supabase, estudio.id),
    supabase.from('aulas').select('*').eq('estudio_id', estudio.id).gte('data', inicio).lte('data', fim).order('hora_inicio'),
    supabase.from('aulas_horario').select('*').eq('estudio_id', estudio.id).eq('ativo', true).order('dia_semana').order('hora_inicio'),
    supabase.from('dias_fechados').select('data, motivo').eq('estudio_id', estudio.id).gte('data', inicio).lte('data', fim),
  ])
  const servicosGrupo = servicosTodos.filter((s) => s.formato === 'grupo')
  const servicoPorId = new Map(servicosTodos.map((s) => [s.id, s]))
  const nomeEquipa = new Map(equipa.map((p) => [p.id, p.nome]))
  const fechados = new Map((fechadosData ?? []).map((f) => [f.data as string, (f.motivo as string | null) ?? 'Estúdio fechado']))

  const aulas = ((aulasData ?? []) as Aula[]).filter((a) => !servicoFiltro || a.servico_id === servicoFiltro)
  const ids = aulas.map((a) => a.id)
  const { data: inscricoesData } = ids.length
    ? await supabase.from('aulas_inscricoes').select('id, aula_id, cliente_id, estado, origem').in('aula_id', ids)
    : { data: [] }
  const inscricoes = (inscricoesData ?? []) as InscricaoAula[]
  const porAula = new Map<string, InscricaoAula[]>()
  for (const i of inscricoes) porAula.set(i.aula_id, [...(porAula.get(i.aula_id) ?? []), i])

  const horarios = ((horariosData ?? []) as HorarioAula[]).filter((h) => !servicoFiltro || h.servico_id === servicoFiltro)

  // A aula aberta na janela (?aula=…), com inscritos e clientes.
  const aberta = sp.aula ? ((aulasData ?? []) as Aula[]).find((a) => a.id === sp.aula) ?? null : null
  let janela: React.ReactNode = null
  if (aberta) {
    const [{ data: insc }, { data: clientesData }, { data: noServico }] = await Promise.all([
      supabase.from('aulas_inscricoes').select('id, cliente_id, estado, origem, criado_em').eq('aula_id', aberta.id).order('criado_em'),
      supabase.from('clientes').select('id, nome').eq('estudio_id', estudio.id).neq('estado', 'Inativo').order('nome'),
      supabase.from('clientes_servicos').select('cliente_id, estado').eq('servico_id', aberta.servico_id),
    ])
    const estadoServico = new Map((noServico ?? []).map((c) => [c.cliente_id as string, c.estado as string]))
    const nomes = new Map((clientesData ?? []).map((c) => [c.id as string, c.nome as string]))
    // Nomes de quem está inscrito mas já não aparece na lista (inativos).
    const emFalta = (insc ?? []).map((i) => i.cliente_id as string).filter((id) => !nomes.has(id))
    if (emFalta.length) {
      const { data: extra } = await supabase.from('clientes').select('id, nome').in('id', emFalta)
      for (const c of extra ?? []) nomes.set(c.id as string, c.nome as string)
    }
    const inscritos: InscritoNaJanela[] = (insc ?? []).map((i) => ({
      id: i.id as string,
      clienteId: i.cliente_id as string,
      nome: nomes.get(i.cliente_id as string) ?? '—',
      estado: i.estado as InscritoNaJanela['estado'],
      origem: i.origem as 'equipa' | 'cliente',
      estadoServico: estadoServico.get(i.cliente_id as string) ?? null,
    }))
    // Primeiro quem está inscrito no serviço (ativos à frente), depois os outros.
    const ordem = (e: string | null) => (e === 'Ativo' ? 0 : e === 'Pendente' ? 1 : e ? 2 : 3)
    const clientes: ClienteOpcaoAula[] = (clientesData ?? [])
      .map((c) => ({ id: c.id as string, nome: c.nome as string, estadoServico: estadoServico.get(c.id as string) ?? null }))
      .filter((c) => c.estadoServico !== 'Inativo')
      .sort((a, b) => ordem(a.estadoServico) - ordem(b.estadoServico) || a.nome.localeCompare(b.nome, 'pt'))
    const idx = (Number(new Date(`${aberta.data}T00:00:00Z`).getUTCDay()) + 6) % 7
    janela = (
      <JanelaAula
        key={aberta.id}
        estudioSlug={slug}
        aula={{
          id: aberta.id,
          servicoNome: servicoPorId.get(aberta.servico_id)?.nome ?? 'Aula',
          data: aberta.data,
          dataLabel: `${DIAS_SEMANA_LONGOS[idx]}, ${fmt(aberta.data)}`,
          horaInicio: hhmm(aberta.hora_inicio),
          duracaoMin: aberta.duracao_min,
          instrutorId: aberta.instrutor_id,
          lotacao: aberta.lotacao,
          estado: aberta.estado,
          motivoCancelamento: aberta.motivo_cancelamento,
        }}
        inscritos={inscritos}
        clientes={clientes}
        instrutores={equipa}
        podeEscrever={podeEscrever}
        fecharHref={`/painel/${slug}/aulas${query({ data: sp.data, servico: sp.servico }, {})}`}
      />
    )
  }

  const base = { data: sp.data, servico: sp.servico }
  const aqui = `/painel/${slug}/aulas${query(base, {})}`
  const mensagemOk: Record<string, string> = {
    'aula-criada': 'Aula criada.',
    reservas: 'Guardado — as reservas pela app passam a abrir com essa antecedência.',
    'horario-criado': `Horário guardado — as aulas das próximas ${SEMANAS_ABERTAS} semanas já estão abertas.`,
    'horario-terminado': sp.ficaram
      ? `Horário terminado. Ficaram ${sp.ficaram} aula(s) futura(s) com inscritos — avisa as pessoas e cancela-as aqui.`
      : 'Horário terminado (as aulas futuras sem inscritos foram retiradas).',
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link href={`/painel/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Aulas de grupo <span className="font-normal text-muted">· {estudio.nome}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/painel/${slug}/aulas${query(base, { data: somarDias(inicio, -7) })}`}
            aria-label="Semana anterior"
            className="rounded-full border border-border-strong px-2 py-1 hover:bg-brand/[.08]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold whitespace-nowrap text-foreground">
            {fmt(dias[0])} – {fmt(dias[6])}
          </span>
          <Link
            href={`/painel/${slug}/aulas${query(base, { data: somarDias(inicio, 7) })}`}
            aria-label="Semana seguinte"
            className="rounded-full border border-border-strong px-2 py-1 hover:bg-brand/[.08]"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/painel/${slug}/aulas${query({ servico: sp.servico }, {})}`}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              hoje >= dias[0] && hoje <= dias[6] ? 'border border-border-subtle text-muted' : 'bg-brand text-black hover:bg-brand-strong'
            }`}
          >
            Hoje
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[{ id: 0, nome: 'Todas' }, ...servicosGrupo].map((s) => {
            const ativo = (servicoFiltro ?? 0) === s.id
            return (
              <Link
                key={s.id}
                href={`/painel/${slug}/aulas${query({ data: sp.data }, { servico: s.id ? String(s.id) : undefined })}`}
                className={`rounded-full border px-3 py-1.5 font-semibold ${
                  ativo ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted hover:border-border-strong'
                }`}
              >
                {s.nome}
              </Link>
            )
          })}
        </div>
      </div>

      {sp.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p>
      )}
      {sp.ok && mensagemOk[sp.ok] && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{mensagemOk[sp.ok]}</p>
      )}

      {/* A semana: uma coluna por dia, as aulas por hora. */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-7">
        {dias.map((d, i) => {
          const doDia = aulas.filter((a) => a.data === d)
          return (
            <div
              key={d}
              className={`min-h-28 rounded-xl border p-2 ${
                d === hoje ? 'border-brand' : 'border-border-subtle'
              } ${fechados.has(d) ? 'bg-amber-50/60 dark:bg-amber-950/30' : 'bg-surface'}`}
            >
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-foreground">{DIAS_SEMANA[i]}</span>
                <span className="text-muted">{fmt(d).slice(0, 5)}</span>
              </div>
              {fechados.has(d) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  <CalendarOff className="h-3 w-3" /> Fechado
                </p>
              )}
              <div className="mt-1.5 flex flex-col gap-1.5">
                {doDia.map((a) => {
                  const lista = porAula.get(a.id) ?? []
                  const n = ocupadas(lista)
                  const cheia = n >= a.lotacao
                  const servico = servicoPorId.get(a.servico_id)
                  return (
                    <Link
                      key={a.id}
                      href={`/painel/${slug}/aulas${query(base, { aula: a.id })}`}
                      scroll={false}
                      className={`block rounded-lg border border-l-4 border-border-subtle px-2 py-1.5 text-xs transition-colors hover:bg-brand/[.06] ${
                        COR_SERVICO[servico?.chave ?? ''] ?? 'border-l-zinc-400'
                      } ${a.estado === 'Cancelada' ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-bold text-foreground ${a.estado === 'Cancelada' ? 'line-through' : ''}`}>{hhmm(a.hora_inicio)}</span>
                        <span
                          className={`rounded-full px-1.5 text-[11px] font-bold ${
                            a.estado === 'Cancelada'
                              ? 'text-muted'
                              : cheia
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          }`}
                        >
                          {a.estado === 'Cancelada' ? 'cancelada' : `${n}/${a.lotacao}`}
                        </span>
                      </div>
                      <div className="truncate text-foreground">{servico?.nome ?? 'Aula'}</div>
                      {a.instrutor_id && <div className="truncate text-muted">{nomeEquipa.get(a.instrutor_id) ?? ''}</div>}
                    </Link>
                  )
                })}
                {doDia.length === 0 && !fechados.has(d) && <p className="text-[11px] text-muted">—</p>}
              </div>
            </div>
          )
        })}
      </div>

      {podeEscrever && (
        <details className="mt-4 rounded-xl border border-border-subtle bg-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">+ Aula avulsa (fora do horário semanal)</summary>
          <form action={criarAulaAvulsa} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="estudio_id" value={estudio.id} />
            <input type="hidden" name="voltar" value={aqui} />
            <CamposAula servicos={servicosGrupo} equipa={equipa} comData dataOmissao={hoje > fim ? fim : hoje < inicio ? inicio : hoje} />
            <SubmitButton pendingText="A criar…" className="col-span-2 self-end rounded-full bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-strong sm:col-span-1">
              Criar aula
            </SubmitButton>
          </form>
        </details>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Horário semanal das aulas</h2>
      <p className="mt-1 text-xs text-muted">
        Cada linha abre automaticamente as aulas das próximas {SEMANAS_ABERTAS} semanas (menos nos dias em que o estúdio está fechado). As
        pessoas inscrevem-se aula a aula.
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
        {horarios.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <span className="w-24 font-semibold text-foreground">{DIAS_SEMANA_LONGOS[h.dia_semana - 1]}</span>
            <span className="w-14 font-mono">{hhmm(h.hora_inicio)}</span>
            <span className="flex-1">
              {servicoPorId.get(h.servico_id)?.nome ?? '—'}
              <span className="text-muted">
                {' '}
                · {h.duracao_min} min · {h.lotacao} lugares{h.instrutor_id ? ` · ${nomeEquipa.get(h.instrutor_id) ?? ''}` : ''}
              </span>
            </span>
            {ehGestao && (
              <form action={terminarHorarioAula}>
                <input type="hidden" name="estudio_slug" value={slug} />
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="voltar" value={aqui} />
                <SubmitButton pendingText="…" className="rounded-full border border-border-strong px-3 py-1 text-xs font-semibold hover:bg-red-50 hover:text-red-700">
                  Terminar
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
        {horarios.length === 0 && <li className="px-3 py-3 text-sm text-muted">Ainda não há aulas no horário semanal.</li>}
      </ul>

      {ehGestao && (
        <form action={guardarHorarioAula} className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-dashed border-border-strong p-3 sm:grid-cols-6">
          <input type="hidden" name="estudio_slug" value={slug} />
          <input type="hidden" name="estudio_id" value={estudio.id} />
          <input type="hidden" name="voltar" value={aqui} />
          <CamposAula servicos={servicosGrupo} equipa={equipa} />
          <SubmitButton pendingText="A guardar…" className="col-span-2 self-end rounded-full bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-strong sm:col-span-1">
            + Ao horário
          </SubmitButton>
        </form>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Reservas pela app</h2>
      <p className="mt-1 text-xs text-muted">
        Como nos ginásios: cada pessoa só consegue reservar uma aula a partir de X horas antes do início (e até a aula
        começar), sempre até à lotação. A equipa pode inscrever pessoas a qualquer momento.
      </p>
      <form action={guardarJanelaReserva} className="mt-2 flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface p-3">
        <input type="hidden" name="estudio_slug" value={slug} />
        <input type="hidden" name="voltar" value={aqui} />
        {servicosGrupo.map((s) => (
          <label key={s.id} className={rotuloCls}>
            {s.nome} — abre
            <select name={`abre_${s.id}`} defaultValue={s.reserva_abre_horas ?? 48} disabled={!ehAdmin} className={campoCls}>
              {[12, 24, 48, 72, 168].map((h) => (
                <option key={h} value={h}>
                  {h === 168 ? '1 semana' : `${h} horas`} antes
                </option>
              ))}
            </select>
          </label>
        ))}
        {ehAdmin && (
          <SubmitButton pendingText="A guardar…" className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-strong">
            Guardar
          </SubmitButton>
        )}
      </form>

      {janela}
    </div>
  )
}

// Os campos de uma aula (serviço, dia ou data, hora, duração, lotação,
// instrutor). A lotação por omissão é a de cada serviço (8 no Treino
// Acompanhado, 5 no Pilates) — ajusta-se à escolha do serviço no
// próprio formulário (ver CampoLotacao).
function CamposAula({
  servicos,
  equipa,
  comData = false,
  dataOmissao,
}: {
  servicos: { id: number; nome: string; lotacao_omissao?: number | null }[]
  equipa: { id: string; nome: string }[]
  comData?: boolean
  dataOmissao?: string
}) {
  return (
    <>
      <label className={rotuloCls}>
        Serviço
        <select name="servico_id" required defaultValue={servicos[0]?.id} className={campoCls}>
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} ({s.lotacao_omissao ?? '—'} lugares)
            </option>
          ))}
        </select>
      </label>
      {comData ? (
        <label className={rotuloCls}>
          Dia
          <input name="data" type="date" required defaultValue={dataOmissao} className={campoCls} />
        </label>
      ) : (
        <label className={rotuloCls}>
          Dia da semana
          <select name="dia_semana" required defaultValue={1} className={campoCls}>
            {DIAS_SEMANA_LONGOS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={rotuloCls}>
        Hora
        <input name="hora_inicio" type="time" required defaultValue="19:00" className={campoCls} />
      </label>
      <label className={rotuloCls}>
        Duração (min)
        <input name="duracao_min" type="number" min={10} max={240} defaultValue={50} className={campoCls} />
      </label>
      <label className={rotuloCls}>
        Lotação
        <input
          name="lotacao"
          type="number"
          min={1}
          max={50}
          placeholder="a do serviço"
          title="Vazio = a lotação do serviço (Treino Acompanhado: 8 · Pilates: 5)"
          className={campoCls}
        />
      </label>
      <label className={rotuloCls}>
        Instrutor
        <select name="instrutor_id" defaultValue="" className={campoCls}>
          <option value="">—</option>
          {equipa.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
