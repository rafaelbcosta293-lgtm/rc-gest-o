import { createAdminClient } from '@/lib/supabase/admin'
import { gerarExtensaoSerie } from '@/lib/data/agenda'
import type { AgendaSerie } from '@/lib/supabase/database.types'

// Corre uma vez por dia. Mantém a janela de ocorrências já geradas de
// cada série "indefinida" sempre ~90 dias à frente de hoje — nunca gera
// "para sempre" de uma vez (ver HORIZONTE_INDEFINIDO_DIAS em
// lib/data/agenda.ts). Uma série deixa de ser estendida assim que
// alguém a interrompe (agenda_series.ativa = false, ver pararSerie em
// app/painel/[estudio]/agenda/actions.ts).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = new Date().toISOString().slice(0, 10)

  const { data: seriesData, error: erroSeries } = await admin
    .from('agenda_series')
    .select('*')
    .eq('ativa', true)
  if (erroSeries) return Response.json({ error: erroSeries.message }, { status: 500 })

  const series = (seriesData ?? []) as AgendaSerie[]
  let totalGeradas = 0

  for (const serie of series) {
    const { data: ultimaData, error: erroUltima } = await admin
      .from('agenda_eventos')
      .select('data')
      .eq('serie_id', serie.id)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (erroUltima) return Response.json({ error: erroUltima.message }, { status: 500 })
    if (!ultimaData) continue // sem nenhuma ocorrência ainda — nada para estender a partir daqui

    const novasDatas = gerarExtensaoSerie(ultimaData.data, serie.repeticao, hoje)
    if (novasDatas.length === 0) continue

    const linhas = novasDatas.map((data) => ({
      estudio_id: serie.estudio_id,
      cliente_id: serie.cliente_id,
      pt_id: serie.pt_id,
      tipo: serie.tipo,
      titulo: serie.titulo,
      data,
      hora_inicio: serie.hora_inicio,
      duracao_min: serie.duracao_min,
      serie_id: serie.id,
      nota: serie.nota,
      criado_por: serie.criado_por,
    }))
    const { error: erroInserir } = await admin.from('agenda_eventos').insert(linhas)
    if (erroInserir) return Response.json({ error: erroInserir.message }, { status: 500 })
    totalGeradas += linhas.length
  }

  return Response.json({ ok: true, series: series.length, ocorrenciasGeradas: totalGeradas })
}
