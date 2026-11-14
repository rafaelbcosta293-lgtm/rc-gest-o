// Motor da Análise Financeira (Administração → Financeiro). Funções
// puras, sem acesso à base de dados, para poderem ser testadas e usadas
// tal e qual no servidor. Tudo é calculado a partir dos pagamentos
// (dinheiro efetivamente recebido, sem anulados) e da validade de cada
// pagamento (que diz em que meses o cliente esteve coberto).

export type PagamentoAnalise = {
  cliente_id: string
  estudio_id: number
  valor: number // líquido — o que o cliente pagou
  desconto: number
  metodo: string | null
  plano_id: string | null
  data_pagamento: string // YYYY-MM-DD
  valido_ate: string // YYYY-MM-DD
  // Receita sem cliente (bar, merchandising, apoios, osteopatia…): o
  // nome da categoria. Conta para a receita, mas não para clientes,
  // nº de pagamentos, planos, MRR nem churn.
  outra?: string
}

export type Despesa = { estudio_id: number; data: string; categoria: string; subcategoria: string | null; valor: number }

export type TipoPeriodo = 'mes' | 'ano' | 'sempre'

export type Periodo = {
  tipo: TipoPeriodo
  ref: string // "YYYY-MM", "YYYY" ou "sempre"
  inicio: string // inclusive
  fim: string // inclusive
  rotulo: string
  parcial: boolean // o período ainda não acabou (corta em "hoje")
}

export const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const pad2 = (n: number) => String(n).padStart(2, '0')

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

export function somarMeses(mesISO: string, n: number): string {
  const [a, m] = mesISO.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

// Lista de meses "YYYY-MM" de `de` a `ate`, inclusive.
export function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = []
  for (let m = de.slice(0, 7); m <= ate.slice(0, 7); m = somarMeses(m, 1)) meses.push(m)
  return meses
}

export function rotuloMes(mesISO: string, curto = false): string {
  const m = Number(mesISO.slice(5, 7)) - 1
  return curto ? `${MESES_CURTOS[m]}/${mesISO.slice(2, 4)}` : `${NOMES_MESES[m]} ${mesISO.slice(0, 4)}`
}

function cortar(p: Omit<Periodo, 'parcial'>, hoje: string): Periodo {
  if (p.inicio <= hoje && hoje < p.fim) return { ...p, fim: hoje, parcial: true }
  return { ...p, parcial: false }
}

export function resolverPeriodo(tipo: TipoPeriodo, ref: string | undefined, hoje: string, primeiraData: string): Periodo {
  if (tipo === 'sempre') {
    return cortar({ tipo, ref: 'sempre', inicio: primeiraData, fim: hoje, rotulo: 'Desde sempre' }, hoje)
  }
  if (tipo === 'ano') {
    const ano = /^\d{4}$/.test(ref ?? '') ? Number(ref) : Number(hoje.slice(0, 4))
    return cortar({ tipo, ref: String(ano), inicio: `${ano}-01-01`, fim: `${ano}-12-31`, rotulo: String(ano) }, hoje)
  }
  const mes = /^\d{4}-\d{2}$/.test(ref ?? '') ? ref! : hoje.slice(0, 7)
  const [a, m] = mes.split('-').map(Number)
  return cortar(
    { tipo, ref: mes, inicio: `${mes}-01`, fim: `${mes}-${pad2(ultimoDiaDoMes(a, m))}`, rotulo: rotuloMes(mes) },
    hoje
  )
}

// Período de comparação recuado `passos` (1 = mês/ano anterior; 12
// meses = mesmo mês do ano anterior). Se o período atual ainda está a
// decorrer, a comparação corta no mesmo ponto (ex.: 1–14 de novembro
// contra 1–14 de outubro), para comparar o comparável.
export function periodoRecuado(p: Periodo, passos: number): Periodo | null {
  if (p.tipo === 'sempre') return null
  if (p.tipo === 'ano') {
    const ano = Number(p.ref) - passos
    const fimMd = p.parcial ? p.fim.slice(5) : '12-31'
    const fim = fimMd === '02-29' ? `${ano}-02-28` : `${ano}-${fimMd}`
    return { tipo: 'ano', ref: String(ano), inicio: `${ano}-01-01`, fim, rotulo: String(ano), parcial: p.parcial }
  }
  const mes = somarMeses(p.ref, -passos)
  const [a, m] = mes.split('-').map(Number)
  const ultimo = ultimoDiaDoMes(a, m)
  const dia = p.parcial ? Math.min(Number(p.fim.slice(8, 10)), ultimo) : ultimo
  return { tipo: 'mes', ref: mes, inicio: `${mes}-01`, fim: `${mes}-${pad2(dia)}`, rotulo: rotuloMes(mes), parcial: p.parcial }
}

