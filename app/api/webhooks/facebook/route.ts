import { createAdminClient } from '@/lib/supabase/admin'
import { criarLeadAutomatica, normalizarTelefoneLead } from '@/lib/data/leads'

// Webhook de "leadgen" da Meta (Facebook/Instagram Ads) — chamado pela
// própria Meta, nunca pela app. O GET só serve para a Meta validar a
// subscrição; o POST recebe o aviso de um novo lead e vai buscar os
// dados completos à Graph API (a notificação em si só traz o id).
export const dynamic = 'force-dynamic'

const GRAPH_VERSAO = 'v19.0'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const modo = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (modo === 'subscribe' && challenge && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

type CampoLeadgen = {
  leadgen_id?: string
  form_id?: string
}

type MudancaMeta = { field: string; value: CampoLeadgen }
type EntradaMeta = { id: string; changes?: MudancaMeta[] }
type CorpoMeta = { object?: string; entry?: EntradaMeta[] }

// Um estúdio por omissão (META_LEADS_ESTUDIO_PADRAO) cobre o caso comum —
// uma só Página/conta de anúncios para o negócio todo. Se, no futuro, cada
// estúdio passar a ter o seu próprio formulário de lead ads dentro dessa
// mesma Página, META_FORM_ESTUDIO_MAP permite atribuir por form_id sem
// precisar de outra Página nem de outro token.
function estudioDoFormulario(formId: string | undefined): string | null {
  if (!formId) return null
  const mapaBruto = process.env.META_FORM_ESTUDIO_MAP
  if (!mapaBruto) return null
  try {
    const mapa = JSON.parse(mapaBruto) as Record<string, string>
    return mapa[formId] ?? null
  } catch {
    console.error('Meta Leads: META_FORM_ESTUDIO_MAP não é um JSON válido.')
    return null
  }
}

type DadoGraph = { name: string; values?: string[] }

function extrairCampo(dados: DadoGraph[], ...nomes: string[]): string | null {
  for (const nome of nomes) {
    const campo = dados.find((d) => d.name.toLowerCase() === nome)
    if (campo?.values?.[0]) return campo.values[0]
  }
  return null
}

async function processarLeadgen(
  admin: ReturnType<typeof createAdminClient>,
  leadgenId: string,
  formId: string | undefined
) {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token) {
    console.error('Meta Leads: META_PAGE_ACCESS_TOKEN não configurado.')
    return
  }

  const resposta = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSAO}/${leadgenId}?access_token=${encodeURIComponent(token)}`
  )
  if (!resposta.ok) {
    console.error(`Meta Leads: falha ao obter leadgen ${leadgenId} (HTTP ${resposta.status}).`)
    return
  }
  const dados = (await resposta.json()) as { field_data?: DadoGraph[] }
  const campos = dados.field_data ?? []

  const nome = extrairCampo(campos, 'full_name', 'nome', 'name')
  const telefone = extrairCampo(campos, 'phone_number', 'telefone')
  const email = extrairCampo(campos, 'email')

  if (!nome) {
    console.error(`Meta Leads: leadgen ${leadgenId} sem nome nos campos — ignorado.`)
    return
  }

  const estudioSlug = estudioDoFormulario(formId) ?? process.env.META_LEADS_ESTUDIO_PADRAO
  if (!estudioSlug) {
    console.error('Meta Leads: sem estúdio por omissão configurado (META_LEADS_ESTUDIO_PADRAO).')
    return
  }

  const { data: estudio, error: erroEstudio } = await admin
    .from('estudios')
    .select('id')
    .eq('slug', estudioSlug)
    .eq('ativo', true)
    .maybeSingle()
  if (erroEstudio || !estudio) {
    console.error(`Meta Leads: estúdio "${estudioSlug}" não encontrado.`)
    return
  }

  const resultado = await criarLeadAutomatica(admin, {
    estudioId: estudio.id,
    nome,
    telefone: normalizarTelefoneLead(telefone),
    email,
    origem: 'Meta Ads',
    externalId: `meta_${leadgenId}`,
  })

  if ('error' in resultado) {
    console.error(`Meta Leads: erro ao gravar leadgen ${leadgenId}: ${resultado.error}`)
  }
}

export async function POST(request: Request) {
  let body: CorpoMeta
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: true })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    // Responde sempre 200 à Meta (evita reentregas em cascata); o erro de
    // configuração fica só registado nos logs do servidor.
    console.error('Meta Leads: SUPABASE_SERVICE_ROLE_KEY não configurada.')
    return Response.json({ ok: true })
  }

  for (const entrada of body.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      if (mudanca.field !== 'leadgen') continue
      const leadgenId = mudanca.value?.leadgen_id
      if (!leadgenId) continue
      await processarLeadgen(admin, leadgenId, mudanca.value?.form_id)
    }
  }

  return Response.json({ ok: true })
}
