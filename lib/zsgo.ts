// Cliente mínimo da API externa do ZS Go (faturação).
// Documentação: https://<conta>.app.zsgo.pt/api/docs (OpenAPI em /docs/api.json)
// Base: https://app.zsgo.pt/api/v1/ext · Autenticação: Bearer <ZSGO_API_KEY>
//
// Só pode ser usado no servidor (ações 'use server' / rotas) — a chave
// nunca pode chegar ao browser.

const BASE_URL = process.env.ZSGO_API_URL || 'https://app.zsgo.pt/api/v1/ext'

export class ErroZsgo extends Error {
  constructor(
    message: string,
    public status: number | null,
    public corpo: unknown = null,
    // true quando não se sabe se o pedido chegou a ser processado
    // (timeout/rede) — nesse caso nunca se deve repetir às cegas.
    public incerto = false
  ) {
    super(message)
  }
}

type Json = Record<string, unknown>

function chave(): string {
  const k = process.env.ZSGO_API_KEY
  if (!k) throw new ErroZsgo('A variável ZSGO_API_KEY não está configurada no Vercel.', null)
  return k
}

// Junta as mensagens de erro do ZS Go numa frase legível. O formato
// documentado é { data, meta, errors }, onde "errors" pode ser texto,
// lista ou objeto { campo: [mensagens] }.
export function mensagemErroZsgo(corpo: unknown, status: number): string {
  const partes: string[] = []
  const recolher = (v: unknown, prefixo = '') => {
    if (v == null) return
    if (typeof v === 'string') partes.push(prefixo + v)
    else if (Array.isArray(v)) v.forEach((x) => recolher(x, prefixo))
    else if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Json)) {
        recolher(x, /^\d+$/.test(k) || k === 'message' ? prefixo : `${prefixo}${k}: `)
      }
    }
  }
  if (corpo && typeof corpo === 'object') {
    const c = corpo as Json
    recolher(c.errors)
    if (partes.length === 0) recolher(c.message)
  } else if (typeof corpo === 'string') {
    partes.push(corpo.slice(0, 300))
  }
  const texto = partes.join(' · ')
  return texto ? `ZS Go (${status}): ${texto}` : `ZS Go respondeu com erro ${status}.`
}

