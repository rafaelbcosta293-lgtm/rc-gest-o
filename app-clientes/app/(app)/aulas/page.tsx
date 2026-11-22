import BotaoPedido from '@/components/BotaoPedido'
import { contaAtual, pedidosEmCurso, type Aula } from '@/lib/dados'
import { diaPorExtenso, hojeLisboa, instanteAtual } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { ultimoPedidoPorAlvo, vagas, vistaAula } from '@/lib/vistas'

export const metadata = { title: 'Aulas · RC Private Fitness Studio' }

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
  const aulas = (aulasData ?? []) as Aula[]
  const inscrito = new Set((inscricoesData ?? []).filter((i) => i.estado !== 'Cancelada').map((i) => i.aula_id as string))
  const pedidoDe = ultimoPedidoPorAlvo(pedidos)
  const porDia = new Map<string, Aula[]>()
  for (const a of aulas) porDia.set(a.data, [...(porDia.get(a.data) ?? []), a])

  return (
    <div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Aulas de grupo</h1>
      <p className="mt-1 text-sm text-muted">{conta.estudio_nome} · reserve o seu lugar. Pode cancelar até 2 horas antes.</p>

      {aulas.length === 0 && <p className="mt-8 rounded-2xl bg-white p-5 text-sm text-muted">Não há aulas marcadas para os próximos dias.</p>}

      {[...porDia.entries()].map(([dia, lista]) => (
        <section key={dia} className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{diaPorExtenso(dia, hoje)}</h2>
          <ul className="mt-2 space-y-2">
            {lista.map((a) => {
              const eu = inscrito.has(a.id)
              const v = vistaAula(a, eu, pedidoDe.get(a.id), agora)
              const ultimo = pedidoDe.get(a.id)
              return (
                <li key={a.id} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${eu ? 'ring-emerald-300' : 'ring-border'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold tabular-nums">
                        {a.hora_inicio.slice(0, 5)} <span className="text-base font-semibold">· {a.servico}</span>
                      </p>
                      <p className="text-sm text-muted">
                        {a.duracao_min} min{a.instrutor ? ` · ${a.instrutor}` : ''} · {vagas(a)}
                      </p>
                    </div>
                    {eu && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Inscrito</span>}
                  </div>
                  <div className="mt-3">
                    {v.acao === 'reservar' && <BotaoPedido tipo="inscrever_aula" alvo={a.id} rotulo="Reservar lugar" />}
                    {v.acao === 'cancelar' && (
                      <BotaoPedido tipo="cancelar_aula" alvo={a.id} rotulo="Cancelar inscrição" variante="secundario" confirmar="Cancelar a inscrição nesta aula?" />
                    )}
                    {v.acao === 'em_curso' && <p className="text-sm text-muted">A confirmar com o estúdio…</p>}
                    {v.acao === 'nenhuma' && (
                      <p className={`text-sm ${v.tom === 'aviso' ? 'text-amber-700' : v.tom === 'ok' ? 'text-emerald-700' : 'text-muted'}`}>{v.texto}</p>
                    )}
                    {ultimo?.estado === 'recusado' && v.acao !== 'em_curso' && ultimo.resposta && (
                      <p className="mt-2 text-xs text-red-700">Último pedido: {ultimo.resposta}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
