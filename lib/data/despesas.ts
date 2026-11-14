import type { SupabaseClient } from '@supabase/supabase-js'

// Gestão de despesas (só Administração). As receitas vêm sempre dos
// pagamentos registados pelos instrutores; aqui só se lançam os gastos.

export const PERIODICIDADES = [
  { valor: 'mensal', rotulo: 'Mensal', meses: 1 },
  { valor: 'bimestral', rotulo: 'De 2 em 2 meses', meses: 2 },
  { valor: 'trimestral', rotulo: 'Trimestral', meses: 3 },
  { valor: 'semestral', rotulo: 'Semestral', meses: 6 },
  { valor: 'anual', rotulo: 'Anual', meses: 12 },
] as const
export type Periodicidade = (typeof PERIODICIDADES)[number]['valor']

export const CATEGORIA_AJUSTE = 'Ajuste de reconciliação (Excel)'
export const DIAS_AVISO_OMISSAO = 3

export type DespesaRecorrente = {
  id: string
  estudio_id: number
  categoria: string
  subcategoria: string | null
  descricao: string | null
  valor: number
  periodicidade: Periodicidade
  dia_vencimento: number
  inicio: string
  fim: string | null
  dias_aviso: number
  ativo: boolean
}

export type DespesaLinha = {
  id: string
  estudio_id: number
  data: string
  categoria: string
  subcategoria: string | null
  descricao: string | null
  valor: number
  origem: string
  pago: boolean
  vencimento: string | null
  pago_em: string | null
  dias_aviso: number | null
  recorrente_id: string | null
}

export type EstadoDespesa = 'paga' | 'em_atraso' | 'a_vencer' | 'por_pagar'

const mesesPor = (p: Periodicidade) => PERIODICIDADES.find((x) => x.valor === p)?.meses ?? 1

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate() // mes 1-12
}

// "AAAA-MM" + dia → data, encostada ao último dia quando o mês é curto
// (dia 31 em fevereiro → 28/29).
export function dataNoMes(mes: string, dia: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = Math.min(dia, ultimoDiaDoMes(a, m))
  return `${mes}-${String(d).padStart(2, '0')}`
}

