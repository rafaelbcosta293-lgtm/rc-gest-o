import type { SupabaseClient } from '@supabase/supabase-js'
import {
  estadoDespesa,
  subtrairDias,
  vencimentoDe,
  vencimentosEntre,
  type DespesaRecorrente,
  type EstadoDespesa,
  type Periodicidade,
} from './despesas'

// Calendário da Administração: num só sítio, por dia, o que há para
// tratar — despesas já lançadas (pagas ou por pagar), despesas
// recorrentes que ainda vão ser lançadas ("previstas") e lembretes
// escritos à mão (tarefas, pagamentos…), únicos ou que se repetem.

export const TIPOS_LEMBRETE = [
  { valor: 'tarefa', rotulo: 'Tarefa' },
  { valor: 'pagamento', rotulo: 'Pagamento' },
  { valor: 'outro', rotulo: 'Outro' },
] as const
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number]['valor']

export const REPETICOES = [
  { valor: 'unica', rotulo: 'Não repete' },
  { valor: 'semanal', rotulo: 'Todas as semanas' },
  { valor: 'mensal', rotulo: 'Todos os meses' },
  { valor: 'bimestral', rotulo: 'De 2 em 2 meses' },
  { valor: 'trimestral', rotulo: 'De 3 em 3 meses' },
  { valor: 'semestral', rotulo: 'De 6 em 6 meses' },
  { valor: 'anual', rotulo: 'Todos os anos' },
] as const
export type Repeticao = (typeof REPETICOES)[number]['valor']

export type Lembrete = {
  id: string
  titulo: string
  tipo: TipoLembrete
  data: string
  periodicidade: Repeticao
  fim: string | null
  valor: number | null
  notas: string | null
  estudio_id: number | null
}

export function somarDiasISO(dataISO: string, dias: number): string {
  return subtrairDias(dataISO, -dias)
}

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)

// Datas em que um lembrete cai entre "de" e "ate" (inclusive). Um
// lembrete mensal criado a dia 31 cai no último dia dos meses mais
// curtos, tal como as despesas recorrentes.
export function ocorrenciasLembrete(l: Pick<Lembrete, 'data' | 'periodicidade' | 'fim'>, de: string, ate: string): string[] {
  const limite = l.fim && l.fim < ate ? l.fim : ate
  if (l.periodicidade === 'unica') return l.data >= de && l.data <= ate ? [l.data] : []
  if (l.periodicidade === 'semanal') {
    const res: string[] = []
    // Salta logo para a primeira semana que interessa, em vez de
    // percorrer todas desde a data inicial.
    const saltar = l.data >= de ? 0 : Math.ceil(diasEntre(l.data, de) / 7)
    for (let d = somarDiasISO(l.data, saltar * 7); d <= limite; d = somarDiasISO(d, 7)) res.push(d)
    return res
  }
  return vencimentosEntre(
    { periodicidade: l.periodicidade as Periodicidade, dia_vencimento: Number(l.data.slice(8, 10)), inicio: l.data, fim: l.fim },
    de,
    ate
  )
}

export type ItemCalendario =
  | {
      origem: 'despesa'
      chave: string
      data: string
      titulo: string
      valor: number
      estado: EstadoDespesa
      despesaId: string
      estudioId: number
    }
  | { origem: 'prevista'; chave: string; data: string; titulo: string; valor: number; estudioId: number }
  | {
      origem: 'lembrete'
      chave: string
      data: string
      titulo: string
      valor: number | null
      feito: boolean
      lembreteId: string
      tipo: TipoLembrete
      repete: boolean
      notas: string | null
      estudioId: number | null
    }

// true se o item ainda pede ação (por pagar / por fazer).
export function porTratar(item: ItemCalendario): boolean {
  if (item.origem === 'despesa') return item.estado !== 'paga'
  if (item.origem === 'lembrete') return !item.feito
  return true
}

type LinhaDespesa = {
  id: string
  estudio_id: number
  data: string
  categoria: string
  subcategoria: string | null
  descricao: string | null
  valor: number
  pago: boolean
  vencimento: string | null
  dias_aviso: number | null
  recorrente_id: string | null
  anulado_em: string | null
}

