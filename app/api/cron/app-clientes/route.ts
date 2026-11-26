import { createAdminClient } from '@/lib/supabase/admin'
import { appClientesConfigurada } from '@/lib/appClientes/ligacao'
import { sincronizarAppClientes } from '@/lib/appClientes/sincronizar'

// Sincronização com a app do cliente — chamada pelo pg_cron da base da
// gestão de minuto a minuto, e só quando há contas na app (ver
// supabase/migrations/*_app_clientes_cron*.sql; começou de 20 em 20
// segundos, o que gastava processamento do servidor sem necessidade).
// Protegida por APP_CLIENTES_CRON_SECRET (ou CRON_SECRET). Não devolve
// dados nenhuns, só contagens.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const recebido = request.headers.get('authorization')
  const segredos = [process.env.APP_CLIENTES_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean)
  if (!segredos.some((s) => recebido === `Bearer ${s}`)) {
    return new Response('unauthorized', { status: 401 })
  }
  if (!appClientesConfigurada()) return Response.json({ ok: true, configurada: false })

  const admin = createAdminClient()
  const { data: podeCorrer, error: erroLock } = await admin.rpc('app_clientes_reclamar_sync', { p_segundos: 55 })
  if (erroLock) return Response.json({ ok: false, erro: erroLock.message }, { status: 500 })
  if (!podeCorrer) return Response.json({ ok: true, emCurso: true })

  try {
    const rel = await sincronizarAppClientes(admin)
    await admin
      .from('app_clientes_sync')
      .update({ em_curso_ate: null, ultimo_fim: new Date().toISOString(), ultimo_erro: rel.erros.length ? rel.erros.join(' | ').slice(0, 1000) : null })
      .eq('id', 1)
    return Response.json({ ok: rel.erros.length === 0, ...rel })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[app-clientes] sincronização falhou:', msg)
    await admin.from('app_clientes_sync').update({ em_curso_ate: null, ultimo_erro: msg.slice(0, 1000) }).eq('id', 1)
    return Response.json({ ok: false, erro: msg }, { status: 500 })
  }
}
