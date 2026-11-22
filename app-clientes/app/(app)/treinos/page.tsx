import { CalendarClock, CalendarX2 } from 'lucide-react'
import BotaoPedido from '@/components/BotaoPedido'
import { BlocoData, Cartao, Etiqueta, Seccao, TituloPagina, Vazio, type Tom } from '@/components/ui'
import { contaAtual, pedidosEmCurso, type Treino } from '@/lib/dados'
import { dataCurta, diaPorExtenso, hojeLisboa, instanteAtual, jaPassou } from '@/lib/datas'
import { criarSupabase } from '@/lib/supabase'
import { ultimoPedidoPorAlvo } from '@/lib/vistas'

export const metadata = { title: 'Treinos' }

const ESTADO: Record<string, { texto: string; tom: Tom }> = {
  Concluído: { texto: 'Realizado', tom: 'ok' },
  Cancelado: { texto: 'Desmarcado', tom: 'neutro' },
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
  const anteriores = treinos
    .filter((t) => jaPassou(t.data, t.hora_inicio, agora) || t.estado === 'Cancelado')
    .reverse()
    .slice(0, 20)

  return (
    <div>
      <TituloPagina titulo="Treinos" subtitulo="Para marcar ou mudar de horário, fale com o seu treinador." />

      <Seccao titulo={proximos.length > 0 ? `Próximos · ${proximos.length}` : 'Próximos'}>
        {proximos.length === 0 ? (
          <Vazio Icone={CalendarClock} titulo="Sem treinos marcados">
            Combine o próximo treino com o seu treinador.
          </Vazio>
        ) : (
          <ul className="space-y-3">
            {proximos.map((t) => {
              const p = pedidoDe.get(t.id)
              const emCurso = p && (p.estado === 'pendente' || p.estado === 'em_analise')
              const recusa = p?.estado === 'recusado' ? p.resposta : null
              return (
                <li key={t.id}>
                  <Cartao className="px-4 pt-4 pb-2.5">
                    <div className="flex items-start gap-3.5">
                      <BlocoData dia={t.data} destaque={t.data === hoje} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted first-letter:uppercase">
                          {diaPorExtenso(t.data, hoje)} · <span className="font-semibold text-foreground tabular-nums">{t.hora_inicio.slice(0, 5)}</span>
                        </p>
                        <p className="mt-0.5 leading-tight font-semibold">{t.servico ?? 'Treino'}</p>
                        <p className="mt-1 text-sm text-muted">
                          {t.duracao_min} min{t.instrutor ? ` · com ${t.instrutor}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border pt-1.5">
                      {emCurso ? (
                        <div className="flex items-center justify-between gap-3 pt-2 pb-0.5">
                          <p className="text-sm leading-snug text-muted">Pediu para desmarcar. A equipa vai responder.</p>
                          <Etiqueta tom="espera">Em análise</Etiqueta>
                        </div>
                      ) : (
                        <>
                          <BotaoPedido
                            tipo="desmarcar_treino"
                            alvo={t.id}
                            rotulo="Pedir desmarcação"
                            icone={<CalendarX2 className="h-4 w-4" />}
                            variante="discreto"
                            comNota
                            avisoAnterior={recusa}
                            confirmar={{
                              titulo: 'Pedir para desmarcar',
                              texto: `${t.servico ?? 'Treino'}, ${diaPorExtenso(t.data, hoje).toLowerCase()} às ${t.hora_inicio.slice(0, 5)}. O pedido segue para a equipa, que confirma a desmarcação.`,
                              botao: 'Enviar pedido',
                            }}
                          />
                        </>
                      )}
                    </div>
                  </Cartao>
                </li>
              )
            })}
          </ul>
        )}
      </Seccao>

      {anteriores.length > 0 && (
        <Seccao titulo="Anteriores">
          <Cartao className="divide-y divide-border">
            {anteriores.map((t) => {
              const e = ESTADO[t.estado] ?? ESTADO.Concluído
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.servico ?? 'Treino'}</p>
                    <p className="text-sm text-muted tabular-nums">
                      {dataCurta(t.data, hoje)} · {t.hora_inicio.slice(0, 5)}
                    </p>
                  </div>
                  <Etiqueta tom={e.tom}>{e.texto}</Etiqueta>
                </div>
              )
            })}
          </Cartao>
        </Seccao>
      )}
    </div>
  )
}