// Junta as três origens numa lista só, por data. Função pura: recebe o
// que veio da base de dados e devolve os itens do intervalo.
export function montarItensCalendario(
  dados: {
    despesas: LinhaDespesa[]
    recorrentes: DespesaRecorrente[]
    lembretes: Lembrete[]
    feitos: { lembrete_id: string; data: string }[]
  },
  de: string,
  ate: string,
  hoje: string
): ItemCalendario[] {
  const itens: ItemCalendario[] = []
  const rotulo = (d: { categoria: string; subcategoria: string | null; descricao: string | null }) =>
    d.subcategoria ?? d.descricao ?? d.categoria

  // Uma ocorrência de uma recorrente já lançada (mesmo que anulada)
  // nunca aparece também como "prevista".
  const jaLancadas = new Set<string>()
  for (const d of dados.despesas) {
    if (d.recorrente_id && d.vencimento) jaLancadas.add(`${d.recorrente_id}|${d.vencimento}`)
    if (d.anulado_em) continue
    const data = vencimentoDe(d)
    if (data < de || data > ate) continue
    itens.push({
      origem: 'despesa',
      chave: `d-${d.id}`,
      data,
      titulo: rotulo(d),
      valor: Number(d.valor),
      estado: estadoDespesa(d, hoje),
      despesaId: d.id,
      estudioId: d.estudio_id,
    })
  }

  for (const r of dados.recorrentes) {
    if (!r.ativo) continue
    for (const v of vencimentosEntre(r, de, ate)) {
      if (jaLancadas.has(`${r.id}|${v}`)) continue
      itens.push({ origem: 'prevista', chave: `p-${r.id}-${v}`, data: v, titulo: rotulo(r), valor: Number(r.valor), estudioId: r.estudio_id })
    }
  }

  const feitos = new Set(dados.feitos.map((f) => `${f.lembrete_id}|${f.data}`))
  for (const l of dados.lembretes) {
    for (const data of ocorrenciasLembrete(l, de, ate)) {
      itens.push({
        origem: 'lembrete',
        chave: `l-${l.id}-${data}`,
        data,
        titulo: l.titulo,
        valor: l.valor == null ? null : Number(l.valor),
        feito: feitos.has(`${l.id}|${data}`),
        lembreteId: l.id,
        tipo: l.tipo,
        repete: l.periodicidade !== 'unica',
        notas: l.notas,
        estudioId: l.estudio_id,
      })
    }
  }

  return itens.sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo, 'pt'))
}

const COLUNAS_LEMBRETE = 'id, titulo, tipo, data, periodicidade, fim, valor, notas, estudio_id'

export async function carregarItensCalendario(supabase: SupabaseClient, de: string, ate: string, hoje: string): Promise<ItemCalendario[]> {
  const [despesas, recorrentes, lembretes, feitos] = await Promise.all([
    supabase
      .from('despesas')
      .select('id, estudio_id, data, categoria, subcategoria, descricao, valor, pago, vencimento, dias_aviso, recorrente_id, anulado_em')
      .or(`and(vencimento.gte.${de},vencimento.lte.${ate}),and(vencimento.is.null,data.gte.${de},data.lte.${ate})`),
    supabase.from('despesas_recorrentes').select('*').eq('ativo', true),
    supabase.from('lembretes').select(COLUNAS_LEMBRETE).lte('data', ate).or(`fim.is.null,fim.gte.${de}`),
    supabase.from('lembretes_feitos').select('lembrete_id, data').gte('data', de).lte('data', ate),
  ])
  const erro = despesas.error ?? recorrentes.error ?? lembretes.error ?? feitos.error
  if (erro) throw new Error(erro.message)
  return montarItensCalendario(
    {
      despesas: (despesas.data ?? []) as LinhaDespesa[],
      recorrentes: (recorrentes.data ?? []) as DespesaRecorrente[],
      lembretes: (lembretes.data ?? []) as Lembrete[],
      feitos: feitos.data ?? [],
    },
    de,
    ate,
    hoje
  )
}

// Quantos dias para trás se continua a lembrar um lembrete que ficou por
// fazer (depois disso deixa de contar para o aviso do menu).
export const DIAS_LEMBRETE_ATRASADO = 60

// Lembretes de hoje ou já passados que ainda não foram dados como
// feitos — o número que aparece no menu ("Calendário (3)"). As despesas
// não entram aqui: têm o seu próprio aviso.
export async function contarLembretesPorTratar(supabase: SupabaseClient, hoje: string): Promise<number> {
  const de = somarDiasISO(hoje, -DIAS_LEMBRETE_ATRASADO)
  const [lembretes, feitos] = await Promise.all([
    supabase.from('lembretes').select(COLUNAS_LEMBRETE).lte('data', hoje).or(`fim.is.null,fim.gte.${de}`),
    supabase.from('lembretes_feitos').select('lembrete_id, data').gte('data', de).lte('data', hoje),
  ])
  // Um contador no menu nunca deve partir a página.
  if (lembretes.error || feitos.error) return 0
  return montarItensCalendario(
    { despesas: [], recorrentes: [], lembretes: (lembretes.data ?? []) as Lembrete[], feitos: feitos.data ?? [] },
    de,
    hoje,
    hoje
  ).filter(porTratar).length
}
