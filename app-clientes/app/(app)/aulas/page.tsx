import { CalendarX2 } from 'lucide-react'
import BotaoPedido from '@/components/BotaoPedido'
import { Etiqueta, TituloPagina, Vazio } from '@/components/ui'
import { contaAtual, pedidosEmCurso, type Aula } from '@/lib/dados'
import { diaDoMes, diaSemanaCurto, hojeLisboa, instanteAtual, quandoAbre, tituloDia } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { estadoAula, ultimoPedidoPorAlvo, vagas } from '@/lib/vistas'

export const metadata = { title: 'Aulas' }

export default async function AulasPage() {
  const conta = await contaAtual()
  const agora = instanteAtual()
  const hoje = hojeLisboa(agora)
  const supabase = await criarSupabase()
  const [{ data: aulasData }, { data: inscricoesData }, pedidos] = await Promise.all([
    supabase
      .from('aulas')
      .select('id, servico, data, hora_inicio, duracao_min, instrutor, lotacao, ocupadas, estado, reserva_abre_em, cancelar_ate')
      .gte('data', hoje)
      .order('data')
      .order('hora_inicio'),
    supabase.from('inscricoes').select('aula_id, estado'),
    pedidosEmCurso(),
  ])
  const inscrito = new Set((inscricoesData ?? []).filter((i) => i.estado !== 'Cancelada').map((i) => i.aula_id as string))
  const pedidoDe = ultimoPedidoPorAlvo(pedidos)
  // Aulas que já começaram hoje só interessam a quem lá está inscrito.
  const aulas = ((aulasData ?? []) as Aula[]).filter((a) => estadoAula(a, inscrito.has(a.id), undefined, agora).tipo !== 'terminada')
  const porDia = new Map<string, Aula[]>()
  for (const a of aulas) porDia.set(a.data, [...(porDia.get(a.data) ?? []), a])
  const dias = [...porDia.keys()]

  return (
    <div>
      <TituloPagina titulo="Aulas de grupo" subtitulo={`${conta.estudio_nome} · pode cancelar até 2 horas antes da aula.`} />

      {aulas.length === 0 ? (
        <div className="mt-6">
          <Vazio Icone={CalendarX2} titulo="Sem aulas nos próximos dias">
            Quando o estúdio abrir novas aulas, aparecem aqui.
          </Vazio>
        </div>
      ) : (
        <>
          {/* Atalho para cada dia — fica preso ao topo enquanto se percorre a lista */}
          {dias.length > 1 && (
            <nav aria-label="Dias" className="sem-barra sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-3 flex gap-2 overflow-x-auto border-b border-border/70 bg-background px-4 pt-1 pb-3">
              {dias.map((d) => {
                const tem = (porDia.get(d) ?? []).some((a) => inscrito.has(a.id) && a.estado === 'Aberta')
                return (
                  <a
                    key={d}
                    href={`#dia-${d}`}
                    className={`relative flex h-14 w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-2xl ring-1 active:scale-95 ${d === hoje ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-surface text-foreground ring-border'}`}
                  >
                    <span className={`text-[0.65rem] leading-none font-semibold tracking-wide uppercase ${d === hoje ? 'text-brand' : 'text-muted'}`}>{d === hoje ? 'hoje' : diaSemanaCurto(d)}</span>
                    <span className="mt-1 text-lg leading-none font-bold tabular-nums">{diaDoMes(d)}</span>
                    {tem && <span aria-label="tem uma aula reservada" className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  </a>
                )
              })}
            </nav>
          )}

          {dias.map((dia) => (
            <section key={dia} id={`dia-${dia}`} className="scroll-mt-36 pt-5">
              <h2 className="mb-2.5 px-1 text-[0.8rem] font-semibold tracking-[0.08em] text-muted uppercase">{tituloDia(dia, hoje)}</h2>
              <ul className="space-y-3">
                {(porDia.get(dia) ?? []).map((a) => {
                  const eu = inscrito.has(a.id)
                  const pedido = pedidoDe.get(a.id)
                  const e = estadoAula(a, eu, pedido, agora)
                  const cancelada = e.tipo === 'cancelada'
                  const recusa = pedido?.estado === 'recusado' && e.tipo !== 'em_curso' && new Date(pedido.criado_em).getTime() > agora.getTime() - 86400_000 ? pedido.resposta : null
                  return (
                    <li
                      key={a.id}
                      className={`rounded-2xl p-4 shadow-card ring-1 ${cancelada ? 'bg-soft/70 ring-border' : eu ? 'bg-surface ring-2 ring-emerald-500/70' : 'bg-surface ring-border'}`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-[3.4rem] shrink-0 ${cancelada ? 'text-muted' : ''}`}>
                          <p className={`text-xl leading-none font-bold tabular-nums ${cancelada ? 'line-through decoration-1' : ''}`}>{a.hora_inicio.slice(0, 5)}</p>
                          <p className="mt-1.5 text-xs text-muted">{a.duracao_min} min</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`leading-tight font-semibold ${cancelada ? 'text-muted' : ''}`}>{a.servico}</p>
                          <p className="mt-1 text-sm text-muted">{a.instrutor ? `com ${a.instrutor}` : 'Instrutor a confirmar'}</p>
                        </div>
                        {cancelada ? (
                          <Etiqueta tom="neutro">Cancelada</Etiqueta>
                        ) : eu ? (
                          <Etiqueta tom="ok">Reservada</Etiqueta>
                        ) : e.tipo === 'cheia' ? (
                          <Etiqueta tom="neutro">Cheia</Etiqueta>
                        ) : e.tipo === 'por_abrir' ? (
                          <Etiqueta tom="neutro">Em breve</Etiqueta>
                        ) : null}
                      </div>

                      {!cancelada && e.tipo !== 'por_abrir' && (
                        <div className="mt-3.5 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft" role="img" aria-label={`${a.ocupadas} de ${a.lotacao} lugares ocupados`}>
                            <div className="h-full rounded-full bg-zinc-900" style={{ width: `${Math.min(100, (a.ocupadas / a.lotacao) * 100)}%` }} />
                          </div>
                          <p className="shrink-0 text-xs font-medium text-muted">{vagas(a)}</p>
                        </div>
                      )}

                      <div className="mt-3.5 empty:hidden">
                        {e.tipo === 'reservar' && <BotaoPedido tipo="inscrever_aula" alvo={a.id} rotulo="Reservar lugar" largo avisoAnterior={recusa} />}
                        {e.tipo === 'cancelar' && (
                          <BotaoPedido
                            tipo="cancelar_aula"
                            alvo={a.id}
                            rotulo="Cancelar reserva"
                            variante="secundario"
                            largo
                            avisoAnterior={recusa}
                            confirmar={{
                              titulo: 'Cancelar a reserva?',
                              texto: `${a.servico}, ${tituloDia(a.data, hoje).toLowerCase()} às ${a.hora_inicio.slice(0, 5)}. O seu lugar fica livre para outra pessoa.`,
                              botao: 'Sim, cancelar reserva',
                            }}
                          />
                        )}
                        {e.tipo === 'em_curso' && <p className="text-sm font-medium text-violet-800">A confirmar com o estúdio…</p>}
                        {e.tipo === 'inscrito' && <p className="text-sm text-muted">Já não é possível cancelar pela app. Se não puder vir, avise a equipa.</p>}
                        {e.tipo === 'por_abrir' && (
                          <p className="text-sm text-muted">
                            As reservas abrem <span className="font-medium text-foreground">{quandoAbre(e.abre, agora)}</span>.
                          </p>
                        )}
                        {e.tipo === 'cheia' && <p className="text-sm text-muted">Se alguém cancelar, o lugar volta a aparecer aqui.</p>}
                        {cancelada && <p className="text-sm text-muted">{eu ? 'Esta aula foi cancelada pelo estúdio. A sua reserva ficou sem efeito.' : 'Aula cancelada pelo estúdio.'}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
