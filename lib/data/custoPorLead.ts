import type { SupabaseClient } from '@supabase/supabase-js'

// Custo por lead: o que se gastou em anúncios (Meta, etc.) a dividir
// pelas leads que entraram.
//
// O gasto em anúncios vem das Despesas — a linha "MKT - Anúncios" da
// categoria "Publicidade / Marketing". O resto do marketing (gestão de
// redes sociais, site, fotos…) não entra: não é o que se paga para cada
// lead chegar.
//
// Só contam os meses em que há as duas coisas registadas (anúncios e
// leads): dividir um ano de anúncios pelas leads de um mês dava um
// custo por lead absurdo. E com poucas leads não se dá número nenhum.

export const MIN_LEADS_CUSTO_POR_LEAD = 5

export function ehAnuncio(d: { categoria: string; subcategoria: string | null }): boolean {
  return d.categoria.startsWith('Publicidade') && /an[úu]ncio/i.test(d.subcategoria ?? '')
}

export type MesDeAnuncios = { mes: string; anuncios: number; leads: number; aDecorrer: boolean }

export type CustoPorLead = {
  // € por lead, ou null se ainda não dá para calcular.
  valor: number | null
  // Os meses que entraram na conta e os totais deles.
  meses: MesDeAnuncios[]
  anuncios: number
  leads: number
  // Porque não há valor: sem anúncios registados nos meses com leads, ou
  // ainda poucas leads.
  motivo: 'ok' | 'sem-anuncios' | 'poucas-leads'
}

const arredondar = (v: number) => Math.round(v * 100) / 100

// "ultimosMeses": quantos meses para trás se olha, contando com o atual.
export function calcularCustoPorLead(
  anuncios: { data: string; valor: number }[],
  leads: { data: string }[],
  mesAtual: string,
  ultimosMeses = 6
): CustoPorLead {
  const [ano, mes] = mesAtual.split('-').map(Number)
  const janela = Array.from({ length: ultimosMeses }, (_, i) => {
    const total = ano * 12 + (mes - 1) - (ultimosMeses - 1 - i)
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
  })
  const porMes = janela.map((m) => ({
    mes: m,
    anuncios: arredondar(anuncios.filter((a) => a.data.slice(0, 7) === m).reduce((s, a) => s + a.valor, 0)),
    leads: leads.filter((l) => l.data.slice(0, 7) === m).length,
    aDecorrer: m === mesAtual,
  }))
  const meses = porMes.filter((m) => m.anuncios > 0 && m.leads > 0)
  const totalAnuncios = arredondar(meses.reduce((s, m) => s + m.anuncios, 0))
  const totalLeads = meses.reduce((s, m) => s + m.leads, 0)
  if (meses.length === 0) return { valor: null, meses, anuncios: 0, leads: 0, motivo: porMes.some((m) => m.leads > 0) ? 'sem-anuncios' : 'poucas-leads' }
  if (totalLeads < MIN_LEADS_CUSTO_POR_LEAD) return { valor: null, meses, anuncios: totalAnuncios, leads: totalLeads, motivo: 'poucas-leads' }
  return { valor: arredondar(totalAnuncios / totalLeads), meses, anuncios: totalAnuncios, leads: totalLeads, motivo: 'ok' }
}

const MESES_CURTOS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
const nomeCurto = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`
const eur = (v: number) => `${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

// Uma frase que diz de onde vem o número (ou porque não há número).
export function explicarCustoPorLead(c: CustoPorLead): string {
  if (c.valor == null) {
    return c.motivo === 'sem-anuncios'
      ? 'Ainda não dá para calcular o custo por lead: nos meses em que há leads registadas não há despesa de "MKT - Anúncios" lançada.'
      : `Ainda não dá para calcular o custo por lead: são precisas pelo menos ${MIN_LEADS_CUSTO_POR_LEAD} leads em meses com anúncios lançados nas Despesas${c.leads > 0 ? ` (há ${c.leads})` : ''}.`
  }
  const periodo = c.meses.length === 1 ? nomeCurto(c.meses[0].mes) : `${nomeCurto(c.meses[0].mes)} a ${nomeCurto(c.meses[c.meses.length - 1].mes)}`
  const aDecorrer = c.meses.some((m) => m.aDecorrer)
  return `${eur(c.valor)} por lead: ${eur(c.anuncios)} de anúncios (Despesas → MKT - Anúncios) ÷ ${c.leads} leads, ${periodo}${aDecorrer ? ' — inclui o mês a decorrer, por isso ainda pode mudar' : ''}.`
}

// Lê os anúncios e as leads dos estúdios dados e faz a conta. As
// despesas só são visíveis à administração: noutra conta não vem nada e
// o resultado fica sem valor. Nunca parte a página.
export async function carregarCustoPorLead(supabase: SupabaseClient, estudioIds: number[], hoje: string, ultimosMeses = 6): Promise<CustoPorLead> {
  const mesAtual = hoje.slice(0, 7)
  const vazio: CustoPorLead = { valor: null, meses: [], anuncios: 0, leads: 0, motivo: 'sem-anuncios' }
  if (estudioIds.length === 0) return vazio
  const [ano, mes] = mesAtual.split('-').map(Number)
  const total = ano * 12 + (mes - 1) - (ultimosMeses - 1)
  const inicio = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
  const [despesas, leads] = await Promise.all([
    supabase
      .from('despesas')
      .select('data, valor, categoria, subcategoria')
      .in('estudio_id', estudioIds)
      .is('anulado_em', null)
      .like('categoria', 'Publicidade%')
      .gte('data', inicio)
      .limit(5000),
    supabase.from('leads').select('entrada, criado_em').in('estudio_id', estudioIds).or(`entrada.gte.${inicio},criado_em.gte.${inicio}`).limit(10000),
  ])
  if (despesas.error || leads.error) return vazio
  return calcularCustoPorLead(
    ((despesas.data ?? []) as { data: string; valor: number | string; categoria: string; subcategoria: string | null }[])
      .filter(ehAnuncio)
      .map((d) => ({ data: d.data, valor: Number(d.valor) })),
    ((leads.data ?? []) as { entrada: string | null; criado_em: string }[]).map((l) => ({ data: (l.entrada ?? l.criado_em).slice(0, 10) })),
    mesAtual,
    ultimosMeses
  )
}
