import Link from '@/components/LinkRapido'
import { Barra, BarraEspaco, BarraOpcoes, BarraPeriodo, BarraSeparador } from '@/components/Barra'
import { Repeat } from 'lucide-react'
import { inicioDaSemana } from '@/lib/data/horarios'
import { DIAS_DA_SEMANA, diaDaSemanaISO, itensDoCalendario, type ItemDoDia, type Tarefa } from '@/lib/data/tarefas'
import ConcluirTarefa from './ConcluirTarefa'
import { AbrirTarefa, EditarComBotaoDireito, MaisNoDia } from './JanelaTarefas'
import { horaCurta, LinhaTarefa, type Contexto } from './partes'

// O calendário das Tarefas, em quatro escalas: dia, semana, mês e ano.
// As atrasadas passam para o topo do dia de hoje (ver itensDoCalendario).
// Cada tarefa aparece no dia do seu prazo (e, se tem data de início,
// nos dias entre o início e o prazo); as rotinas que se repetem mostram
// também as vezes seguintes como "previstas" (a tracejado) — essas
// ainda não existem, nascem quando a anterior é concluída. Em cada dia,
// o que está por fazer fica em cima (pela hora) e o que já foi feito
// desce para o fundo.
// Clicar numa tarefa com o botão direito do rato abre a janela para a
// editar, sem sair do calendário.

export const ESCALAS = [
  { id: 'dia', rotulo: 'Dia' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'ano', rotulo: 'Ano' },
] as const
export type Escala = (typeof ESCALAS)[number]['id']

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIAS_LONGOS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']
const MAX_NO_MES = 4

const UM_DIA = 86_400_000
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const iso = (valor: number) => new Date(valor).toISOString().slice(0, 10)
const somar = (data: string, dias: number) => iso(ms(data) + dias * UM_DIA)
const dia = (data: string) => Number(data.slice(8, 10))
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()
const pad = (n: number) => String(n).padStart(2, '0')

