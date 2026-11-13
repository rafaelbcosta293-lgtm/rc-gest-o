import { put } from '@vercel/blob'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Rede de segurança própria enquanto o projeto Supabase estiver no
// plano gratuito, que não inclui nenhuma cópia de segurança
// automática — ver .github/workflows/backup.yml (uma vez por dia).
// Guarda-se no Vercel Blob (serviço à parte da Supabase, com o seu
// próprio token — "rc-gestao-backups", acesso privado) para a cópia
// continuar a existir mesmo que a conta/projeto Supabase seja
// comprometido. Lista fixa das tabelas de base (não views, que são
// sempre derivadas destas) — atualizar aqui sempre que uma migration
// acrescentar uma tabela nova.
const TABELAS = [
  'activities',
  'agenda_eventos',
  'agenda_series',
  'alert_rules',
  'alerts',
  'auditoria',
  'ausencias',
  'avaliacoes',
  'categorias',
  'cenarios_simulador',
  'checklist_modelo',
  'checklist_registos',
  'checklist_respostas',
  'clientes',
  'clientes_sem_agendamento',
  'config',
  'envios_aniversario',
  'escalas',
  'estado_sms_gateway',
  'estudios',
  'eventos',
  'exercicios',
  'exercicios_categorias',
  'fechos_caixa',
  'goals',
  'kpi_snapshots_daily',
  'lead_contactos',
  'lead_stage_history',
  'leads',
  'marcos_empresa',
  'marketing_costs',
  'outros_caixa',
  'pagamentos',
  'pedidos_fatura',
  'perfis',
  'perfis_estudios',
  'planos',
  'presencas',
  'registos_pt',
  'saidas_caixa',
  'sessao_exercicios',
  'sessoes',
] as const

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const tabelas: Record<string, unknown[]> = {}

  for (const tabela of TABELAS) {
    const { data, error } = await admin.from(tabela).select('*')
    if (error) {
      return Response.json({ error: `${tabela}: ${error.message}` }, { status: 500 })
    }
    tabelas[tabela] = data ?? []
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const conteudo = JSON.stringify({ geradoEm: new Date().toISOString(), tabelas })

  const resultado = await put(`backups/${hoje}.json`, conteudo, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return Response.json({ ok: true, ficheiro: resultado.pathname, tabelas: TABELAS.length })
}