export type ResumoPeriodo = {
  receita: number
  bruto: number
  descontos: number
  taxaDesconto: number
  pagamentos: number
  ticketMedio: number
  clientesPagantes: number
  receitaPorCliente: number
  porEstudio: Map<number, number>
  porMetodo: Map<string, number>
  porPlano: Map<string | null, number>
  receitaClientes: number
  receitaOutras: number
  porOutras: Map<string, number>
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function resumirPeriodo(pagamentos: PagamentoAnalise[], inicio: string, fim: string): ResumoPeriodo {
  let receita = 0
  let receitaOutras = 0
  let descontos = 0
  let n = 0
  const clientes = new Set<string>()
  const porEstudio = new Map<number, number>()
  const porMetodo = new Map<string, number>()
  const porPlano = new Map<string | null, number>()
  const porOutras = new Map<string, number>()
  for (const p of pagamentos) {
    if (p.data_pagamento < inicio || p.data_pagamento > fim) continue
    receita += p.valor
    descontos += p.desconto
    porEstudio.set(p.estudio_id, (porEstudio.get(p.estudio_id) ?? 0) + p.valor)
    const metodo = normalizarMetodo(p.metodo)
    porMetodo.set(metodo, (porMetodo.get(metodo) ?? 0) + p.valor)
    if (p.outra) {
      receitaOutras += p.valor
      porOutras.set(p.outra, (porOutras.get(p.outra) ?? 0) + p.valor)
      continue
    }
    n++
    clientes.add(p.cliente_id)
    porPlano.set(p.plano_id, (porPlano.get(p.plano_id) ?? 0) + p.valor)
  }
  const bruto = receita + descontos
  const receitaClientes = receita - receitaOutras
  return {
    receita: r2(receita),
    bruto: r2(bruto),
    descontos: r2(descontos),
    taxaDesconto: bruto > 0 ? descontos / bruto : 0,
    pagamentos: n,
    ticketMedio: n > 0 ? receitaClientes / n : 0,
    clientesPagantes: clientes.size,
    receitaPorCliente: clientes.size > 0 ? receitaClientes / clientes.size : 0,
    porEstudio,
    porMetodo,
    porPlano,
    receitaClientes: r2(receitaClientes),
    receitaOutras: r2(receitaOutras),
    porOutras,
  }
}

// O histórico traz o mesmo método escrito de várias formas ("MBWay",
// "MB WAY", "numerário", "Transferência bancária"…).
export function normalizarMetodo(metodo: string | null): string {
  const m = (metodo ?? '').trim()
  if (!m) return 'Não indicado'
  const chave = m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')
  if (chave === 'mbway') return 'MB Way'
  if (chave === 'numerario') return 'Numerário'
  if (chave.startsWith('transferencia')) return 'Transferência'
  if (chave === 'tpa' || chave === 'multibanco') return 'Multibanco'
  return m
}

export function variacao(atual: number, anterior: number | null | undefined): number | null {
  if (anterior == null || anterior === 0) return null
  return (atual - anterior) / Math.abs(anterior)
}

// Receita por mês (e por estúdio), para os meses pedidos.
export function receitaMensal(
  pagamentos: PagamentoAnalise[],
  meses: string[]
): { total: number[]; porEstudio: Map<number, number[]>; descontos: number[]; pagamentos: number[] } {
  const idx = new Map(meses.map((m, i) => [m, i]))
  const total = meses.map(() => 0)
  const descontos = meses.map(() => 0)
  const n = meses.map(() => 0)
  const porEstudio = new Map<number, number[]>()
  for (const p of pagamentos) {
    const i = idx.get(p.data_pagamento.slice(0, 7))
    if (i === undefined) continue
    total[i] += p.valor
    descontos[i] += p.desconto
    if (!p.outra) n[i]++
    const linha = porEstudio.get(p.estudio_id) ?? meses.map(() => 0)
    linha[i] += p.valor
    porEstudio.set(p.estudio_id, linha)
  }
  return { total: total.map(r2), porEstudio, descontos: descontos.map(r2), pagamentos: n }
}

export type BaseMes = { mes: string; ativos: number; novos: number; perdidos: number; reativados: number; churn: number | null }

// Base de clientes por mês. Um cliente está "ativo" num mês se algum
// pagamento seu o cobre nesse mês (pago até ao fim do mês e válido
// pelo menos até ao início do mês). Novo = primeiro pagamento de
// sempre nesse mês; perdido = ativo no mês anterior e já não neste;
// reativado = volta depois de pelo menos um mês sem cobertura.
export function baseClientesMensal(pagamentos: PagamentoAnalise[], meses: string[]): BaseMes[] {
  if (meses.length === 0) return []
  const anteriorAoPrimeiro = somarMeses(meses[0], -1)
  const todos = [anteriorAoPrimeiro, ...meses]
  const idx = new Map(todos.map((m, i) => [m, i]))
  const ativoEm = new Map<string, Uint8Array>()
  const primeiro = new Map<string, string>()
  for (const p of pagamentos) {
    const mesPag = p.data_pagamento.slice(0, 7)
    const p0 = primeiro.get(p.cliente_id)
    if (!p0 || mesPag < p0) primeiro.set(p.cliente_id, mesPag)
    const deM = mesPag < todos[0] ? todos[0] : mesPag
    const ateM = p.valido_ate.slice(0, 7) > todos[todos.length - 1] ? todos[todos.length - 1] : p.valido_ate.slice(0, 7)
    if (deM > ateM) continue
    let linha = ativoEm.get(p.cliente_id)
    if (!linha) {
      linha = new Uint8Array(todos.length)
      ativoEm.set(p.cliente_id, linha)
    }
    for (let i = idx.get(deM)!; i <= idx.get(ateM)!; i++) linha[i] = 1
  }
  const base: BaseMes[] = []
  for (let i = 1; i < todos.length; i++) {
    let ativos = 0
    let ativosAntes = 0
    let novos = 0
    let perdidos = 0
    let reativados = 0
    for (const [cliente, linha] of ativoEm) {
      if (linha[i - 1]) ativosAntes++
      if (linha[i]) {
        ativos++
        if (!linha[i - 1]) {
          if (primeiro.get(cliente) === todos[i]) novos++
          else reativados++
        }
      } else if (linha[i - 1]) {
        perdidos++
      }
    }
    base.push({ mes: todos[i], ativos, novos, perdidos, reativados, churn: ativosAntes > 0 ? perdidos / ativosAntes : null })
  }
  return base
}

export type Estatisticas = { media: number; mediana: number; desvio: number; cv: number; min: number; max: number; soma: number }

export function estatisticas(valores: number[]): Estatisticas {
  if (valores.length === 0) return { media: 0, mediana: 0, desvio: 0, cv: 0, min: 0, max: 0, soma: 0 }
  const soma = valores.reduce((a, b) => a + b, 0)
  const media = soma / valores.length
  const ord = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ord.length / 2)
  const mediana = ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2
  const desvio = Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length)
  return { media, mediana, desvio, cv: media ? desvio / media : 0, min: ord[0], max: ord[ord.length - 1], soma }
}