function mudarMes(data: string, n: number): string {
  const [ano, mes] = data.split('-').map(Number)
  const total = ano * 12 + (mes - 1) + n
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${novoAno}-${pad(novoMes)}-${pad(Math.min(dia(data), ultimoDiaDoMes(novoAno, novoMes)))}`
}

// O intervalo que cada escala mostra, e as datas para "anterior"/"seguinte".
function intervalo(escala: Escala, data: string) {
  const [ano, mes] = data.split('-').map(Number)
  if (escala === 'dia')
    return {
      de: data,
      ate: data,
      antes: somar(data, -1),
      depois: somar(data, 1),
    }
  if (escala === 'semana') {
    const de = inicioDaSemana(data)
    return {
      de,
      ate: somar(de, 6),
      antes: somar(data, -7),
      depois: somar(data, 7),
    }
  }
  if (escala === 'mes') {
    return {
      de: `${ano}-${pad(mes)}-01`,
      ate: `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`,
      antes: mudarMes(data, -1),
      depois: mudarMes(data, 1),
    }
  }
  return {
    de: `${ano}-01-01`,
    ate: `${ano}-12-31`,
    antes: mudarMes(data, -12),
    depois: mudarMes(data, 12),
  }
}

function titulo(escala: Escala, data: string, de: string, ate: string): string {
  const [ano, mes] = data.split('-').map(Number)
  if (escala === 'dia') return `${DIAS_LONGOS[diaDaSemanaISO(data) - 1]}, ${dia(data)} de ${MESES[mes - 1]} de ${ano}`
  if (escala === 'semana') {
    const mesDe = MESES[Number(de.slice(5, 7)) - 1]
    const mesAte = MESES[Number(ate.slice(5, 7)) - 1]
    return mesDe === mesAte
      ? `${dia(de)} a ${dia(ate)} de ${mesAte} de ${ate.slice(0, 4)}`
      : `${dia(de)} de ${mesDe} a ${dia(ate)} de ${mesAte} de ${ate.slice(0, 4)}`
  }
  if (escala === 'mes') return `${MESES[mes - 1]} de ${ano}`
  return String(ano)
}

type Item = ItemDoDia<Tarefa>
const chave = (i: Item) => `${i.tarefa.id}-${i.prevista ? 'p' : i.decorre ? 'd' : 'r'}`

// Cor de uma tarefa no calendário: vermelho se o prazo já passou, âmbar
// se é para hoje; as previstas ficam a tracejado e as feitas apagadas.
function estiloItem({ tarefa: t, prevista, decorre, atrasada }: Item, data: string, hoje: string): string {
  if (prevista) return 'border border-dashed border-border-strong text-muted'
  if (atrasada) return 'bg-red-500/15 text-red-800 dark:text-red-200'
  if (decorre) return 'bg-foreground/[.04] text-muted'
  if (t.estado === 'feito') return 'bg-foreground/[.05] text-muted line-through'
  if (data < hoje) return 'bg-red-500/15 text-red-800 dark:text-red-200'
  if (data === hoje) return 'bg-amber-500/20 text-amber-900 dark:text-amber-100'
  return 'bg-foreground/[.07] text-foreground'
}

// Intensidade de um dia na vista do ano: um só tom, mais escuro = mais
// tarefas (0, 1–2, 3–5, 6 ou mais).
function tomDoDia(n: number): string {
  if (n === 0) return 'bg-foreground/[.04]'
  if (n <= 2) return 'bg-[color-mix(in_srgb,var(--viz-serie)_30%,transparent)]'
  if (n <= 5) return 'bg-[color-mix(in_srgb,var(--viz-serie)_60%,transparent)]'
  return 'bg-[var(--viz-serie)]'
}

function CartaoDaSemana({ item, data, ctx }: { item: Item; data: string; ctx: Contexto }) {
  const t = item.tarefa
  const quem =
    t.estado === 'feito'
      ? t.feita_por
        ? `feita por ${ctx.nomePessoa.get(t.feita_por)?.split(' ')[0] ?? '—'}`
        : null
      : t.responsavel_id
        ? ctx.nomePessoa.get(t.responsavel_id)?.split(' ')[0]
        : null
  return (
    <EditarComBotaoDireito
      id={t.id}
      title="Botão direito do rato: editar"
      className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs ${estiloItem(item, data, ctx.hoje)}`}
    >
      {!item.prevista && !item.decorre && t.estado !== 'feito' && (
        <span className="mt-px">
          <ConcluirTarefa id={t.id} titulo={t.titulo} voltar={ctx.voltar} feita={false} pessoas={ctx.pessoas} euId={ctx.euId} variante="mini" />
        </span>
      )}
      {item.prevista && <Repeat className="mt-0.5 h-3 w-3 shrink-0" />}
      <span className="min-w-0 flex-1">
        {t.hora && <span className="mr-1 font-mono text-[10px] opacity-80">{horaCurta(t.hora)}</span>}
        {item.prevista ? (
          <span className="font-medium">{t.titulo}</span>
        ) : (
          <AbrirTarefa id={t.id} className="font-semibold hover:underline">
            {t.titulo}
          </AbrirTarefa>
        )}
        {item.atrasada && (
          <span className="block text-[10px] font-medium uppercase tracking-wide opacity-80">
            atrasada desde {t.prazo!.slice(8, 10)}/{t.prazo!.slice(5, 7)}
          </span>
        )}
        {item.decorre && (
          <span className="block opacity-70">
            até {t.prazo!.slice(8, 10)}/{t.prazo!.slice(5, 7)}
          </span>
        )}
        {quem && <span className="block opacity-70">{quem}</span>}
      </span>
    </EditarComBotaoDireito>
  )
}

