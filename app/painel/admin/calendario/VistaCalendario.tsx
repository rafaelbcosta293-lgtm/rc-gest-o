import Link from '@/components/LinkRapido'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { dataNoMes, somarMesesISO, ROTULO_ESTADO } from '@/lib/data/despesas'
import {
  DIAS_LEMBRETE_ATRASADO,
  porTratar,
  REPETICOES,
  somarDiasISO,
  TIPOS_LEMBRETE,
  type ItemCalendario,
} from '@/lib/data/lembretes'
import { marcarDespesaPaga } from '../despesas/actions'
import { botaoCls, botaoSecCls, dataPt, eur, inputCls, nomeMes } from '../despesas/partes'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { alternarLembreteFeito, criarLembrete, eliminarLembrete, pararLembrete } from './actions'

const ROTA = '/painel/admin/calendario'
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MAX_POR_DIA = 4

const MENSAGENS_OK: Record<string, string> = {
  criado: 'Lembrete criado.',
  eliminado: 'Lembrete eliminado.',
  parado: 'O lembrete deixa de se repetir a partir desse dia.',
  paga: 'Despesa marcada como paga.',
  'por-pagar': 'Despesa marcada como por pagar.',
}

// Cor de cada etiqueta no calendário: verde = tratado, âmbar = por pagar,
// vermelho = em atraso, tracejado = despesa recorrente ainda por lançar;
// os lembretes têm cor por tipo e ficam apagados depois de feitos.
function estiloItem(item: ItemCalendario, hoje: string): string {
  if (item.origem === 'despesa') {
    if (item.estado === 'paga') return 'bg-emerald-500/15 text-emerald-300'
    if (item.estado === 'em_atraso') return 'bg-red-500/25 text-red-200'
    return 'bg-amber-500/20 text-amber-200'
  }
  if (item.origem === 'prevista') return 'border border-dashed border-border-strong text-muted'
  if (item.feito) return 'bg-foreground/[.06] text-muted line-through'
  if (item.data < hoje) return 'bg-red-500/25 text-red-200'
  if (item.tipo === 'pagamento') return 'bg-brand/25 text-brand'
  if (item.tipo === 'outro') return 'bg-violet-500/20 text-violet-200'
  return 'bg-cyan-500/20 text-cyan-200'
}

function descricaoItem(item: ItemCalendario): string {
  if (item.origem === 'despesa') return `Despesa · ${ROTULO_ESTADO[item.estado]}`
  if (item.origem === 'prevista') return 'Despesa recorrente · ainda por lançar'
  const tipo = TIPOS_LEMBRETE.find((t) => t.valor === item.tipo)?.rotulo ?? 'Lembrete'
  return `${tipo}${item.repete ? ' · repete-se' : ''}${item.feito ? ' · feito' : ''}`
}

function Acoes({ item, voltar }: { item: ItemCalendario; voltar: string }) {
  if (item.origem === 'despesa') {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <form action={marcarDespesaPaga}>
          <input type="hidden" name="id" value={item.despesaId} />
          <input type="hidden" name="pago" value={item.estado === 'paga' ? 'false' : 'true'} />
          <input type="hidden" name="voltar" value={voltar} />
          <SubmitButton pendingText="…" className={botaoSecCls}>
            {item.estado === 'paga' ? 'Desfazer' : 'Paga'}
          </SubmitButton>
        </form>
        <Link href={`/painel/admin/despesas?mes=${item.data.slice(0, 7)}`} className="text-xs text-muted underline hover:text-foreground">
          Abrir
        </Link>
      </div>
    )
  }
  if (item.origem === 'prevista') {
    return (
      <Link href="/painel/admin/despesas/recorrentes" className="shrink-0 text-xs text-muted underline hover:text-foreground">
        Recorrentes
      </Link>
    )
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      <form action={alternarLembreteFeito}>
        <input type="hidden" name="lembrete_id" value={item.lembreteId} />
        <input type="hidden" name="data" value={item.data} />
        <input type="hidden" name="feito" value={item.feito ? 'false' : 'true'} />
        <input type="hidden" name="voltar" value={voltar} />
        <SubmitButton pendingText="…" className={botaoSecCls}>
          {item.feito ? 'Desfazer' : 'Feito'}
        </SubmitButton>
      </form>
      {item.repete && (
        <ConfirmarAcao
          action={pararLembrete}
          confirmacao={`Parar "${item.titulo}" a partir de ${dataPt(item.data)}? Deixa de aparecer deste dia em diante; o que ficou para trás mantém-se.`}
        >
          <input type="hidden" name="lembrete_id" value={item.lembreteId} />
          <input type="hidden" name="data" value={item.data} />
          <input type="hidden" name="voltar" value={voltar} />
          <button type="submit" className="text-xs text-muted underline hover:text-foreground">
            Parar
          </button>
        </ConfirmarAcao>
      )}
      <ConfirmarAcao
        action={eliminarLembrete}
        confirmacao={
          item.repete
            ? `Eliminar "${item.titulo}" de vez? Desaparece de todos os meses, incluindo os que já passaram.`
            : `Eliminar "${item.titulo}"?`
        }
      >
        <input type="hidden" name="lembrete_id" value={item.lembreteId} />
        <input type="hidden" name="voltar" value={voltar} />
        <button type="submit" className="text-xs text-red-400 underline hover:text-red-300">
          Eliminar
        </button>
      </ConfirmarAcao>
    </div>
  )
}