// Regressão linear simples (mínimos quadrados) sobre índices 0..n-1.
export function regressaoLinear(valores: number[]): { declive: number; intercecao: number; r2: number } {
  const n = valores.length
  if (n < 2) return { declive: 0, intercecao: valores[0] ?? 0, r2: 0 }
  const mx = (n - 1) / 2
  const my = valores.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  valores.forEach((y, x) => {
    sxy += (x - mx) * (y - my)
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
  })
  const declive = sxx ? sxy / sxx : 0
  const intercecao = my - declive * mx
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0
  return { declive, intercecao, r2 }
}

export function mediaMovel(valores: number[], janela: number): (number | null)[] {
  return valores.map((_, i) => {
    if (i < janela - 1) return null
    const fatia = valores.slice(i - janela + 1, i + 1)
    return fatia.reduce((a, b) => a + b, 0) / janela
  })
}

// Índice sazonal de cada mês do calendário (1 = mês médio), a partir
// dos anos completos: peso do mês no total desse ano × 12, em média.
export function indicesSazonais(serie: { mes: string; receita: number }[]): number[] {
  const porAno = new Map<string, number[]>()
  for (const { mes, receita } of serie) {
    const linha = porAno.get(mes.slice(0, 4)) ?? Array(12).fill(NaN)
    linha[Number(mes.slice(5, 7)) - 1] = receita
    porAno.set(mes.slice(0, 4), linha)
  }
  const completos = [...porAno.values()].filter((l) => l.every((v) => Number.isFinite(v) && v > 0))
  if (completos.length === 0) return Array(12).fill(1)
  const indices = Array(12).fill(0)
  for (const l of completos) {
    const media = l.reduce((a, b) => a + b, 0) / 12
    l.forEach((v, i) => (indices[i] += v / media))
  }
  return indices.map((v) => v / completos.length)
}