async function pedido<T = Json>(
  metodo: 'GET' | 'POST' | 'PATCH',
  caminho: string,
  corpo?: unknown,
  { timeoutMs = 25000 }: { timeoutMs?: number } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${chave()}`,
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof ErroZsgo) throw e
    throw new ErroZsgo(
      `Sem resposta do ZS Go (${e instanceof Error ? e.message : 'erro de rede'}).`,
      null,
      null,
      metodo !== 'GET'
    )
  }

  const texto = await res.text()
  let json: unknown = texto
  try {
    json = texto ? JSON.parse(texto) : {}
  } catch {
    // resposta não-JSON: fica o texto
  }
  if (!res.ok) throw new ErroZsgo(mensagemErroZsgo(json, res.status), res.status, json)
  return json as T
}

// ——— Normalização defensiva das respostas ———
// A documentação só descreve { data, meta, errors }; os campos de cada
// registo seguem o mesmo formato dos pedidos de criação (identity.*,
// tax.*), mas aceitam-se também formatos "planos" por segurança.

function lista(resp: unknown): Json[] {
  const d = (resp as Json)?.data
  if (Array.isArray(d)) return d as Json[]
  if (d && typeof d === 'object') {
    const dd = d as Json
    if (Array.isArray(dd.items)) return dd.items as Json[]
    if (Array.isArray(dd.data)) return dd.data as Json[]
    return [dd]
  }
  return []
}

function primeiro(resp: unknown): Json | null {
  return lista(resp)[0] ?? null
}

function str(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'string' || typeof v === 'number') return String(v)
  }
  return null
}

function num(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = typeof v === 'string' ? Number(v) : v
    if (typeof n === 'number' && Number.isFinite(n)) return n
  }
  return null
}

const g = (o: unknown, ...caminho: string[]): unknown =>
  caminho.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Json)[k] : undefined), o)

export type ProdutoZsgo = { referencia: string; descricao: string; iva: number | null }
export type MetodoPagamentoZsgo = { id: string; nome: string }

export async function listarProdutos(): Promise<ProdutoZsgo[]> {
  const out: ProdutoZsgo[] = []
  for (let page = 1; page <= 10; page++) {
    const resp = await pedido('GET', `/products?per_page=100&page=${page}`)
    for (const p of lista(resp)) {
      const referencia = str(g(p, 'identity', 'reference'), p.reference, p.code)
      if (!referencia) continue
      out.push({
        referencia,
        descricao: str(g(p, 'identity', 'description'), p.description, p.name) ?? referencia,
        iva: num(g(p, 'tax', 'sale_tax'), p.sale_tax, p.tax_rate, p.tax),
      })
    }
    const pageCount = num(g(resp, 'meta', 'page_count')) ?? 1
    if (page >= pageCount) break
  }
  return out
}

export async function listarMetodosPagamento(): Promise<MetodoPagamentoZsgo[]> {
  const resp = await pedido('GET', '/payment-methods')
  return lista(resp)
    .filter((m) => m.only_financial !== true)
    .map((m) => ({ id: str(m.id) ?? '', nome: str(m.name, m.short_name) ?? '' }))
    .filter((m) => m.id)
}

async function primeiraLinhaDePreco(): Promise<number> {
  const resp = await pedido('GET', '/price-lines')
  const l = primeiro(resp)
  return num(l?.id, l?.code, l?.price_line) ?? 1
}

type ClienteFatura = {
  nome: string
  nif: string | null
  morada: string | null
  codigo_postal: string | null
  cidade: string | null
  email: string | null
}

// Procura um cliente no ZS Go pelo NIF. Devolve o código ou null.
export async function procurarClientePorNif(nif: string): Promise<string | null> {
  const resp = await pedido('GET', `/clients?search=${encodeURIComponent(nif)}&per_page=50`)
  for (const c of lista(resp)) {
    const taxId = str(g(c, 'identity', 'tax_id'), c.tax_id, c.nif)
    if (taxId && taxId.replace(/\D/g, '') === nif) {
      return str(g(c, 'identity', 'code'), c.code, c.id)
    }
  }
  return null
}

export async function criarCliente(c: ClienteFatura): Promise<string> {
  const priceLine = await primeiraLinhaDePreco()
  const resp = await pedido('POST', '/clients', {
    identity: { name: c.nome, tax_id: c.nif },
    address: {
      country_code: 'PT',
      address: c.morada,
      postal_code: c.codigo_postal,
      city: c.cidade,
    },
    billing: { price_line: priceLine },
    settings: { email: c.email, print_type: 1 },
  })
  const criado = primeiro(resp)
  const codigo = str(g(criado, 'identity', 'code'), criado?.code, criado?.id)
  if (!codigo) {
    throw new ErroZsgo('O ZS Go criou o cliente mas não devolveu o código.', null, resp)
  }
  return codigo
}

export type LinhaVendaZsgo = {
  product_reference: string
  quantity: number
  unit_price_net: number
  notes?: string | null
}

export type ResultadoVenda = {
  id: string | null
  numero: string | null
  pdfUrl: string | null
  atcud: string | null
  avisos: string[]
  resposta: unknown
}

export async function emitirDocumentoVenda(v: {
  clienteCodigo: string
  tipo: 'FR' | 'FA'
  data: string
  metodoPagamentoId: string | null
  referencia: string
  notas: string | null
  linhas: LinhaVendaZsgo[]
  emailPara: string | null
}): Promise<ResultadoVenda> {
  const resp = await pedido(
    'POST',
    '/sales',
    {
      customer: { code: v.clienteCodigo },
      document: {
        type: v.tipo,
        issue_date: v.data,
        auto_confirm: true,
        payment_method_id: v.metodoPagamentoId,
        reference: v.referencia,
        notes: v.notas,
      },
      items: v.linhas,
      ...(v.emailPara ? { email: { to: [v.emailPara] } } : {}),
    },
    { timeoutMs: 45000 }
  )
  const doc = primeiro(resp)
  const meta = (resp as Json)?.meta as Json | undefined
  return {
    id: str(doc?.id, g(doc, 'document', 'id')),
    numero: str(
      doc?.number,
      doc?.document_number,
      doc?.full_number,
      g(doc, 'document', 'number'),
      doc?.name
    ),
    pdfUrl: str(doc?.pdf_url, meta?.pdf_url, g(doc, 'document', 'pdf_url')),
    atcud: str(doc?.atcud, meta?.at_code),
    avisos: [meta?.warning, meta?.email_warning, meta?.integration_warning].filter(
      (x): x is string => typeof x === 'string' && x !== ''
    ),
    resposta: resp,
  }
}
