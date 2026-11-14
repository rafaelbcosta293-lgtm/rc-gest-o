import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { MESES } from '@/lib/data/presencas'
import { configPara, obterAcessoHoras } from '@/lib/data/acessoHoras'
import { TIPOS_CONTRATO } from '@/lib/data/equipaAssiduidade'
import {
  calcularResumoMes,
  diaDaSemana,
  diasDoMesISO,
  ehDiaUtil,
  fechoDisponivel,
  feriadoNoEstudio,
  formatarHoras,
  hojeLisboa,
} from '@/lib/data/assiduidade'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import {
  apagarRegistoHoras,
  guardarConfigHoras,
  guardarRegistoHoras,
  reverFechoHoras,
  submeterFechoHoras,
} from './actions'

type Registo = {
  data: string
  entrada_1: string | null
  saida_1: string | null
  entrada_2: string | null
  saida_2: string | null
  horas: number
  nota: string | null
}
type Fecho = {
  perfil_id: string
  estado: 'Rascunho' | 'Submetido' | 'Aprovado'
  horas_realizadas: number
  horas_esperadas: number
  saldo: number
  submetido_em: string | null
  aprovado_em: string | null
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const hm = (h: string | null) => (h ? h.slice(0, 5) : '')
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const inputCls =
  'rounded-md border border-border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-black/30 disabled:opacity-50'

const MENSAGENS: Record<string, string> = {
  registado: 'Horas registadas.',
  apagado: 'Registo apagado.',
  submetido: 'Mês submetido. Fica fechado até a administração o aprovar ou reabrir.',
  aprovado: 'Mês aprovado.',
  reaberto: 'Mês reaberto para correções.',
  contrato: 'Contrato atualizado.',
}
const COR_FECHO: Record<Fecho['estado'], string> = {
  Rascunho: 'bg-zinc-100 text-zinc-700',
  Submetido: 'bg-amber-100 text-amber-800',
  Aprovado: 'bg-emerald-100 text-emerald-800',
}

export default async function RegistoHorasPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ mes?: string; pessoa?: string; dia?: string; error?: string; ok?: string }>
}) {
  const { estudio: slug } = await params
  const sp = await searchParams
  const acesso = await obterAcessoHoras(slug)
  if ('erro' in acesso) notFound()
  const { modo, equipa, db } = acesso

  const hoje = hojeLisboa()
  const mesISO = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : hoje.slice(0, 7)
  const [ano, mes] = mesISO.split('-').map(Number)
  const somarMes = (n: number) => {
    const t = ano * 12 + (mes - 1) + n
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  }

  // Quem estamos a ver: a própria pessoa (conta pessoal) ou o nome
  // escolhido (gestão e conta partilhada do estúdio).
  const pessoaId =
    modo === 'pessoal' ? acesso.userId : sp.pessoa && acesso.pessoasPermitidas.has(sp.pessoa) ? sp.pessoa : null
  const pessoa = pessoaId ? equipa.find((m) => m.id === pessoaId) : undefined
  const link = (extra: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams()
    const valores = { mes: mesISO, pessoa: pessoaId ?? undefined, ...extra }
    for (const [k, v] of Object.entries(valores)) if (v) qs.set(k, v)
    return `/painel/${slug}/assiduidade?${qs.toString()}`
  }

  const dias = diasDoMesISO(ano, mes)
  const [config, { data: registosData, error: erroRegistos }, { data: feriasData }, { data: fechoData }, { data: estudiosData }] =
    await Promise.all([
      pessoaId ? configPara(acesso, pessoaId) : Promise.resolve(null),
      pessoaId
        ? db
            .from('registos_horario')
            .select('data, entrada_1, saida_1, entrada_2, saida_2, horas, nota')
            .eq('perfil_id', pessoaId)
            .gte('data', dias[0])
            .lte('data', dias[dias.length - 1])
        : Promise.resolve({ data: [], error: null }),
      pessoaId
        ? db.from('pedidos_ferias').select('dias').eq('perfil_id', pessoaId).eq('estado', 'Aprovado').eq('ano', ano)
        : Promise.resolve({ data: [] }),
      pessoaId
        ? db.from('fechos_horario').select('*').eq('perfil_id', pessoaId).eq('ano', ano).eq('mes', mes).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from('estudios').select('id, slug, nome'),
    ])
  if (erroRegistos) throw new Error(erroRegistos.message)

  const registos = ((registosData ?? []) as Registo[]).map((r) => ({ ...r, horas: Number(r.horas) }))
  const porDia = new Map(registos.map((r) => [r.data, r]))
  const diasFerias = (feriasData ?? []).flatMap((f) => f.dias as string[])
  const feriasSet = new Set(diasFerias)
  const fecho = (fechoData as Fecho | null) ?? null
  const fechado = !!fecho && fecho.estado !== 'Rascunho'
  const bloqueado = fechado && modo !== 'gestao'
  const slugContrato = (estudiosData ?? []).find((e) => e.id === config?.estudio_id)?.slug ?? slug
  const resumo = config
    ? calcularResumoMes({ ano, mes, slug: slugContrato, horasDiarias: config.horas_diarias, registos, diasFerias, ateDia: hoje })
    : null

  // Dia em edição no formulário: o pedido no link, senão hoje (se for
  // deste mês), senão o último dia do mês.
  const diaForm = sp.dia && dias.includes(sp.dia) && sp.dia <= hoje ? sp.dia : dias.includes(hoje) ? hoje : dias[dias.length - 1]
  const regForm = porDia.get(diaForm)
  const mesFuturo = dias[0] > hoje

  // Gestão: resumo da equipa no mês.
  let linhasEquipa: { id: string; nome: string; realizadas: number; esperadas: number; saldo: number; semRegisto: number; fecho: Fecho | null }[] = []
  if (modo === 'gestao' && equipa.length > 0) {
    const ids = equipa.map((m) => m.id)
    const [{ data: todosRegistos }, { data: todasFerias }, { data: todosFechos }] = await Promise.all([
      db.from('registos_horario').select('perfil_id, data, horas').in('perfil_id', ids).gte('data', dias[0]).lte('data', dias[dias.length - 1]),
      db.from('pedidos_ferias').select('perfil_id, dias').in('perfil_id', ids).eq('estado', 'Aprovado').eq('ano', ano),
      db.from('fechos_horario').select('*').in('perfil_id', ids).eq('ano', ano).eq('mes', mes),
    ])
    linhasEquipa = equipa.map((m) => {
      const r = calcularResumoMes({
        ano,
        mes,
        slug: (estudiosData ?? []).find((e) => e.id === m.config.estudio_id)?.slug ?? slug,
        horasDiarias: m.config.horas_diarias,
        registos: (todosRegistos ?? []).filter((x) => x.perfil_id === m.id).map((x) => ({ data: x.data, horas: Number(x.horas) })),
        diasFerias: (todasFerias ?? []).filter((x) => x.perfil_id === m.id).flatMap((x) => x.dias as string[]),
        ateDia: hoje,
      })
      return {
        id: m.id,
        nome: m.nome,
        realizadas: r.horasRealizadas,
        esperadas: r.horasEsperadas,
        saldo: r.saldo,
        semRegisto: r.diasSemRegisto.length,
        fecho: ((todosFechos ?? []) as Fecho[]).find((f) => f.perfil_id === m.id) ?? null,
      }
    })
  }

  const ocultos = (
    <>
      <input type="hidden" name="estudio_slug" value={slug} />
      <input type="hidden" name="mes" value={mesISO} />
      <input type="hidden" name="perfil_id" value={pessoaId ?? ''} />
    </>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Registo de Horas</h1>
          <p className="mt-1 text-sm text-muted">
            Entradas e saídas de cada dia, saldo de horas do mês e fecho mensal
            {modo === 'partilhada' ? ' — escolhe o teu nome para registares as tuas horas.' : '.'}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-card">
          <Link href={link({ mes: somarMes(-1), dia: undefined })} aria-label="Mês anterior" className="rounded-full p-1.5 text-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 px-2 text-center text-sm font-semibold text-foreground">
            {MESES[mes - 1]} {ano}
          </span>
          <Link href={link({ mes: somarMes(1), dia: undefined })} aria-label="Mês seguinte" className="rounded-full p-1.5 text-muted hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {sp.error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}
      {sp.ok && MENSAGENS[sp.ok] && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{MENSAGENS[sp.ok]}</p>}

      {modo !== 'pessoal' && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Quem</span>
          {equipa.map((m) => (
            <Link
              key={m.id}
              href={link({ pessoa: m.id, dia: undefined })}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                m.id === pessoaId ? 'bg-brand text-black' : 'border border-border-subtle bg-surface text-foreground hover:bg-brand/[.08]'
              }`}
            >
              {m.nome}
            </Link>
          ))}
          {equipa.length === 0 && (
            <span className="text-sm text-muted">Ainda não há instrutores neste estúdio — cria-os em Administração → Contas.</span>
          )}
        </div>
      )}

      {!pessoaId && modo !== 'gestao' && equipa.length > 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
          Escolhe o teu nome acima para registares as horas.
        </p>
      )}

      {pessoaId && config && resumo && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Numero label="Horas feitas" valor={formatarHoras(resumo.horasRealizadas)} />
            <Numero label="Horas do mês" valor={formatarHoras(resumo.horasEsperadas)} nota={`${resumo.diasUteis - resumo.diasFerias.length} dias × ${formatarHoras(config.horas_diarias)}`} />
            <Numero
              label="Saldo"
              valor={formatarHoras(resumo.saldo, true)}
              cor={resumo.saldo > 0 ? 'text-emerald-700' : resumo.saldo < 0 ? 'text-red-700' : undefined}
              nota={resumo.saldo > 0 ? 'horas extra' : resumo.saldo < 0 ? 'em falta até ao fim do mês' : undefined}
            />
            <Numero label="Dias trabalhados" valor={`${resumo.diasTrabalhados} de ${resumo.diasUteis}`} nota={resumo.diasFerias.length ? `${resumo.diasFerias.length} de férias` : undefined} />
            <Numero
              label="Dias sem registo"
              valor={String(resumo.diasSemRegisto.length)}
              cor={resumo.diasSemRegisto.length ? 'text-amber-700' : undefined}
              nota={resumo.diasSemRegisto.length ? resumo.diasSemRegisto.slice(0, 4).map(dataCurta).join(', ') + (resumo.diasSemRegisto.length > 4 ? '…' : '') : 'tudo registado'}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
            <div className="flex flex-col gap-4">
              {/* Registar um dia */}
              <form key={`${pessoaId}-${diaForm}`} action={guardarRegistoHoras} className="rounded-xl border border-border-subtle bg-surface p-4">
                {ocultos}
                <h2 className="text-sm font-bold text-foreground">
                  {regForm ? 'Corrigir registo' : 'Registar horas'}
                  {pessoa ? ` · ${pessoa.nome}` : ''}
                </h2>
                {bloqueado || mesFuturo ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <Lock className="h-4 w-4" />
                    {mesFuturo ? 'Este mês ainda não começou.' : 'Mês submetido — só a administração o pode reabrir.'}
                  </p>
                ) : (
                  <>
                    <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-muted">
                      Dia
                      <input type="date" name="data" required defaultValue={diaForm} min={dias[0]} max={hoje < dias[dias.length - 1] ? hoje : dias[dias.length - 1]} className={inputCls} />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Entrada
                        <input type="time" name="entrada_1" required defaultValue={hm(regForm?.entrada_1 ?? null)} className={inputCls} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Saída
                        <input type="time" name="saida_1" required defaultValue={hm(regForm?.saida_1 ?? null)} className={inputCls} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        2.ª entrada (opcional)
                        <input type="time" name="entrada_2" defaultValue={hm(regForm?.entrada_2 ?? null)} className={inputCls} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        2.ª saída
                        <input type="time" name="saida_2" defaultValue={hm(regForm?.saida_2 ?? null)} className={inputCls} />
                      </label>
                    </div>
                    <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-muted">
                      Nota (opcional)
                      <input name="nota" defaultValue={regForm?.nota ?? ''} placeholder="Ex.: formação, saída mais cedo" className={inputCls} />
                    </label>
                    <p className="mt-2 text-xs text-muted">Usa a 2.ª entrada/saída quando o dia tem dois turnos (manhã e tarde).</p>
                    <SubmitButton pendingText="A guardar…" className="mt-3 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black hover:bg-brand-strong">
                      {regForm ? 'Guardar alterações' : 'Registar'}
                    </SubmitButton>
                  </>
                )}
              </form>

              {/* Fecho do mês */}
              <div className="rounded-xl border border-border-subtle bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-foreground">Fecho de {MESES[mes - 1].toLowerCase()}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${COR_FECHO[fecho?.estado ?? 'Rascunho']}`}>
                    {fecho?.estado === 'Submetido' ? 'Aguarda aprovação' : fecho?.estado === 'Aprovado' ? 'Aprovado' : 'Em aberto'}
                  </span>
                </div>
                {fechado && fecho ? (
                  <p className="mt-2 text-sm text-muted">
                    Submetido com {formatarHoras(Number(fecho.horas_realizadas))} feitas de {formatarHoras(Number(fecho.horas_esperadas))} (saldo{' '}
                    {formatarHoras(Number(fecho.saldo), true)}).
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    {fechoDisponivel(hoje, ano, mes)
                      ? 'Confirma que os dias estão todos registados e submete o mês. Depois de submetido, só a administração o pode reabrir.'
                      : 'O fecho abre a partir do dia 25. Até lá, vai registando os dias.'}
                  </p>
                )}
                {!fechado && fechoDisponivel(hoje, ano, mes) && (
                  <ConfirmarAcao
                    action={submeterFechoHoras}
                    confirmacao={`Submeter ${MESES[mes - 1].toLowerCase()} com ${formatarHoras(resumo.horasRealizadas)} feitas (saldo ${formatarHoras(resumo.saldo, true)})? Depois só a administração pode reabrir.`}
                    className="mt-3"
                  >
                    {ocultos}
                    <button type="submit" className="w-full rounded-full border border-border-strong px-5 py-2 text-sm font-bold text-foreground hover:bg-brand/[.08]">
                      Submeter o mês
                    </button>
                  </ConfirmarAcao>
                )}
                {fechado && modo === 'gestao' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fecho?.estado === 'Submetido' && (
                      <form action={reverFechoHoras}>
                        {ocultos}
                        <input type="hidden" name="decisao" value="aprovar" />
                        <SubmitButton pendingText="…" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-black hover:bg-brand-strong">
                          Aprovar
                        </SubmitButton>
                      </form>
                    )}
                    <form action={reverFechoHoras}>
                      {ocultos}
                      <input type="hidden" name="decisao" value="reabrir" />
                      <SubmitButton pendingText="…" className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold text-foreground hover:bg-brand/[.08]">
                        Reabrir para correções
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </div>

              {modo === 'gestao' && (
                <form action={guardarConfigHoras} className="rounded-xl border border-border-subtle bg-surface p-4">
                  {ocultos}
                  <h2 className="text-sm font-bold text-foreground">Contrato{pessoa ? ` · ${pessoa.nome}` : ''}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Horas por dia
                      <input name="horas_diarias" inputMode="decimal" defaultValue={String(config.horas_diarias).replace('.', ',')} className={inputCls} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Tipo
                      <select name="tipo_contrato" defaultValue={config.tipo_contrato} className={inputCls}>
                        {Object.entries(TIPOS_CONTRATO).map(([v, r]) => (
                          <option key={v} value={v}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-muted">
                      Estúdio (feriado municipal)
                      <select name="estudio_id" defaultValue={config.estudio_id} className={inputCls}>
                        {(estudiosData ?? []).map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <SubmitButton pendingText="…" className="mt-3 rounded-full border border-border-strong px-4 py-2 text-sm font-bold text-foreground hover:bg-brand/[.08]">
                    Guardar contrato
                  </SubmitButton>
                </form>
              )}
            </div>

            {/* Dias do mês */}
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-3 py-2 font-semibold">Dia</th>
                    <th className="px-3 py-2 font-semibold">1.º turno</th>
                    <th className="px-3 py-2 font-semibold">2.º turno</th>
                    <th className="px-3 py-2 text-right font-semibold">Horas</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => {
                    const r = porDia.get(d)
                    const util = ehDiaUtil(d, slugContrato)
                    const feriado = feriadoNoEstudio(d, slugContrato)
                    const ferias = feriasSet.has(d) && util
                    const futuro = d > hoje
                    const emFalta = util && !r && !ferias && !futuro
                    return (
                      <tr
                        key={d}
                        className={`border-b border-border-subtle/60 last:border-0 ${!util ? 'bg-foreground/[.03] text-muted' : ''} ${
                          d === diaForm && !bloqueado ? 'outline outline-2 -outline-offset-2 outline-brand/60' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="font-mono text-xs">{dataCurta(d)}</span>{' '}
                          <span className="text-xs text-muted">{DIAS[diaDaSemana(d)]}</span>
                          {d === hoje && <span className="ml-1.5 rounded-full bg-brand px-1.5 py-px text-[10px] font-bold text-black">hoje</span>}
                        </td>
                        {r ? (
                          <>
                            <td className="px-3 py-1.5 font-mono text-xs">
                              {hm(r.entrada_1)}–{hm(r.saida_1)}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-xs">{r.entrada_2 ? `${hm(r.entrada_2)}–${hm(r.saida_2)}` : ''}</td>
                          </>
                        ) : (
                          <td colSpan={2} className="px-3 py-1.5 text-xs">
                            {feriado ? (
                              feriado.nome
                            ) : ferias ? (
                              <span className="font-semibold text-emerald-700">Férias</span>
                            ) : !util ? (
                              diaDaSemana(d) === 6 ? 'Sábado' : 'Domingo'
                            ) : emFalta ? (
                              <span className="font-semibold text-amber-700">Sem registo</span>
                            ) : (
                              ''
                            )}
                          </td>
                        )}
                        <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold">
                          {r ? formatarHoras(r.horas) : ''}
                          {r?.nota && <span className="block font-sans font-normal text-muted">{r.nota}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {!futuro && !bloqueado && (
                            <span className="inline-flex items-center gap-2">
                              <Link href={link({ dia: d })} className="text-xs font-semibold text-foreground underline">
                                {r ? 'Corrigir' : 'Registar'}
                              </Link>
                              {r && (
                                <ConfirmarAcao action={apagarRegistoHoras} confirmacao={`Apagar o registo de ${dataCurta(d)}?`} className="inline">
                                  {ocultos}
                                  <input type="hidden" name="data" value={d} />
                                  <button type="submit" className="text-xs font-semibold text-red-700 underline">
                                    Apagar
                                  </button>
                                </ConfirmarAcao>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modo === 'gestao' && linhasEquipa.length > 0 && (
        <>
          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">
            Equipa em {MESES[mes - 1].toLowerCase()} de {ano}
          </h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-2 font-semibold">Instrutor</th>
                  <th className="px-4 py-2 text-right font-semibold">Feitas</th>
                  <th className="px-4 py-2 text-right font-semibold">Do mês</th>
                  <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-2 text-right font-semibold">Dias sem registo</th>
                  <th className="px-4 py-2 font-semibold">Fecho</th>
                </tr>
              </thead>
              <tbody>
                {linhasEquipa.map((l) => (
                  <tr key={l.id} className="border-b border-border-subtle/60 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={link({ pessoa: l.id, dia: undefined })} className="font-semibold text-foreground underline">
                        {l.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatarHoras(l.realizadas)}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted">{formatarHoras(l.esperadas)}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${l.saldo > 0 ? 'text-emerald-700' : l.saldo < 0 ? 'text-red-700' : ''}`}>
                      {formatarHoras(l.saldo, true)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${l.semRegisto ? 'font-semibold text-amber-700' : 'text-muted'}`}>{l.semRegisto}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${COR_FECHO[l.fecho?.estado ?? 'Rascunho']}`}>
                        {l.fecho?.estado === 'Submetido' ? 'Aguarda aprovação' : l.fecho?.estado === 'Aprovado' ? 'Aprovado' : 'Em aberto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Numero({ label, valor, cor, nota }: { label: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-xl font-bold ${cor ?? 'text-foreground'}`}>{valor}</p>
      {nota && <p className="text-xs text-muted">{nota}</p>}
    </div>
  )
}
