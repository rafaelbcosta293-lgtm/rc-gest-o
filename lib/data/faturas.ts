// Pedidos de fatura (ZS Go) — lógica pura, sem acesso à base de dados.
//
// Fluxo: o instrutor carrega em "Pedir fatura" no registo do pagamento →
// nasce um pedido "pendente" com um rascunho pré-preenchido (montado aqui)
// → a administração revê/edita o rascunho e decide: emitir no ZS Go ou
// rejeitar. Nada é enviado às Finanças sem essa validação.

export type EstadoPedidoFatura = 'pendente' | 'a_emitir' | 'emitida' | 'rejeitada' | 'erro'

export type TipoLinhaFatura = 'mensalidade' | 'inscricao' | 'seguro' | 'reativacao' | 'outro'

// Tipos de documento aceites pela API do ZS Go que fazem sentido aqui:
// FR = Fatura-Recibo (já pago, o caso normal), FA = Fatura.
export type TipoDocumentoFatura = 'FR' | 'FA'

export type LinhaRascunho = {
  tipo: TipoLinhaFatura
  descricao: string
  produto_referencia: string | null
  quantidade: number
  // Preço unitário COM IVA (o que o cliente paga). A API do ZS Go recebe
  // o preço sem IVA — a conversão é feita só no momento de emitir.
  preco_com_iva: number
  iva: number
}

export type RascunhoFatura = {
  cliente: {
    nome: string
    nif: string | null
    morada: string | null
    codigo_postal: string | null
    cidade: string | null
    email: string | null
  }
  documento: {
    tipo: TipoDocumentoFatura
    data: string
    metodo: string | null
    zsgo_metodo_id: string | null
    notas: string | null
    enviar_email: boolean
  }
  linhas: LinhaRascunho[]
}

export const IVA_POR_OMISSAO = 23

export const ROTULO_TIPO_LINHA: Record<TipoLinhaFatura, string> = {
  mensalidade: 'Mensalidade',
  inscricao: 'Inscrição',
  seguro: 'Seguro',
  reativacao: 'Reativação',
  outro: 'Outro',
}

