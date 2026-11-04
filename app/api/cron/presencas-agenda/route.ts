import { createAdminClient } from '@/lib/supabase/admin'

// Quando um treino agendado na agenda interna termina sem ter sido
// desmarcado, conta automaticamente como presença do cliente — sem
// precisar que ninguém marque nada à mão. Se mais tarde (mesmo no dia
// seguinte) alguém desmarcar esse evento, a ação de desmarcar desfaz
// esta presença (ver desmarcarEventoRapido/desmarcarEvento em
// app/painel/[estudio]/agenda/actions.ts) — nunca aqui.
//
// A lógica vive na base de dados (função public.marcar_presencas_agenda,
// supabase/migrations/0053), que o pg_cron do Supabase corre a cada 15
// minutos entre as 07h e as 23h (0054). Este endpoint só a chama — fica
// para o botão manual do workflow "Presenças automáticas (Agenda
// interna)" no GitHub Actions.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('marcar_presencas_agenda')
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(data)
}
