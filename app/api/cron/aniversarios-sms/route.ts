import { createAdminClient } from '@/lib/supabase/admin'
import { processarAniversariosSms } from '@/lib/data/aniversariosSms'

// Disparado todos os dias às 9h10 UTC pelo Cron do Vercel (ver
// vercel.json, desfasado do de lembretes de treino para não disputarem
// ao mesmo tempo o estado do gateway, que é partilhado por estúdio) —
// o GitHub Actions (.github/workflows/aniversarios-sms.yml) falhava em
// disparar à hora certa sem aviso, por isso deixou de ser o agendador;
// fica só disponível para disparar à mão. Protegido por CRON_SECRET,
// como os outros crons (o Vercel Cron já inclui este cabeçalho
// sozinho, por a variável estar configurada no projeto).
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
