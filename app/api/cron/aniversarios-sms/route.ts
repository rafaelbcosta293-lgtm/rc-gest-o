import { createAdminClient } from '@/lib/supabase/admin'
import { processarAniversariosSms } from '@/lib/data/aniversariosSms'

// Corre todos os dias por volta das 10:00 em Lisboa (ver
// .github/workflows/aniversarios-sms.yml, desfasado alguns minutos do
// de lembretes de treino para não disputarem ao mesmo tempo o estado
// do gateway, que é partilhado por estúdio). Protegido por CRON_SECRET,
// como os outros crons.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  try {
    const resultado = await processarAniversariosSms(admin)
    return Response.json({ ok: true, ...resultado })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    return Response.json({ ok: false, error: mensagem }, { status: 500 })
  }
}
