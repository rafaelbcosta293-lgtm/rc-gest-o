import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
import { calendarIdDoEstudio, clienteTemEventoFuturo, textosDeEventosFuturos } from '@/lib/google/calendar'
import type { ClienteSemTreino } from '@/lib/supabase/database.types'

// Corre uma vez por dia (agendado fora da app — Vercel Cron ou Cron do
// Supabase, o que estiver disponível no alojamento). Protegido por
// CRON_SECRET para que só o agendador o consiga chamar.
export const dynamic = 'force-dynamic'

const DIAS_SEM_TREINO = 7

export async function GET(request: Request) {
  const esperado = process.env.CRON_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const estudios = await getEstudios(admin)

  const semAgendamento: { cliente_id: string }[] = []
  const porEstudio: Record<string, number> = {}

  for (const estudio of estudios) {
    const calendarId = calendarIdDoEstudio(estudio.slug)
    if (!calendarId) {
      // Estúdio sem calendário configurado — não tem como verificar,
      // por isso fica de fora em vez de assumir "sem agendamento" às
      // cegas (o que inundaria as Pendências com falsos positivos).
      continue
    }

    const { data: candidatosData, error } = await admin
      .from('v_clientes_sem_treino_recente')
      .select('*')
      .eq('estudio_id', estudio.id)
      .gt('dias_sem_treino', DIAS_SEM_TREINO)

    if (error) {
      return Response.json({ error: `${estudio.slug}: ${error.message}` }, { status: 500 })
    }

    const candidatos = (candidatosData ?? []) as ClienteSemTreino[]
    if (candidatos.length === 0) {
      porEstudio[estudio.slug] = 0
      continue
    }

    const textosEventos = await textosDeEventosFuturos(calendarId)
    const semEvento = candidatos.filter((c) => !clienteTemEventoFuturo(c.nome, textosEventos))

    porEstudio[estudio.slug] = semEvento.length
    semAgendamento.push(...semEvento.map((c) => ({ cliente_id: c.cliente_id })))
  }

  // Substitui a cache inteira por este resultado — mais simples e mais
  // seguro do que tentar reconciliar diffs (um cliente que voltou a
  // marcar treino tem de sair da lista, não só os que entram).
  const { error: erroApagar } = await admin
    .from('clientes_sem_agendamento')
    .delete()
    .not('cliente_id', 'is', null)
  if (erroApagar) {
    return Response.json({ error: erroApagar.message }, { status: 500 })
  }

  if (semAgendamento.length > 0) {
    const { error: erroInserir } = await admin.from('clientes_sem_agendamento').insert(semAgendamento)
    if (erroInserir) {
      return Response.json({ error: erroInserir.message }, { status: 500 })
    }
  }

  return Response.json({ ok: true, porEstudio, total: semAgendamento.length })
}
