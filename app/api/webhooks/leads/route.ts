import { createAdminClient } from '@/lib/supabase/admin'
import { criarLeadAutomatica, normalizarTelefoneLead } from '@/lib/data/leads'

// Endpoint unificado para leads vindas do site e do Google Forms (novo —
// a rota antiga /api/leads/google-forms continua a funcionar tal como
// está, para não quebrar o Apps Script já ligado a ela). Chamado por um
// serviço externo, sem sessão de utilizador, por isso usa o cliente admin
// e exige o cabeçalho "x-api-key" com o LEADS_WEBHOOK_SECRET.
export const dynamic = 'force-dynamic'

function campoOuNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

const ORIGENS_VALIDAS = ['Website', 'Google Forms']

export async function POST(request: Request) {
  const esperado = process.env.LEADS_WEBHOOK_SECRET
  const recebido = request.headers.get('x-api-key')
  if (!esperado || recebido !== esperado) {
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

  const origemRecebida = campoOuNull(body.origem)
  const origem = origemRecebida && ORIGENS_VALIDAS.includes(origemRecebida) ? origemRecebida : 'Website'

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

  const externalIdBruto = campoOuNull(body.external_id)
  const resultado = await criarLeadAutomatica(admin, {
    estudioId: estudio.id,
    nome,
    telefone: normalizarTelefoneLead(campoOuNull(body.telefone)),
    email: campoOuNull(body.email),
    origem,
    campanha: campoOuNull(body.campanha),
    nota: campoOuNull(body.mensagem),
    externalId: externalIdBruto ? `${origem === 'Google Forms' ? 'google' : 'site'}_${externalIdBruto}` : null,
  })

  if ('error' in resultado) {
    return Response.json({ error: resultado.error }, { status: 500 })
  }

  return Response.json({ ok: true, id: resultado.id, duplicado: resultado.duplicado })
}
