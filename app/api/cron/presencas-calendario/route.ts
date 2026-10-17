import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
import { calendarIdDoEstudio, clienteExatoDoEvento, eventosComCorNoIntervalo } from '@/lib/google/calendar'

// Reconcilia presenças com a cor dos eventos no Google Calendar: um
// evento já terminado, na cor predefinida do calendário (sem cor
// própria escolhida), conta como presença; se alguém mudar a cor desse
// evento depois (para sinalizar falta/cancelamento), a presença que
// este job tinha criado é desfeita. Corre periodicamente (agendado fora
// da app, tal como /api/cron/retencao) — cada corrida só reconcilia o
// que já terminou, por isso repetir é seguro.
export const dynamic = 'force-dynamic'

// Janela de eventos considerados em cada corrida. Mais do que suficiente
// para apanhar atrasos do agendador, sem pedir o calendário inteiro.
const DIAS_PARA_TRAS = 7

type ClienteNome = { id: string; nome: string }

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  // "detalhe=1" inclui, por estúdio, os eventos ignorados (sem cliente
  // reconhecido) com título por extenso — só para diagnóstico manual.
  // Nunca é pedido pela corrida agendada (que não leva estes parâmetros),
  // por isso não muda o que fica no log do GitHub Actions a cada 30 min.
  // Importante: quem chamar isto com detalhe=1 vê nomes de clientes na
  // resposta — nunca correr assim a partir de um sítio com log público.
  const url = new URL(request.url)
  const comDetalhe = url.searchParams.get('detalhe') === '1'
  const estudioFiltro = url.searchParams.get('estudio')

  const admin = createAdminClient()
  const estudios = await getEstudios(admin)

  const agora = new Date()
  const timeMin = new Date(agora.getTime() - DIAS_PARA_TRAS * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = agora.toISOString()

  const porEstudio: Record<
    string,
    {
      marcadas: number
      desmarcadas: number
      ignorados: number
      ignoradosDetalhe?: { data: string; hora: string; resumo: string }[]
    }
  > = {}

  for (const estudio of estudios) {
    const calendarId = calendarIdDoEstudio(estudio.slug)
    if (!calendarId) {
      continue
    }
    if (estudioFiltro && estudio.slug !== estudioFiltro) {
      continue
    }

    const { data: clientesData, error: erroClientes } = await admin
      .from('clientes')
      .select('id, nome')
      .eq('estudio_id', estudio.id)
      .eq('estado', 'Ativo')
    if (erroClientes) {
      return Response.json({ error: `${estudio.slug}: ${erroClientes.message}` }, { status: 500 })
    }
    const clientes = (clientesData ?? []) as ClienteNome[]

    const eventos = (await eventosComCorNoIntervalo(calendarId, timeMin, timeMax)).filter(
      (ev) => ev.fim.getTime() <= agora.getTime()
    )

    let marcadas = 0
    let desmarcadas = 0
    let ignorados = 0
    const ignoradosDetalhe: { data: string; hora: string; resumo: string }[] = []

    for (const evento of eventos) {
      const cliente = clienteExatoDoEvento(evento.texto, clientes)
      if (!cliente) {
        ignorados++
        if (comDetalhe) {
          ignoradosDetalhe.push({ data: evento.data, hora: evento.hora, resumo: evento.resumo })
        }
        continue
      }

      if (evento.colorId === null) {
        // Cor predefinida — conta como presença, a não ser que já haja
        // um registo manual para este cliente/dia (esse nunca se mexe).
        const { data: existente, error: erroExistente } = await admin
          .from('presencas')
          .select('id, origem, google_event_id')
          .eq('cliente_id', cliente.id)
          .eq('data', evento.data)
          .maybeSingle()
        if (erroExistente) {
          return Response.json({ error: erroExistente.message }, { status: 500 })
        }

        if (!existente) {
          const { error: erroInserir } = await admin.from('presencas').insert({
            cliente_id: cliente.id,
            data: evento.data,
            estado: 'Presente',
            origem: 'calendario',
            google_event_id: evento.id,
          })
          if (erroInserir) {
            return Response.json({ error: erroInserir.message }, { status: 500 })
          }
          marcadas++
        } else if (existente.origem === 'calendario' && existente.google_event_id !== evento.id) {
          const { error: erroAtualizar } = await admin
            .from('presencas')
            .update({ google_event_id: evento.id, estado: 'Presente' })
            .eq('id', existente.id)
          if (erroAtualizar) {
            return Response.json({ error: erroAtualizar.message }, { status: 500 })
          }
          marcadas++
        }
      } else {
        // Cor alterada à mão — desfaz só a presença que este job tinha
        // criado para este evento (nunca uma marcada manualmente).
        const { data: apagadas, error: erroApagar } = await admin
          .from('presencas')
          .delete()
          .eq('google_event_id', evento.id)
          .eq('origem', 'calendario')
          .select('id')
        if (erroApagar) {
          return Response.json({ error: erroApagar.message }, { status: 500 })
        }
        desmarcadas += apagadas?.length ?? 0
      }
    }

    porEstudio[estudio.slug] = {
      marcadas,
      desmarcadas,
      ignorados,
      ...(comDetalhe ? { ignoradosDetalhe } : {}),
    }
  }

  return Response.json({ ok: true, porEstudio })
}
