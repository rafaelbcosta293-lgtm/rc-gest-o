import { createAdminClient } from '@/lib/supabase/admin'
import type { EventoAgenda } from '@/lib/supabase/database.types'

// Quando um treino agendado na agenda interna termina sem ter sido
// desmarcado, conta automaticamente como presença do cliente — sem
// precisar que ninguém marque nada à mão. Se mais tarde (mesmo no dia
// seguinte) alguém desmarcar esse evento, a ação de desmarcar desfaz
// esta presença (ver desmarcarEventoRapido/desmarcarEvento em
// app/painel/[estudio]/agenda/actions.ts) — nunca aqui, para o cron só
// ter de olhar para a frente (eventos que acabaram de terminar), nunca
// para trás a desfazer trabalho de outros.
export const dynamic = 'force-dynamic'

// Janela de segurança para apanhar atrasos do agendador — mais do que
// isso não faz sentido: um evento tão antigo já devia ter sido
// reconciliado há muito (ou foi desmarcado, nesse caso nem aparece aqui
// por já não estar "Agendado").
const DIAS_PARA_TRAS = 3

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const agora = new Date()
  const desde = new Date(agora.getTime() - DIAS_PARA_TRAS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: eventosData, error: erroEventos } = await admin
    .from('agenda_eventos')
    .select('id, cliente_id, pt_id, tipo, data, hora_inicio, duracao_min, estado')
    .eq('tipo', 'Treino')
    .eq('estado', 'Agendado')
    .not('cliente_id', 'is', null)
    .gte('data', desde)
  if (erroEventos) {
    return Response.json({ error: erroEventos.message }, { status: 500 })
  }

  const eventos = (eventosData ?? []) as EventoAgenda[]
  let marcados = 0
  let concluidos = 0

  for (const evento of eventos) {
    const fim = new Date(`${evento.data}T${evento.hora_inicio.slice(0, 5)}:00`)
    fim.setMinutes(fim.getMinutes() + evento.duracao_min)
    if (fim.getTime() > agora.getTime()) continue // ainda não terminou

    const { data: existente, error: erroExistente } = await admin
      .from('presencas')
      .select('id, origem')
      .eq('cliente_id', evento.cliente_id as string)
      .eq('data', evento.data)
      .maybeSingle()
    if (erroExistente) {
      return Response.json({ error: erroExistente.message }, { status: 500 })
    }

    if (!existente) {
      const { error: erroInserir } = await admin.from('presencas').insert({
        cliente_id: evento.cliente_id,
        data: evento.data,
        estado: 'Presente',
        pt_id: evento.pt_id,
        origem: 'agenda',
        agenda_evento_id: evento.id,
      })
      if (erroInserir) {
        return Response.json({ error: erroInserir.message }, { status: 500 })
      }
      marcados++
    } else if (existente.origem === 'agenda') {
      const { error: erroAtualizar } = await admin
        .from('presencas')
        .update({ estado: 'Presente', agenda_evento_id: evento.id })
        .eq('id', existente.id)
      if (erroAtualizar) {
        return Response.json({ error: erroAtualizar.message }, { status: 500 })
      }
      marcados++
    }
    // Já havia um registo manual para este cliente/dia — nunca se mexe.

    const { error: erroConcluir } = await admin
      .from('agenda_eventos')
      .update({ estado: 'Concluído' })
      .eq('id', evento.id)
    if (erroConcluir) {
      return Response.json({ error: erroConcluir.message }, { status: 500 })
    }
    concluidos++
  }

  return Response.json({ ok: true, marcados, concluidos })
}
