import { createAdminClient } from '@/lib/supabase/admin'

// Chamado pelo Google Apps Script ligado ao formulário (gatilho "ao
// enviar"), não por um utilizador autenticado — por isso usa o cliente
// admin e exige o LEADS_WEBHOOK_SECRET, tal como o cron de retenção.
export const dynamic = 'force-dynamic'

function campoOuNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export async function POST(request: Request) {
  const esperado = process.env.LEADS_WEBHOOK_SECRET
  const recebido = request.headers.get('authorization')
  if (!esperado || recebido !== `Bearer ${esperado}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo do pedido inválido (esperado JSON).' }, { status: 400 })
  }

  const nome = campoOuNull(body.nome)
  const estudioSlug = campoOuNull(body.estudio)
  if (!nome || !estudioSlug) {
    return Response.json(
      { error: 'Faltam os campos obrigatórios "nome" e "estudio".' },
      { status: 400 }
    )
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }

  const { data: estudio, error: erroEstudio } = await admin
    .from('estudios')
    .select('id')
    .eq('slug', estudioSlug)
    .eq('ativo', true)
    .maybeSingle()

  if (erroEstudio) {
    return Response.json({ error: erroEstudio.message }, { status: 500 })
  }
  if (!estudio) {
    return Response.json({ error: `Estúdio "${estudioSlug}" não encontrado.` }, { status: 400 })
  }

  const { data, error } = await admin
    .from('leads')
    .insert({
      estudio_id: estudio.id,
      nome,
      telefone: campoOuNull(body.telefone),
      email: campoOuNull(body.email),
      origem: campoOuNull(body.origem) ?? 'Google Forms',
      objetivo: campoOuNull(body.objetivo),
      interesse: campoOuNull(body.interesse),
      disponibilidade: campoOuNull(body.disponibilidade),
      walk_in: false,
    })
    .select('id')
    .single()

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? 'Não foi possível criar o lead.' },
      { status: 500 }
    )
  }

  return Response.json({ ok: true, id: data.id })
}