export function somarMesesISO(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function subtrairDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

// Vencimentos de uma recorrente entre duas datas (inclusive). O ciclo
// conta a partir do mês de "inicio"; o primeiro vencimento nunca é
// anterior a "inicio".
export function vencimentosEntre(
  rec: Pick<DespesaRecorrente, 'periodicidade' | 'dia_vencimento' | 'inicio' | 'fim'>,
  de: string,
  ate: string
): string[] {
  const passo = mesesPor(rec.periodicidade)
  const limite = rec.fim && rec.fim < ate ? rec.fim : ate
  const res: string[] = []
  let mes = rec.inicio.slice(0, 7)
  for (let i = 0; i < 600; i++) {
    const v = dataNoMes(mes, rec.dia_vencimento)
    if (v > limite) break
    if (v >= rec.inicio && v >= de) res.push(v)
    mes = somarMesesISO(mes, passo)
  }
  return res
}

// Primeiro vencimento a partir de hoje — sugestão para o "a partir de"
// de uma recorrente nova (evita duplicar o mês que já foi lançado).
export function proximoVencimento(dia: number, hoje: string): string {
  const esteMes = dataNoMes(hoje.slice(0, 7), dia)
  return esteMes >= hoje ? esteMes : dataNoMes(somarMesesISO(hoje.slice(0, 7), 1), dia)
}

export function vencimentoDe(d: Pick<DespesaLinha, 'vencimento' | 'data'>): string {
  return d.vencimento ?? d.data
}

// Data a partir da qual a despesa aparece nos avisos.
export function dataAviso(d: Pick<DespesaLinha, 'vencimento' | 'data' | 'dias_aviso'>): string {
  return subtrairDias(vencimentoDe(d), d.dias_aviso ?? DIAS_AVISO_OMISSAO)
}

export function estadoDespesa(d: Pick<DespesaLinha, 'pago' | 'vencimento' | 'data' | 'dias_aviso'>, hoje: string): EstadoDespesa {
  if (d.pago) return 'paga'
  const venc = vencimentoDe(d)
  if (venc < hoje) return 'em_atraso'
  if (dataAviso(d) <= hoje) return 'a_vencer'
  return 'por_pagar'
}

export const ROTULO_ESTADO: Record<EstadoDespesa, string> = {
  paga: 'Paga',
  em_atraso: 'Em atraso',
  a_vencer: 'A vencer',
  por_pagar: 'Por pagar',
}

export type BalancoMes = {
  total: number
  pago: number
  porPagar: number
  emAtraso: number
  nPorPagar: number
  nEmAtraso: number
  porCategoria: { categoria: string; total: number; pago: number; porPagar: number }[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function balancoMes(
  despesas: Pick<DespesaLinha, 'categoria' | 'valor' | 'pago' | 'vencimento' | 'data' | 'dias_aviso'>[],
  hoje: string,
  ordemCategorias: string[] = []
): BalancoMes {
  let total = 0
  let pago = 0
  let porPagar = 0
  let emAtraso = 0
  let nPorPagar = 0
  let nEmAtraso = 0
  const cats = new Map<string, { total: number; pago: number; porPagar: number }>()
  for (const d of despesas) {
    total += d.valor
    const c = cats.get(d.categoria) ?? { total: 0, pago: 0, porPagar: 0 }
    c.total += d.valor
    if (d.pago) {
      pago += d.valor
      c.pago += d.valor
    } else {
      porPagar += d.valor
      c.porPagar += d.valor
      nPorPagar++
      if (estadoDespesa(d, hoje) === 'em_atraso') {
        emAtraso += d.valor
        nEmAtraso++
      }
    }
    cats.set(d.categoria, c)
  }
  const pos = (cat: string) => {
    const i = ordemCategorias.indexOf(cat)
    return i < 0 ? 999 : i
  }
  return {
    total: r2(total),
    pago: r2(pago),
    porPagar: r2(porPagar),
    emAtraso: r2(emAtraso),
    nPorPagar,
    nEmAtraso,
    porCategoria: [...cats.entries()]
      .map(([categoria, v]) => ({ categoria, total: r2(v.total), pago: r2(v.pago), porPagar: r2(v.porPagar) }))
      .sort((a, b) => pos(a.categoria) - pos(b.categoria) || b.total - a.total),
  }
}

// Sugestões de recorrentes a partir do histórico: subcategorias que
// aparecem em pelo menos 6 dos últimos 12 meses fechados, com o valor
// médio e o estúdio. Só para ajudar a criar as primeiras recorrentes.
export function sugerirRecorrentes(
  despesas: Pick<DespesaLinha, 'estudio_id' | 'data' | 'categoria' | 'subcategoria' | 'valor'>[],
  mesAtual: string,
  existentes: Pick<DespesaRecorrente, 'estudio_id' | 'categoria' | 'subcategoria'>[]
) {
  const de = somarMesesISO(mesAtual, -12)
  const grupos = new Map<string, { estudio_id: number; categoria: string; subcategoria: string; meses: Set<string>; soma: number }>()
  for (const d of despesas) {
    const mes = d.data.slice(0, 7)
    if (mes < de || mes >= mesAtual || !d.subcategoria || d.categoria === CATEGORIA_AJUSTE || d.valor <= 0) continue
    const chave = `${d.estudio_id}|${d.categoria}|${d.subcategoria}`
    const g = grupos.get(chave) ?? { estudio_id: d.estudio_id, categoria: d.categoria, subcategoria: d.subcategoria, meses: new Set(), soma: 0 }
    g.meses.add(mes)
    g.soma += d.valor
    grupos.set(chave, g)
  }
  const jaExiste = new Set(existentes.map((e) => `${e.estudio_id}|${e.categoria}|${e.subcategoria ?? ''}`))
  return [...grupos.entries()]
    .filter(([chave, g]) => g.meses.size >= 6 && !jaExiste.has(chave))
    .map(([, g]) => ({
      estudio_id: g.estudio_id,
      categoria: g.categoria,
      subcategoria: g.subcategoria,
      meses: g.meses.size,
      valorMedio: r2(g.soma / g.meses.size),
    }))
    .sort((a, b) => b.valorMedio - a.valorMedio)
}

// Cria as ocorrências das recorrentes ativas com vencimento até ao fim
// do mês seguinte (o balanço do mês já mostra o que vem aí). Idempotente
// — o índice único (recorrente_id, vencimento) impede duplicados, e uma
// ocorrência anulada nunca volta a ser criada. Corre no cron horário
// dos alertas e ao abrir a página das despesas.
export async function gerarDespesasRecorrentes(supabase: SupabaseClient, hoje: string): Promise<number> {
  const { data: recs, error } = await supabase.from('despesas_recorrentes').select('*').eq('ativo', true)
  if (error) throw new Error(error.message)
  if (!recs?.length) return 0
  const de = `${hoje.slice(0, 7)}-01`
  const ate = dataNoMes(somarMesesISO(hoje.slice(0, 7), 1), 31)

  const { data: existentes, error: erroEx } = await supabase
    .from('despesas')
    .select('recorrente_id, vencimento')
    .in('recorrente_id', recs.map((r) => r.id))
    .gte('vencimento', de)
  if (erroEx) throw new Error(erroEx.message)
  const ja = new Set((existentes ?? []).map((e) => `${e.recorrente_id}|${e.vencimento}`))

  const novas = []
  for (const r of recs as DespesaRecorrente[]) {
    for (const v of vencimentosEntre(r, de, ate)) {
      if (ja.has(`${r.id}|${v}`)) continue
      novas.push({
        estudio_id: r.estudio_id,
        data: v,
        vencimento: v,
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        descricao: r.descricao,
        valor: r.valor,
        origem: 'recorrente',
        pago: false,
        dias_aviso: r.dias_aviso,
        recorrente_id: r.id,
      })
    }
  }
  if (!novas.length) return 0
  const { error: erroIns } = await supabase.from('despesas').insert(novas)
  if (!erroIns) return novas.length
  // 23505 = outra corrida (cron + página aberta ao mesmo tempo) já criou
  // alguma: insere uma a uma e ignora só as repetidas.
  if (erroIns.code !== '23505') throw new Error(erroIns.message)
  let criadas = 0
  for (const nova of novas) {
    const { error: e } = await supabase.from('despesas').insert(nova)
    if (!e) criadas++
    else if (e.code !== '23505') throw new Error(e.message)
  }
  return criadas
}

export type AvisoDespesa = Pick<DespesaLinha, 'id' | 'estudio_id' | 'categoria' | 'subcategoria' | 'descricao' | 'valor'> & {
  vencimento: string
  estado: EstadoDespesa
}

// Despesas por pagar cujo aviso já disparou (ou que já venceram).
export async function listarAvisosDespesas(supabase: SupabaseClient, hoje: string): Promise<AvisoDespesa[]> {
  const { data, error } = await supabase
    .from('despesas')
    .select('id, estudio_id, data, categoria, subcategoria, descricao, valor, pago, vencimento, dias_aviso')
    .eq('pago', false)
    .is('anulado_em', null)
    .order('data')
  if (error) return []
  return (data ?? [])
    .map((d) => ({ ...d, valor: Number(d.valor) }))
    .filter((d) => dataAviso(d) <= hoje)
    .map((d) => ({
      id: d.id,
      estudio_id: d.estudio_id,
      categoria: d.categoria,
      subcategoria: d.subcategoria,
      descricao: d.descricao,
      valor: d.valor,
      vencimento: vencimentoDe(d),
      estado: estadoDespesa(d, hoje),
    }))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}

export function hojeEmLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(agora)
}