export default function CalendarioTarefas({
  tarefas,
  escala,
  data,
  comRotinas,
  ctx,
  link,
}: {
  tarefas: Tarefa[]
  escala: Escala
  data: string
  comRotinas: boolean
  ctx: Contexto
  // Constrói um endereço desta página mudando só o que se indica.
  link: (extra: { cal?: string; data?: string; rotinas?: string }) => string
}) {
  const { hoje } = ctx
  const { de, ate, antes, depois } = intervalo(escala, data)
  const porDia = itensDoCalendario(tarefas, de, ate, hoje, comRotinas)
  // Na vista do ano conta-se cada tarefa uma vez (no dia do prazo).
  const quantas = (d: string) => (porDia.get(d) ?? []).filter((i) => !i.decorre).length
  const semPrazo = tarefas.filter((t) => !t.prazo && t.estado !== 'feito').length
  const ano = Number(data.slice(0, 4))

  return (
    <div className="viz-tarefas mt-4">
      <Barra rotulo="Calendário">
        <BarraOpcoes opcoes={ESCALAS.map((e) => ({ href: link({ cal: e.id === 'semana' ? undefined : e.id }), rotulo: e.rotulo, ativo: e.id === escala }))} />
        <BarraSeparador />
        <BarraPeriodo
          className="max-sm:order-last max-sm:w-full"
          anterior={link({ data: antes })}
          seguinte={link({ data: depois })}
          titulo={<span className="inline-block text-center first-letter:uppercase sm:min-w-44">{titulo(escala, data, de, ate)}</span>}
          hoje={link({ data: undefined })}
          noPeriodoDeHoje={hoje >= de && hoje <= ate}
        />
        <BarraEspaco />
        <Link href={link({ rotinas: comRotinas ? '0' : undefined })} aria-pressed={comRotinas} title={comRotinas ? 'Esconder as que se repetem' : 'Mostrar as que se repetem'} className="barra-item">
          <Repeat className="h-4 w-4" /> Repetidas
        </Link>
      </Barra>
      <p className="mt-2 text-xs text-muted">
        Para editar uma tarefa, clica nela com o botão direito do rato (no telemóvel, toca e mantém): abre numa janela, sem sair daqui. As atrasadas aparecem no topo do dia de hoje.
        {semPrazo > 0 &&
          ` ${semPrazo} tarefa${semPrazo === 1 ? '' : 's'} sem prazo não aparece${semPrazo === 1 ? '' : 'm'} no calendário — ${semPrazo === 1 ? 'está' : 'estão'} na Lista, em “Para ir fazendo”.`}
      </p>

      {/* Dia */}
      {escala === 'dia' &&
        (() => {
          const itens = porDia.get(data) ?? []
          const reais = itens.filter((i) => !i.prevista && !i.decorre)
          const aDecorrer = itens.filter((i) => i.decorre)
          const previstas = itens.filter((i) => i.prevista)
          return (
            <div className="mt-4 flex flex-col gap-4">
              {itens.length === 0 && (
                <p className="rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">Nada marcado para este dia.</p>
              )}
              {reais.length > 0 && (
                <ul className="divide-y divide-border-subtle/60 rounded-xl border border-border-subtle bg-surface">
                  {reais.map((i) => (
                    <LinhaTarefa key={i.tarefa.id} t={i.tarefa} ctx={ctx} />
                  ))}
                </ul>
              )}
              {aDecorrer.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">A decorrer ({aDecorrer.length})</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {aDecorrer.map((i) => (
                      <CartaoDaSemana key={i.tarefa.id} item={i} data={data} ctx={ctx} />
                    ))}
                  </ul>
                </section>
              )}
              {previstas.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Previstas — rotinas que se repetem ({previstas.length})</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {previstas.map((i) => (
                      <CartaoDaSemana key={i.tarefa.id} item={i} data={data} ctx={ctx} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )
        })()}

      {/* Semana */}
      {escala === 'semana' && (
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => somar(de, i)).map((d) => {
            const itens = porDia.get(d) ?? []
            return (
              <section key={d} className={`rounded-xl border bg-surface p-2 ${d === hoje ? 'border-brand' : 'border-border-subtle'}`}>
                <div className="flex items-center gap-1 px-1 pb-1.5">
                  <Link href={link({ cal: 'dia', data: d })} className="flex flex-1 items-baseline justify-between gap-1 hover:underline">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">{DIAS_DA_SEMANA[diaDaSemanaISO(d) - 1].curto}</span>
                    <span className={`text-sm font-bold ${d === hoje ? 'rounded-full bg-brand px-2 text-black' : 'text-foreground'}`}>{dia(d)}</span>
                  </Link>
                  <MaisNoDia data={d} />
                </div>
                {itens.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted">—</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {itens.map((i) => (
                      <CartaoDaSemana key={chave(i)} item={i} data={d} ctx={ctx} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Mês */}
      {escala === 'mes' && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border-subtle bg-surface">
          <div className="grid grid-cols-7 border-b border-border-subtle text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
            {DIAS_DA_SEMANA.map((d) => (
              <div key={d.valor} className="px-1 py-2">
                {d.curto}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: diaDaSemanaISO(de) - 1 }, (_, i) => (
              <div key={`v${i}`} className="min-h-24 border-b border-r border-border-subtle/60 bg-foreground/[.02]" />
            ))}
            {Array.from({ length: dia(ate) }, (_, i) => somar(de, i)).map((d) => {
              const itens = porDia.get(d) ?? []
              return (
                <Link
                  key={d}
                  href={link({ cal: 'dia', data: d })}
                  className="flex min-h-24 flex-col gap-0.5 border-b border-r border-border-subtle/60 p-1 transition-colors hover:bg-brand/[.06]"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center self-end rounded-full text-[11px] font-bold ${d === hoje ? 'bg-brand text-black' : 'text-muted'}`}
                  >
                    {dia(d)}
                  </span>
                  {itens.slice(0, MAX_NO_MES).map((i) => (
                    <EditarComBotaoDireito
                      key={chave(i)}
                      como="span"
                      id={i.tarefa.id}
                      title={`${i.tarefa.titulo}${i.prevista ? ' (prevista)' : ''} — botão direito: editar`}
                      className={`truncate rounded px-1 py-px text-[10px] font-medium leading-tight ${estiloItem(i, d, hoje)}`}
                    >
                      {i.tarefa.hora && `${horaCurta(i.tarefa.hora)} `}
                      {i.tarefa.titulo}
                    </EditarComBotaoDireito>
                  ))}
                  {itens.length > MAX_NO_MES && <span className="px-1 text-[10px] text-muted">+{itens.length - MAX_NO_MES}</span>}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Ano */}
      {escala === 'ano' && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MESES.map((nome, m) => {
              const primeiro = `${ano}-${pad(m + 1)}-01`
              const dias = ultimoDiaDoMes(ano, m + 1)
              const totalDoMes = Array.from({ length: dias }, (_, i) => quantas(somar(primeiro, i))).reduce((a, b) => a + b, 0)
              return (
                <section key={nome} className="rounded-xl border border-border-subtle bg-surface p-3">
                  <Link href={link({ cal: 'mes', data: primeiro })} className="flex items-baseline justify-between gap-2 hover:underline">
                    <span className="text-sm font-bold text-foreground first-letter:uppercase">{nome}</span>
                    <span className="text-xs text-muted">{totalDoMes}</span>
                  </Link>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {Array.from({ length: diaDaSemanaISO(primeiro) - 1 }, (_, i) => (
                      <span key={`v${i}`} />
                    ))}
                    {Array.from({ length: dias }, (_, i) => somar(primeiro, i)).map((d) => {
                      const n = quantas(d)
                      return (
                        <Link
                          key={d}
                          href={link({ cal: 'dia', data: d })}
                          title={`${dia(d)} de ${nome}: ${n === 0 ? 'sem tarefas' : n === 1 ? '1 tarefa' : `${n} tarefas`}`}
                          aria-label={`${dia(d)} de ${nome}: ${n} tarefas`}
                          className={`flex aspect-square items-center justify-center rounded text-[10px] font-medium text-foreground ${tomDoDia(n)} ${
                            d === hoje ? 'ring-2 ring-brand' : ''
                          }`}
                        >
                          {dia(d)}
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            Tarefas por dia:
            {[
              [0, 'nenhuma'],
              [1, '1–2'],
              [3, '3–5'],
              [6, '6 ou mais'],
            ].map(([n, rotulo]) => (
              <span key={rotulo} className="inline-flex items-center gap-1">
                <span className={`h-3 w-3 rounded ${tomDoDia(n as number)}`} /> {rotulo}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  )
}
