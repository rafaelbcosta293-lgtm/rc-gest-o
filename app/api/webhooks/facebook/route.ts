import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstudios } from '@/lib/data/estudios'
import { criarLeadAutomatica, normalizarTelefoneLead } from '@/lib/data/leads'

// Webhook da Meta (Facebook/Instagram) — chamado pela própria Meta,
// nunca pela app. O GET só serve para a Meta validar a subscrição; o
// POST trata dois tipos de aviso diferentes: "leadgen" (um lead novo
// de um formulário de anúncios — vai buscar os dados completos à
// Graph API) e "messaging" (uma mensagem nova no Messenger/Instagram —
// aqui só cria um alerta a avisar, sem guardar nome nem conteúdo da
// mensagem; a equipa responde diretamente no Instagram/Messenger).
export const dynamic = 'force-dynamic'

const GRAPH_VERSAO = 'v26.0'

// A Meta assina cada pedido POST com HMAC-SHA256 do corpo, usando o App
// Secret — confirma que o pedido veio mesmo dela e não de outra origem a
// imitar o endpoint. Sem META_APP_SECRET configurado, a verificação é
// saltada (só um aviso nos logs) para não quebrar o que já estava a
// funcionar antes desta variável existir.
function assinaturaValida(corpoBruto: string, assinaturaRecebida: string | null, appSecret: string): boolean {
  if (!assinaturaRecebida) return false
  const esperado = `sha256=${createHmac('sha256', appSecret).update(corpoBruto).digest('hex')}`
  const bufEsperado = Buffer.from(esperado)
  const bufRecebido = Buffer.from(assinaturaRecebida)
  if (bufEsperado.length !== bufRecebido.length) return false
  return timingSafeEqual(bufEsperado, bufRecebido)
}

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
// Não se lê nada de dentro de "message" (nem texto, nem sender.id) —
// só interessa saber que existe, e se é um eco (mensagem enviada pela
// própria Página, não recebida) para não a confundir com uma nova.
type MensagemMeta = { message?: { is_echo?: boolean } }
type EntradaMeta = { id: string; changes?: MudancaMeta[]; messaging?: MensagemMeta[] }
type CorpoMeta = { object?: string; entry?: EntradaMeta[] }

// Usado só quando o formulário não tem (ou a pessoa não respondeu) a
// pergunta "Leiria ou Fátima" — ver estudioDaResposta, que tem
// prioridade. Se um estúdio passar a ter o seu próprio formulário
// dentro da mesma Página, META_FORM_ESTUDIO_MAP permite atribuir por
// form_id sem precisar de outra Página nem de outro token.
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

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// Nomes de campo já tratados à parte (nome/telefone/email) — nunca
// entram na procura abaixo, para o nome de alguém nunca ser lido por
// engano como resposta à pergunta do estúdio.
const CAMPOS_PADRAO = new Set(['full_name', 'nome', 'name', 'phone_number', 'telefone', 'email'])

// O formulário de anúncios tem uma pergunta própria a deixar a pessoa
// escolher "Leiria" ou "Fátima" — mais fiável do que adivinhar por
// form_id ou cair sempre no estúdio por omissão. Procura em qualquer
// campo que não seja nome/telefone/email um valor que bata certo
// (sem acentos/maiúsculas) com o slug ou o nome de um estúdio ativo;
// o nome exato da pergunta no formulário não importa, só a resposta.
function estudioDaResposta(
  campos: DadoGraph[],
  estudios: { id: number; slug: string; nome: string }[]
): { id: number; slug: string } | null {
  for (const campo of campos) {
    if (CAMPOS_PADRAO.has(campo.name.toLowerCase())) continue
    for (const valorBruto of campo.values ?? []) {
      const valor = normalizarTexto(valorBruto)
      const encontrado = estudios.find(
        (e) => valor === normalizarTexto(e.slug) || valor === normalizarTexto(e.nome)
      )
      if (encontrado) return encontrado
    }
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

  const estudios = await getEstudios(admin)
  const estudioRespondido = estudioDaResposta(campos, estudios)

  let estudio: { id: number } | null = estudioRespondido ? { id: estudioRespondido.id } : null
  if (!estudio) {
    const estudioSlug = estudioDoFormulario(formId) ?? process.env.META_LEADS_ESTUDIO_PADRAO
    if (!estudioSlug) {
      console.error('Meta Leads: sem estúdio por omissão configurado (META_LEADS_ESTUDIO_PADRAO).')
      return
    }
    estudio = estudios.find((e) => e.slug === estudioSlug) ?? null
    if (!estudio) {
      console.error(`Meta Leads: estúdio "${estudioSlug}" não encontrado.`)
      return
    }
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

const REGRA_MENSAGEM_MESSENGER = 'mensagem_messenger'
const REGRA_MENSAGEM_INSTAGRAM = 'mensagem_instagram'

// Conta partilhada pelos dois estúdios, sem forma de saber a qual se
// refere uma mensagem — por isso o alerta aparece nos dois. Só um
// alerta em aberto de cada vez por rede/estúdio (regra_chave faz de
// chave de deduplicação): várias mensagens seguidas da mesma conversa
// não inundam de alertas — o seguinte só volta a poder nascer depois
// de este ser marcado como resolvido.
async function avisarNovaMensagem(
  admin: ReturnType<typeof createAdminClient>,
  regraChave: string,
  rede: string
) {
  const estudios = await getEstudios(admin)
  for (const estudio of estudios) {
    const { data: existente, error: erroExistente } = await admin
      .from('alerts')
      .select('id')
      .eq('estudio_id', estudio.id)
      .eq('regra_chave', regraChave)
      .neq('estado', 'Resolvido')
      .limit(1)
      .maybeSingle()
    if (erroExistente) {
      console.error(`Meta Mensagens: erro ao verificar alerta existente (${estudio.slug}): ${erroExistente.message}`)
      continue
    }
    if (existente) continue

    const { error } = await admin.from('alerts').insert({
      estudio_id: estudio.id,
      regra_chave: regraChave,
      severidade: 'Atenção' as const,
      titulo: `Nova mensagem no ${rede}`,
      papel_destinatario: 'comercial',
    })
    if (error) {
      console.error(`Meta Mensagens: erro ao criar alerta (${estudio.slug}): ${error.message}`)
    }
  }
}

export async function POST(request: Request) {
  const corpoBruto = await request.text()

  const appSecret = process.env.META_APP_SECRET
  if (appSecret) {
    const assinatura = request.headers.get('x-hub-signature-256')
    if (!assinaturaValida(corpoBruto, assinatura, appSecret)) {
      console.error('Meta Leads: assinatura do webhook inválida — pedido rejeitado.')
      return new Response('Invalid signature', { status: 401 })
    }
  } else {
    console.error('Meta Leads: META_APP_SECRET não configurado — a saltar verificação de assinatura.')
  }

  let body: CorpoMeta
  try {
    body = JSON.parse(corpoBruto)
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

    // "messaging" (Messenger ou Instagram) — só quando há mesmo uma
    // mensagem recebida (ignora ecos, entregas e leituras).
    const temMensagemNova = (entrada.messaging ?? []).some((m) => m.message && !m.message.is_echo)
    if (temMensagemNova) {
      const instagram = body.object === 'instagram'
      await avisarNovaMensagem(
        admin,
        instagram ? REGRA_MENSAGEM_INSTAGRAM : REGRA_MENSAGEM_MESSENGER,
        instagram ? 'Instagram' : 'Messenger'
      )
    }
  }

  return Response.json({ ok: true })
}
