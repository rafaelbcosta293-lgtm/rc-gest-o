import { put } from '@vercel/blob'
import { createAdminClient } from '@/lib/supabase/admin'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'

export const dynamic = 'force-dynamic'
// Lê dezenas de milhares de linhas (auditoria, pagamentos…).
export const maxDuration = 300

// Rede de segurança própria enquanto o projeto Supabase estiver no
// plano gratuito, que não inclui nenhuma cópia de segurança
// automática — ver .github/workflows/backup.yml (uma vez por dia).
// Guarda-se no Vercel Blob (serviço à parte da Supabase, com o seu
// próprio token — "rc-gestao-backups", acesso privado) para a cópia
// continuar a existir mesmo que a conta/projeto Supabase seja
// comprometido. Lista fixa das tabelas de base (não views, que são
// sempre derivadas destas) — atualizar aqui sempre que uma migration
// acrescentar uma tabela nova.
// Tabela → coluna(s) da chave primária, para ler tudo por páginas numa
// ordem estável (a API devolve no máximo 1000 linhas por pedido — sem
// isto, tabelas grandes como pagamentos e auditoria ficavam cortadas).
const TABELAS: Record<string, string[]> = {
  activities: ['id'],
  agenda_eventos: ['id'],
  agenda_series: ['id'],
  alert_rules: ['id'],
  alerts: ['id'],
  auditoria: ['id'],
  ausencias: ['id'],
  avaliacoes: ['id'],
  categorias: ['id'],
  cenarios_simulador: ['id'],
  checklist_modelo: ['id'],
  checklist_registos: ['id'],
  checklist_respostas: ['id'],
  clientes: ['id'],
  clientes_sem_agendamento: ['cliente_id'],
  config: ['chave'],
  config_assiduidade: ['perfil_id'],
  despesa_categorias: ['id'],
  despesa_subcategorias: ['id'],
  despesas: ['id'],
  despesas_recorrentes: ['id'],
  envios_aniversario: ['id'],
  escalas: ['id'],
  estado_sms_gateway: ['estudio_id'],
  estudios: ['id'],
  eventos: ['id'],
  exercicios: ['id'],
  exercicios_categorias: ['exercicio_id', 'categoria_id'],
  fechos_caixa: ['id'],
  fechos_horario: ['id'],
  ferias_bloqueios: ['id'],
  goals: ['id'],
  kpi_snapshots_daily: ['id'],
  lead_contactos: ['id'],
  lead_stage_history: ['id'],
  leads: ['id'],
  marcos_empresa: ['id'],
  marketing_costs: ['id'],
  outros_caixa: ['id'],
  pagamentos: ['id'],
  pedidos_fatura: ['id'],
  pedidos_ferias: ['id'],
  perfis: ['id'],
  perfis_estudios: ['perfil_id', 'estudio_id'],
  planos: ['id'],
  presencas: ['id'],
  receitas_outras: ['id'],
  registos_horario: ['id'],
  registos_pt: ['id'],
  saidas_caixa: ['id'],
  sessao_exercicios: ['id'],
  sessoes: ['id'],
}

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const tabelas: Record<string, unknown[]> = {}

  for (const [tabela, chave] of Object.entries(TABELAS)) {
    const { data, error } = await todasAsLinhas<unknown>(
      (de, ate) => {
        let q = admin.from(tabela).select('*')
        for (const coluna of chave) q = q.order(coluna)
        return q.range(de, ate)
      },
      { emParalelo: 4 }
    )
    if (error) {
      return Response.json({ error: `${tabela}: ${error.message}` }, { status: 500 })
    }
    tabelas[tabela] = data
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const conteudo = JSON.stringify({ geradoEm: new Date().toISOString(), tabelas })

  const resultado = await put(`backups/${hoje}.json`, conteudo, {
    // O armazenamento "rc-gestao-backups" é privado: a cópia tem dados
    // pessoais dos clientes e nunca pode ficar num URL público.
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  const linhas = Object.values(tabelas).reduce((n, t) => n + t.length, 0)
  return Response.json({ ok: true, ficheiro: resultado.pathname, tabelas: Object.keys(TABELAS).length, linhas })
}