export const ROTULO_ESTADO_PEDIDO: Record<EstadoPedidoFatura, string> = {
  pendente: 'Fatura pedida',
  a_emitir: 'A emitir…',
  emitida: 'Fatura emitida',
  rejeitada: 'Pedido rejeitado',
  erro: 'Fatura pedida',
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// "45,00" / "18.5" / null → número (0 se não der para ler).
export function numeroConfig(valor: string | null | undefined): number {
  if (!valor) return 0
  const n = Number(valor.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function arredondar(n: number, casas = 2): number {
  const f = 10 ** casas
  return Math.round((n + Number.EPSILON) * f) / f
}

// Chave de config para lembrar o produto do ZS Go escolhido por tipo de linha.
export function chaveProduto(tipo: TipoLinhaFatura): string {
  return `zsgo_produto_${tipo}`
}

// Chave de config para lembrar o método de pagamento do ZS Go por método da app.
export function chaveMetodo(metodo: string): string {
  const slug = metodo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `zsgo_metodo_${slug}`
}

// Validação do NIF português (9 dígitos + dígito de controlo).
export function nifValido(nif: string): boolean {
  const d = nif.replace(/\s/g, '')
  if (!/^\d{9}$/.test(d)) return false
  if (!'1235689'.includes(d[0])) return false
  const soma = d
    .slice(0, 8)
    .split('')
    .reduce((acc, c, i) => acc + Number(c) * (9 - i), 0)
  const resto = soma % 11
  const controlo = resto < 2 ? 0 : 11 - resto
  return controlo === Number(d[8])
}

export function normalizarNif(nif: string | null | undefined): string | null {
  if (!nif) return null
  const d = nif.replace(/[^\d]/g, '')
  return d === '' ? null : d
}

export type DadosParaRascunho = {
  pagamento: {
    valor: number
    desconto: number
    metodo: string | null
    data_pagamento: string
    valido_ate: string
    inclui_inscricao: boolean
    inclui_seguro: boolean
    inclui_reativacao: boolean
    nota: string | null
  }
  plano: { nome: string; valor: number } | null
  cliente: {
    nome: string
    nif: string | null
    morada: string | null
    codigo_postal: string | null
    cidade: string | null
    email: string | null
  }
  // Linhas de "config" (preços de inscrição/seguro/reativação e
  // produtos/métodos do ZS Go já escolhidos antes).
  config: Record<string, string | null>
}

// Monta o rascunho pré-preenchido a partir do pagamento registado.
// Uma linha por cada opção escolhida no registo do pagamento — pacote
// (plano), inscrição, seguro, reativação — cada uma com o seu preço de
// tabela (a mensalidade já com o desconto registado nesse pagamento
// descontado). Não se tenta dividir mais nenhuma diferença: se mesmo
// assim o valor pago não bater certo, o editor da Administração
// mostra-a e pode-se acertar à mão.
export function montarRascunho(d: DadosParaRascunho): RascunhoFatura {
  const { pagamento: p, config } = d
  const produto = (t: TipoLinhaFatura) => config[chaveProduto(t)] || null
  const linha = (tipo: TipoLinhaFatura, descricao: string, preco: number): LinhaRascunho => ({
    tipo,
    descricao,
    produto_referencia: produto(tipo),
    quantidade: 1,
    preco_com_iva: arredondar(preco),
    iva: IVA_POR_OMISSAO,
  })

  const [ano, mes] = p.data_pagamento.split('-').map(Number)
  const periodo = `${MESES_PT[(mes ?? 1) - 1]} ${ano}`

  const linhas: LinhaRascunho[] = []
  if (d.plano) {
    const precoComDesconto = Number(d.plano.valor) - (p.desconto || 0)
    linhas.push(linha('mensalidade', `Mensalidade ${d.plano.nome} — ${periodo}`, precoComDesconto))
  }
  if (p.inclui_inscricao) linhas.push(linha('inscricao', 'Taxa de inscrição', numeroConfig(config.taxa_inscricao)))
  if (p.inclui_seguro) linhas.push(linha('seguro', 'Seguro anual', numeroConfig(config.seguro_anual)))
  if (p.inclui_reativacao) linhas.push(linha('reativacao', 'Taxa de reativação', numeroConfig(config.taxa_reativacao)))
  // Sem nada selecionado (não devia acontecer): uma linha com o valor pago.
  if (linhas.length === 0) linhas.push(linha('mensalidade', `Mensalidade — ${periodo}`, Number(p.valor)))

  return {
    cliente: {
      nome: d.cliente.nome,
      nif: normalizarNif(d.cliente.nif),
      morada: d.cliente.morada,
      codigo_postal: d.cliente.codigo_postal,
      cidade: d.cliente.cidade,
      email: d.cliente.email,
    },
    documento: {
      tipo: 'FR',
      data: p.data_pagamento,
      metodo: p.metodo,
      zsgo_metodo_id: p.metodo ? config[chaveMetodo(p.metodo)] || null : null,
      notas: null,
      enviar_email: false,
    },
    linhas,
  }
}

export function totalRascunho(r: Pick<RascunhoFatura, 'linhas'>): number {
  return arredondar(r.linhas.reduce((s, l) => s + l.quantidade * l.preco_com_iva, 0))
}

// Preço sem IVA, como a API do ZS Go espera (unit_price_net). Usa 4
// casas para o total com IVA calculado pelo ZS Go bater ao cêntimo.
export function precoSemIva(precoComIva: number, iva: number): number {
  return arredondar(precoComIva / (1 + iva / 100), 4)
}

// Lê e valida o rascunho vindo do formulário do editor (Administração).
export function rascunhoDoFormulario(fd: FormData): RascunhoFatura {
  const txt = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
  }
  const lista = (k: string) => fd.getAll(k).map((v) => (typeof v === 'string' ? v.trim() : ''))

  const tipos = lista('linha_tipo')
  const descricoes = lista('linha_descricao')
  const produtos = lista('linha_produto')
  const quantidades = lista('linha_quantidade')
  const precos = lista('linha_preco')
  const ivas = lista('linha_iva')

  const linhas: LinhaRascunho[] = descricoes.map((descricao, i) => ({
    tipo: (Object.keys(ROTULO_TIPO_LINHA).includes(tipos[i]) ? tipos[i] : 'outro') as TipoLinhaFatura,
    descricao,
    produto_referencia: produtos[i] || null,
    quantidade: Number((quantidades[i] || '1').replace(',', '.')) || 0,
    preco_com_iva: arredondar(Number((precos[i] || '0').replace(',', '.')) || 0),
    iva: Number((ivas[i] || String(IVA_POR_OMISSAO)).replace(',', '.')),
  }))

  const tipoDoc = txt('documento_tipo')
  return {
    cliente: {
      nome: txt('cliente_nome') ?? '',
      nif: normalizarNif(txt('cliente_nif')),
      morada: txt('cliente_morada'),
      codigo_postal: txt('cliente_codigo_postal'),
      cidade: txt('cliente_cidade'),
      email: txt('cliente_email'),
    },
    documento: {
      tipo: tipoDoc === 'FA' ? 'FA' : 'FR',
      data: txt('documento_data') ?? new Date().toISOString().slice(0, 10),
      metodo: txt('documento_metodo'),
      zsgo_metodo_id: txt('documento_zsgo_metodo_id'),
      notas: txt('documento_notas'),
      enviar_email: fd.get('documento_enviar_email') === 'on',
    },
    linhas,
  }
}

// Problemas que impedem a emissão (lista vazia = pode emitir).
export function problemasParaEmitir(r: RascunhoFatura): string[] {
  const p: string[] = []
  if (!r.cliente.nome.trim()) p.push('Falta o nome do cliente.')
  if (r.cliente.nif && !nifValido(r.cliente.nif)) p.push(`O NIF ${r.cliente.nif} não é válido.`)
  if (r.linhas.length === 0) p.push('A fatura não tem linhas.')
  r.linhas.forEach((l, i) => {
    const n = i + 1
    if (!l.produto_referencia) p.push(`Linha ${n}: escolhe o artigo do ZS Go.`)
    if (!(l.quantidade > 0)) p.push(`Linha ${n}: a quantidade tem de ser maior que 0.`)
    if (!(l.preco_com_iva >= 0)) p.push(`Linha ${n}: preço inválido.`)
    if (![0, 6, 13, 23].includes(l.iva)) p.push(`Linha ${n}: taxa de IVA ${l.iva}% não é uma taxa portuguesa válida.`)
  })
  if (r.documento.tipo === 'FR' && !r.documento.zsgo_metodo_id) {
    p.push('Fatura-Recibo: escolhe o método de pagamento do ZS Go.')
  }
  if (r.documento.enviar_email && !r.cliente.email) p.push('Pediste envio por email mas o cliente não tem email.')
  // Sem NIF a AT só aceita faturas até 1000 € (consumidor final).
  if (!r.cliente.nif && totalRascunho(r) >= 1000) p.push('Sem NIF, a fatura tem de ser inferior a 1000 €.')
  return p
}