// Projeção dos próximos `n` meses: tendência linear dos últimos (até)
// 24 meses fechados, sem o efeito sazonal, e depois o padrão sazonal
// volta a ser aplicado a cada mês projetado.
export function projetarReceita(
  serie: { mes: string; receita: number }[],
  n: number,
  indices: number[]
): { mes: string; receita: number }[] {
  if (serie.length === 0) return []
  const base = serie.slice(-24)
  const idx = (mes: string) => indices[Number(mes.slice(5, 7)) - 1] || 1
  const dessaz = base.map((s) => s.receita / idx(s.mes))
  const { declive, intercecao } = regressaoLinear(dessaz)
  const ultimo = base[base.length - 1].mes
  return Array.from({ length: n }, (_, k) => {
    const mes = somarMeses(ultimo, k + 1)
    const t = base.length + k
    return { mes, receita: r2(Math.max(0, (intercecao + declive * t) * idx(mes))) }
  })
}

export function cagr(inicial: number, final: number, anos: number): number | null {
  if (inicial <= 0 || final <= 0 || anos <= 0) return null
  return (final / inicial) ** (1 / anos) - 1
}

export type FormatoValor = 'eur' | 'num' | 'pct'

// Formato curto para eixos ("€12,5k") ou completo ("€12 345").
export function formatarValor(v: number, formato: FormatoValor, compacto = false): string {
  if (formato === 'pct') return `${(v * 100).toFixed(1).replace('.', ',')}%`
  const abs = Math.abs(v)
  const sinal = v < 0 ? '−' : ''
  if (compacto && abs >= 1000) {
    const k = abs >= 100000 ? Math.round(abs / 1000) : Math.round(abs / 100) / 10
    return `${sinal}${formato === 'eur' ? '€' : ''}${String(k).replace('.', ',')}k`
  }
  // Separador de milhares sempre (o pt-PT do browser não agrupa 4 dígitos).
  const txt = String(Math.round(abs)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return `${sinal}${formato === 'eur' ? '€' : ''}${txt}`
}


const DIA_MS = 86_400_000
const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS)

// MRR normalizado: para cada cliente coberto hoje, o pagamento que o
// cobre dividido pelos meses que cobre (um trimestral de €270 conta
// €90/mês). Extras pagos no próprio dia (seguro, inscrição) não contam
// como recorrentes quando o cliente tem uma mensalidade a cobri-lo.
export function mrrNormalizado(
  pagamentos: PagamentoAnalise[],
  hoje: string
): { mrr: number; cobertos: number; porEstudio: Map<number, number> } {
  const cobre = new Map<string, PagamentoAnalise>()
  for (const p of pagamentos) {
    if (p.data_pagamento > hoje || p.valido_ate < hoje) continue
    const atual = cobre.get(p.cliente_id)
    const recorrente = p.valido_ate > p.data_pagamento
    const atualRecorrente = atual ? atual.valido_ate > atual.data_pagamento : false
    if (!atual || (recorrente && !atualRecorrente) || (recorrente === atualRecorrente && p.valido_ate > atual.valido_ate)) {
      cobre.set(p.cliente_id, p)
    }
  }
  let mrr = 0
  const porEstudio = new Map<number, number>()
  for (const p of cobre.values()) {
    const meses = Math.max(1, Math.round(diasEntre(p.data_pagamento, p.valido_ate) / 30.44))
    const v = p.valor / meses
    mrr += v
    porEstudio.set(p.estudio_id, (porEstudio.get(p.estudio_id) ?? 0) + v)
  }
  return { mrr: r2(mrr), cobertos: cobre.size, porEstudio }
}
