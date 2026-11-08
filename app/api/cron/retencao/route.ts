import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
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
  const hoje = new Date().toISOString().slice(0, 10)

  const semAgendamento: { cliente_id: string }[] = []
  const porEstudio: Record<string, number> = {}

  for (const estudio of estudios) {
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

    // Quem já tem um treino agendado na agenda interna não entra na
    // lista, mesmo sem ter treinado recentemente — já está encaminhado.
    const idsCandidatos = candidatos.map((c) => c.cliente_id)
    const { data: futurosData, error: erroFuturos } = await admin
      .from('agenda_eventos')
      .select('cliente_id')
      .in('cliente_id', idsCandidatos)
      .eq('estado', 'Agendado')
      .gte('data', hoje)
    if (erroFuturos) {
      return Response.json({ error: `${estudio.slug}: ${erroFuturos.message}` }, { status: 500 })
    }

    const comEventoAgendado = new Set((futurosData ?? []).map((e) => e.cliente_id))
    const semEvento = candidatos.filter((c) => !comEventoAgendado.has(c.cliente_id))

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
