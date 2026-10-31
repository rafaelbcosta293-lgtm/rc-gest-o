import { createAdminClient } from '@/lib/supabase/admin'
import { processarLembretesSms } from '@/lib/data/lembretesSms'

// Corre todos os dias às 10:00 em Lisboa (ver .github/workflows/lembretes-sms.yml,
// que também faz as tentativas espaçadas de 1 minuto quando o gateway
// está offline). Protegido por CRON_SECRET, como os outros crons.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  try {
    const resultado = await processarLembretesSms(admin)
    return Response.json({ ok: true, ...resultado })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    return Response.json({ ok: false, error: mensagem }, { status: 500 })
  }
}