function Linha({
  item,
  hoje,
  voltar,
  nomeEstudio,
  comData = false,
}: {
  item: ItemCalendario
  hoje: string
  voltar: string
  nomeEstudio: Map<number, string>
  comData?: boolean
}) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${estiloItem(item, hoje).split(' ')[0]}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-foreground ${item.origem === 'lembrete' && item.feito ? 'line-through opacity-60' : ''}`}>
          {comData && <span className="mr-1.5 font-mono text-xs text-muted">{dataPt(item.data).slice(0, 5)}</span>}
          {item.titulo}
          {item.valor != null && item.valor > 0 && <span className="ml-1.5 font-mono text-xs text-muted">{eur(item.valor)}</span>}
        </p>
        <p className="text-xs text-muted">
          {descricaoItem(item)}
          {item.estudioId != null && nomeEstudio.get(item.estudioId) ? ` · ${nomeEstudio.get(item.estudioId)}` : ''}
        </p>
        {item.origem === 'lembrete' && item.notas && <p className="mt-0.5 text-xs text-muted">{item.notas}</p>}
      </div>
      <Acoes item={item} voltar={voltar} />
    </li>
  )
}

// O desenho do calendário, separado da página para receber os itens já
// prontos (a página trata da sessão e de ir buscar os dados).
export default function VistaCalendario({
  itens,
  estudios,
  mes,
  diaSel,
  hoje,
  ok,
  error,
}: {
  itens: ItemCalendario[]
  estudios: { id: number; nome: string }[]
  mes: string
  diaSel: string
  hoje: string
  ok?: string
  error?: string
}) {
  const inicioMes = `${mes}-01`
  const fimMes = dataNoMes(mes, 31)
  const deAtrasados = somarDiasISO(hoje, -DIAS_LEMBRETE_ATRASADO)
  const ateProximos = somarDiasISO(hoje, 7)
  const nomeEstudio = new Map(estudios.map((e) => [e.id, e.nome]))

  const porDia = new Map<string, ItemCalendario[]>()
  for (const item of itens) {
    if (item.data < inicioMes || item.data > fimMes) continue
    porDia.set(item.data, [...(porDia.get(item.data) ?? []), item])
  }
  const doDia = porDia.get(diaSel) ?? []
  const atrasados = itens.filter((i) => i.origem !== 'prevista' && i.data >= deAtrasados && i.data <= hoje && porTratar(i))
  const proximos = itens.filter((i) => i.data > hoje && i.data <= ateProximos && porTratar(i))

  // Grelha do mês, a começar na segunda-feira.
  const diasNoMes = Number(fimMes.slice(8, 10))
  const diaSemanaDoPrimeiro = (new Date(`${inicioMes}T00:00:00Z`).getUTCDay() + 6) % 7
  const celulas: (string | null)[] = [
    ...Array<null>(diaSemanaDoPrimeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  const link = (m: string, dia?: string) => `${ROTA}?mes=${m}${dia ? `&dia=${dia}` : ''}`
  const voltar = link(mes, diaSel)
  const totalMes = itens
    .filter((i) => i.data >= inicioMes && i.data <= fimMes && i.origem !== 'lembrete')
    .reduce((s, i) => s + (i.valor ?? 0), 0)


  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Calendário</h1>
      <p className="mt-1 text-sm text-muted">
        Despesas, pagamentos e tarefas por dia. As despesas vêm sozinhas das Despesas; os lembretes escreves tu e podem repetir-se.
      </p>

      {ok && MENSAGENS_OK[ok] && (
        <p className="mt-4 rounded-md bg-teal-950 px-3 py-2 text-sm text-teal-300">{MENSAGENS_OK[ok]}</p>
      )}
      {error && <p className="mt-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* Mês */}
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={link(somarMesesISO(mes, -1))} className={botaoSecCls} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h2 className="min-w-44 text-center text-lg font-bold text-foreground first-letter:uppercase">{nomeMes(mes)}</h2>
            <Link href={link(somarMesesISO(mes, 1))} className={botaoSecCls} aria-label="Mês seguinte">
              <ChevronRight className="h-4 w-4" />
            </Link>
            {mes !== hoje.slice(0, 7) && (
              <Link href={ROTA} className={botaoSecCls}>
                Hoje
              </Link>
            )}
            <span className="ml-auto text-xs text-muted">Despesas do mês: {eur(totalMes)}</span>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-border-subtle bg-surface">
            <div className="grid grid-cols-7 border-b border-border-subtle text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
              {DIAS.map((d) => (
                <div key={d} className="px-1 py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celulas.map((dia, i) => {
                if (!dia) return <div key={`v${i}`} className="min-h-24 border-b border-r border-border-subtle/60 bg-background/40" />
                const lista = porDia.get(dia) ?? []
                const selecionado = dia === diaSel
                return (
                  <Link
                    key={dia}
                    href={`${link(mes, dia)}#dia`}
                    scroll={false}
                    className={`flex min-h-24 flex-col gap-0.5 border-b border-r border-border-subtle/60 p-1 text-left transition-colors hover:bg-brand/[.06] ${
                      selecionado ? 'bg-brand/[.10] ring-1 ring-inset ring-brand' : ''
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center self-end rounded-full text-[11px] font-bold ${
                        dia === hoje ? 'bg-brand text-black' : 'text-muted'
                      }`}
                    >
                      {Number(dia.slice(8, 10))}
                    </span>
                    {lista.slice(0, MAX_POR_DIA).map((item) => (
                      <span
                        key={item.chave}
                        title={`${item.titulo}${item.valor ? ` · ${eur(item.valor)}` : ''} · ${descricaoItem(item)}`}
                        className={`flex items-center gap-1 truncate rounded px-1 py-px text-[10px] font-medium leading-tight ${estiloItem(item, hoje)}`}
                      >
                        {((item.origem === 'despesa' && item.estado === 'paga') || (item.origem === 'lembrete' && item.feito)) && (
                          <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
                        )}
                        {item.origem === 'lembrete' && item.repete && !item.feito && <Repeat className="h-2.5 w-2.5 shrink-0" />}
                        <span className="truncate">{item.titulo}</span>
                      </span>
                    ))}
                    {lista.length > MAX_POR_DIA && <span className="px-1 text-[10px] text-muted">+{lista.length - MAX_POR_DIA}</span>}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500/60" /> Despesa por pagar</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500/60" /> Paga</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500/70" /> Em atraso</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-dashed border-border-strong" /> Recorrente por lançar</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-500/60" /> Tarefa</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand/70" /> Pagamento</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500/60" /> Outro</span>
          </div>
        </section>

        {/* Dia escolhido + por tratar */}
        <aside className="flex flex-col gap-5">
          <section id="dia" className="scroll-mt-24 rounded-xl border border-border-subtle bg-surface p-4">
            <h2 className="text-lg font-bold text-foreground">
              {dataPt(diaSel)}
              {diaSel === hoje && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-bold text-black">Hoje</span>}
            </h2>
            {doDia.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nada marcado para este dia.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border-subtle/60">
                {doDia.map((item) => (
                  <Linha key={item.chave} item={item} hoje={hoje} voltar={voltar} nomeEstudio={nomeEstudio} />
                ))}
              </ul>
            )}

            <form action={criarLembrete} className="mt-4 flex flex-col gap-2.5 border-t border-border-subtle pt-4">
              <input type="hidden" name="voltar" value={voltar} />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Novo lembrete</p>
              <input name="titulo" required placeholder="Ex.: Entregar IVA, pagar seguro, ligar ao contabilista" className={inputCls} />
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Dia
                  <input type="date" name="data" required defaultValue={diaSel} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Tipo
                  <select name="tipo" defaultValue="tarefa" className={inputCls}>
                    {TIPOS_LEMBRETE.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Repetir
                  <select name="periodicidade" defaultValue="unica" className={inputCls}>
                    {REPETICOES.map((r) => (
                      <option key={r.valor} value={r.valor}>
                        {r.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Repetir até (opcional)
                  <input type="date" name="fim" className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Valor € (opcional)
                  <input name="valor" inputMode="decimal" placeholder="0,00" className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Estúdio (opcional)
                  <select name="estudio_id" defaultValue="" className={inputCls}>
                    <option value="">Geral</option>
                    {estudios.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <textarea name="notas" rows={2} placeholder="Notas (opcional)" className={inputCls} />
              <SubmitButton pendingText="A guardar…" className={`self-start ${botaoCls}`}>
                Adicionar lembrete
              </SubmitButton>
            </form>
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-red-300">Por tratar ({atrasados.length})</h2>
            {atrasados.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nada em atraso nem para hoje.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border-subtle/60">
                {atrasados.map((item) => (
                  <Linha key={item.chave} item={item} hoje={hoje} voltar={voltar} nomeEstudio={nomeEstudio} comData />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Próximos 7 dias ({proximos.length})</h2>
            {proximos.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nada nos próximos 7 dias.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border-subtle/60">
                {proximos.map((item) => (
                  <Linha key={item.chave} item={item} hoje={hoje} voltar={voltar} nomeEstudio={nomeEstudio} comData />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
