import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'

// Alimenta "kpi_snapshots_daily" (existia desde a Fase 2 mas nunca
// tinha nenhum cron a escrever nela) — uma vez por dia, ao fim do
// dia, para a Timeline da empresa (painel 4.6) ter histórico a partir
// de agora. Nunca grava valores em €: a leitura desta tabela é
// "e_gestao()", mais larga do que "e_admin()" — um valor em € aqui
// fugiria à regra de ouro.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = new Date().toISOString().slice(0, 10)
  const estudios = await getEstudios(admin)

  const linhas: { estudio_id: number; data: string; metricas: Record<string, number> }[] = []

  for (const estudio of estudios) {
    const [{ data: quadroData, error: erroQuadro }, { count: clientesAtivos, error: erroClientes }] =
      await Promise.all([
        admin.rpc('quadro_do_dia', { p_estudio: estudio.id, p_dia: hoje }),
        admin
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('estudio_id', estudio.id)
          .eq('estado', 'Ativo'),
      ])

    if (erroQuadro) return Response.json({ error: `${estudio.slug}: ${erroQuadro.message}` }, { status: 500 })
    if (erroClientes) return Response.json({ error: `${estudio.slug}: ${erroClientes.message}` }, { status: 500 })

    const quadro = quadroData?.[0]
    linhas.push({
      estudio_id: estudio.id,
      data: hoje,
      metricas: {
        leads_novas: quadro?.leads_novas ?? 0,
        contactos: quadro?.contactos ?? 0,
        contactos_sucesso: quadro?.contactos_sucesso ?? 0,
        sessoes_agendadas: quadro?.sessoes_agendadas ?? 0,
        sessoes_para_hoje: quadro?.sessoes_para_hoje ?? 0,
        vendas: quadro?.vendas ?? 0,
        clientes_ativos: clientesAtivos ?? 0,
      },
    })
  }

  const { error } = await admin.from('kpi_snapshots_daily').upsert(linhas, { onConflict: 'estudio_id,data' })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, dias: linhas.length })
}
