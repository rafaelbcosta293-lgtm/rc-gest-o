import BotaoPedido from '@/components/BotaoPedido'
import { contaAtual, pedidosEmCurso, type Treino } from '@/lib/dados'
import { dataCurta, diaPorExtenso, hojeLisboa, instanteAtual, jaPassou } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { ultimoPedidoPorAlvo } from '@/lib/vistas'

export const metadata = { title: 'Treinos · RC Private Fitness Studio' }

const ESTADO: Record<string, { texto: string; classe: string }> = {
  Agendado: { texto: 'Agendado', classe: 'bg-sky-100 text-sky-800' },
  Concluído: { texto: 'Realizado', classe: 'bg-emerald-100 text-emerald-800' },
  Cancelado: { texto: 'Desmarcado', classe: 'bg-zinc-100 text-zinc-600' },
}

export default async function TreinosPage() {
  await contaAtual()
  const agora = instanteAtual()
  const hoje = hojeLisboa(agora)
  const supabase = await criarSupabase()
  const [{ data }, pedidos] = await Promise.all([
    supabase.from('treinos').select('id, data, hora_inicio, duracao_min, servico, instrutor, estado').order('data').order('hora_inicio'),
    pedidosEmCurso(),
  ])
  const treinos = (data ?? []) as Treino[]
  const pedidoDe = ultimoPedidoPorAlvo(pedidos)
  const proximos = treinos.filter((t) => !jaPassou(t.data, t.hora_inicio, agora) && t.estado !== 'Cancelado')
  const anteriores = treinos.filter((t) => jaPassou(t.data, t.hora_inicio, agora) || t.estado === 'Cancelado').reverse().slice(0, 30)

  return (
    <div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Os meus treinos</h1>
      <p className="mt-1 text-sm text-muted">Treinos personalizados e avaliações marcados pela equipa.</p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Próximos</h2>
      {proximos.length === 0 && <p className="mt-2 rounded-2xl bg-white p-5 text-sm text-muted">Sem treinos marcados. Fale com o seu treinador para marcar.</p>}
      <ul className="mt-2 space-y-2">
        {proximos.map((t) => {
          const p = pedidoDe.get(t.id)
          const emCurso = p && (p.estado === 'pendente' || p.estado === 'em_analise')
          return (
            <li key={t.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border">
              <p className="text-sm font-semibold text-muted">{diaPorExtenso(t.data, hoje)}</p>
              <p className="text-lg font-bold tabular-nums">
                {t.hora_inicio.slice(0, 5)} <span className="text-base font-semibold">· {t.servico ?? 'Treino'}</span>
              </p>
              <p className="text-sm text-muted">
                {t.duracao_min} min{t.instrutor ? ` · com ${t.instrutor}` : ''}
              </p>
              <div className="mt-3">
                {emCurso ? (
                  <p className="text-sm text-violet-700">Pedido de desmarcação enviado — a equipa vai confirmar.</p>
                ) : (
                  <>
                    <BotaoPedido tipo="desmarcar_treino" alvo={t.id} rotulo="Pedir para desmarcar" variante="secundario" comNota />
                    {p?.estado === 'recusado' && p.resposta && <p className="mt-2 text-xs text-red-700">{p.resposta}</p>}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {anteriores.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted">Anteriores</h2>
          <ul className="mt-2 divide-y divide-border rounded-2xl bg-white shadow-sm ring-1 ring-border">
            {anteriores.map((t) => {
              const e = ESTADO[t.estado] ?? ESTADO.Concluído
              const estado = t.estado === 'Agendado' ? ESTADO.Concluído : e
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="font-semibold tabular-nums">{dataCurta(t.data)}</span> · {t.hora_inicio.slice(0, 5)} · {t.servico ?? 'Treino'}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${estado.classe}`}>{estado.texto}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
