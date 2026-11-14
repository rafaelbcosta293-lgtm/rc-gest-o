import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { todasAsLinhas } from '@/lib/supabase/todasAsLinhas'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import { PALETA, corGraficoEstudio } from '@/lib/data/constantes'
import { agingDivida, parseValorConfig } from '@/lib/data/financeiro'
import {
  MESES_CURTOS,
  NOMES_MESES,
  baseClientesMensal,
  cagr,
  estatisticas,
  formatarValor,
  indicesSazonais,
  mediaMovel,
  mesesEntre,
  mrrNormalizado,
  periodoRecuado,
  projetarReceita,
  receitaMensal,
  regressaoLinear,
  resolverPeriodo,
  resumirPeriodo,
  rotuloMes,
  somarMeses,
  variacao,
  type PagamentoAnalise,
  type TipoPeriodo,
} from '@/lib/data/analiseFinanceira'
import PortaSenha from '@/components/PortaSenha'
import StatCard from '@/components/StatCard'
import GraficoFinanceiro from '@/components/GraficoFinanceiro'
import ExportarCsvButton from '@/components/ExportarCsvButton'

// Cores das séries (passos validados para fundo escuro — a
// Administração é sempre escura). Estúdios usam a sua cor própria.
const COR = {
  azul: '#3987e5',
  laranja: '#d95926',
  aqua: '#199e70',
  amarelo: '#c98500',
  magenta: '#d55181',
  verde: '#0ca30c',
  violeta: '#9085e9',
  vermelho: '#e66767',
  cinza: '#7c8594',
}
const CORES_MIX = [COR.azul, COR.laranja, COR.aqua, COR.amarelo, COR.magenta, COR.verde, COR.violeta, COR.vermelho]

const eur = (v: number) => formatarValor(v, 'eur')
const eur2 = (v: number) => `€${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number | null, casas = 1) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(casas).replace('.', ',')}%`
const pctSimples = (v: number, casas = 1) => `${(v * 100).toFixed(casas).replace('.', ',')}%`
const tendencia = (v: number | null, label: string) =>
  v == null ? undefined : { valor: Math.round(v * 1000) / 10, label: `% ${label}` }

type LinhaPagamento = {
  cliente_id: string
  valor: number | string
  desconto: number | string | null
  metodo: string | null
  plano_id: string | null
  data_pagamento: string
  valido_ate: string
  clientes: { estudio_id: number } | { estudio_id: number }[]
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; estudio?: string; periodo?: string; ref?: string }>
}) {
  const { erroSenha, estudio: estudioParam, periodo: periodoParam, ref } = await searchParams
  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha titulo="Administração — Financeiro" destino="/painel/admin/financeiro" action={desbloquearAdmin} erro={erroSenha} />
    )
  }

  const todosEstudios = await getEstudios(supabase)
  const estudios = filtrarPorEstudio(todosEstudios, estudioParam)
  const idsEstudios = new Set(estudios.map((e) => e.id))
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date())
  const tipo: TipoPeriodo = periodoParam === 'ano' || periodoParam === 'sempre' ? periodoParam : 'mes'

  const [
    { data: pagamentosData, error: erroPagamentos },
    { data: clientesData, error: erroClientes },
    { data: planosData },
    { data: comprasData },
    { data: outrosData },
    { data: registosData },
    { data: configData },
  ] = await Promise.all([
    todasAsLinhas<LinhaPagamento>(
      (de, ate) =>
        supabase
          .from('pagamentos_ativos')
          .select('cliente_id, valor, desconto, metodo, plano_id, data_pagamento, valido_ate, clientes!inner(estudio_id)')
          .order('id')
          .range(de, ate),
      { emParalelo: 6 }
    ),
    todasAsLinhas<{ id: string; estudio_id: number; estado: string }>(
      (de, ate) => supabase.from('clientes').select('id, estudio_id, estado').order('id').range(de, ate),
      { emParalelo: 2 }
    ),
    supabase.from('planos').select('id, nome'),
    todasAsLinhas<{ estudio_id: number; data: string; valor: number }>((de, ate) =>
      supabase.from('saidas_caixa_ativas').select('estudio_id, data, valor').eq('tipo', 'Compra').order('id').range(de, ate)
    ),
    todasAsLinhas<{ estudio_id: number; data: string; valor: number }>((de, ate) =>
      supabase.from('outros_caixa_ativos').select('estudio_id, data, valor').eq('tipo', 'Saída').order('id').range(de, ate)
    ),
    todasAsLinhas<{ estudio_id: number; data: string; horas: number }>(
      (de, ate) => supabase.from('registos_pt').select('estudio_id, data, horas').order('id').range(de, ate),
      { emParalelo: 3 }
    ),
    supabase.from('config').select('valor').eq('chave', 'custo_hora_pt').maybeSingle(),
  ])
  if (erroPagamentos) throw new Error(erroPagamentos.message)
  if (erroClientes) throw new Error(erroClientes.message)

  // ── Dados base ────────────────────────────────────────────────────
  const pagamentos: PagamentoAnalise[] = []
  for (const p of pagamentosData) {
    const c = Array.isArray(p.clientes) ? p.clientes[0] : p.clientes
    if (!c || !idsEstudios.has(c.estudio_id)) continue
    pagamentos.push({
      cliente_id: p.cliente_id,
      estudio_id: c.estudio_id,
      valor: Number(p.valor),
      desconto: Number(p.desconto ?? 0),
      metodo: p.metodo,
      plano_id: p.plano_id,
      data_pagamento: p.data_pagamento,
      valido_ate: p.valido_ate,
    })
  }
  const clientes = clientesData.filter((c) => idsEstudios.has(c.estudio_id))
  const nomePlano = new Map((planosData ?? []).map((p) => [p.id as string, p.nome as string]))
  const custoHoraPt = parseValorConfig(configData?.valor) ?? 0
  const compras = comprasData.filter((c) => idsEstudios.has(c.estudio_id))
  const outrasSaidas = outrosData.filter((c) => idsEstudios.has(c.estudio_id))
  const registos = registosData.filter((r) => idsEstudios.has(r.estudio_id))

  const primeiraData = pagamentos.reduce((m, p) => (p.data_pagamento < m ? p.data_pagamento : m), hoje)
  const periodo = resolverPeriodo(tipo, ref, hoje, primeiraData)
  const anterior = periodoRecuado(periodo, 1)
  const homologo = periodo.tipo === 'mes' ? periodoRecuado(periodo, 12) : null

  // ── Período escolhido e comparações ──────────────────────────────
  const resumo = resumirPeriodo(pagamentos, periodo.inicio, periodo.fim)
  const resumoAnt = anterior ? resumirPeriodo(pagamentos, anterior.inicio, anterior.fim) : null
  const resumoHom = homologo ? resumirPeriodo(pagamentos, homologo.inicio, homologo.fim) : null
  const somaEntre = <T extends { data: string }>(lista: T[], campo: (x: T) => number, de: string, ate: string) =>
    lista.filter((x) => x.data >= de && x.data <= ate).reduce((s, x) => s + Number(campo(x)), 0)
  const custosPeriodo = (de: string, ate: string) => {
    const comprasP = somaEntre(compras, (c) => c.valor, de, ate)
    const outrasP = somaEntre(outrasSaidas, (c) => c.valor, de, ate)
    const horas = somaEntre(registos, (r) => r.horas, de, ate)
    const custoPt = horas * custoHoraPt
    return { compras: comprasP, outras: outrasP, horas, custoPt, total: comprasP + outrasP + custoPt }
  }
  const custos = custosPeriodo(periodo.inicio, periodo.fim)
  const resultado = resumo.receita - custos.total
  const margemOperacional = resumo.receita > 0 ? resultado / resumo.receita : 0
  const resultadoAnt = anterior ? resumoAnt!.receita - custosPeriodo(anterior.inicio, anterior.fim).total : null
  const comparacaoPrincipal = resumoHom ?? resumoAnt
  const rotuloComparacao = homologo ? `vs ${homologo.rotulo}` : anterior ? `vs ${anterior.rotulo}` : ''
  const parcialTxt = periodo.parcial && anterior ? ` (até dia ${Number(periodo.fim.slice(8, 10))}${periodo.tipo === 'ano' ? `/${periodo.fim.slice(5, 7)}` : ''})` : ''

  // ── Série mensal completa (desde sempre) ─────────────────────────
  const mesAtual = hoje.slice(0, 7)
  const todosMeses = mesesEntre(primeiraData, hoje)
  const mensal = receitaMensal(pagamentos, todosMeses)
  const serieFechada = todosMeses
    .map((mes, i) => ({ mes, receita: mensal.total[i] }))
    .filter((s) => s.mes < mesAtual)
  const indices = indicesSazonais(serieFechada)
  const anoAtual = Number(hoje.slice(0, 4))
  const mesesAteFimAnoSeguinte = 12 + (12 - Number(hoje.slice(5, 7)) + 1)
  const projecao = projetarReceita(serieFechada, mesesAteFimAnoSeguinte, indices)
  const projecaoPorMes = new Map(projecao.map((p) => [p.mes, p.receita]))
  const base = baseClientesMensal(pagamentos, todosMeses)
  const basePorMes = new Map(base.map((b) => [b.mes, b]))

  // Tendência dos últimos 12 meses fechados.
  const ult12 = serieFechada.slice(-12).map((s) => s.receita)
  const prev12 = serieFechada.slice(-24, -12).map((s) => s.receita)
  const reg12 = regressaoLinear(ult12)
  const crescimento12m = prev12.length === 12 ? variacao(ult12.reduce((a, b) => a + b, 0), prev12.reduce((a, b) => a + b, 0)) : null
  const churn12 = base.filter((b) => b.mes < mesAtual && b.churn != null).slice(-12)
  const churnMedio = churn12.length ? churn12.reduce((s, b) => s + (b.churn ?? 0), 0) / churn12.length : 0

  // Projeção do ano corrente: meses fechados reais + mês atual (o maior
  // entre o já recebido e o projetado) + resto do ano projetado.
  const realAnoFechado = serieFechada.filter((s) => s.mes.startsWith(String(anoAtual))).reduce((s, x) => s + x.receita, 0)
  const realMesAtual = mensal.total[todosMeses.indexOf(mesAtual)] ?? 0
  const restoAno = mesesEntre(`${mesAtual}-01`, `${anoAtual}-12-01`).reduce(
    (s, m) => s + (m === mesAtual ? Math.max(realMesAtual, projecaoPorMes.get(m) ?? 0) : projecaoPorMes.get(m) ?? 0),
    0
  )
  const previsaoAno = realAnoFechado + restoAno
  const totalAnoAnterior = serieFechada.filter((s) => s.mes.startsWith(String(anoAtual - 1))).reduce((s, x) => s + x.receita, 0)
  const proximos12 = projecao.slice(0, 12).reduce((s, p) => s + p.receita, 0)

  // ── Retrato de hoje ──────────────────────────────────────────────
  const mrr = mrrNormalizado(pagamentos, hoje)
  const arpu = mrr.cobertos > 0 ? mrr.mrr / mrr.cobertos : 0
  const ltv = churnMedio > 0 ? arpu / churnMedio : null
  const vidaMedia = churnMedio > 0 ? 1 / churnMedio : null
  const ativosFicha = clientes.filter((c) => c.estado === 'Ativo').length

  // Dívida: ativos na ficha sem pagamento válido hoje.
  const ultimoPorCliente = new Map<string, PagamentoAnalise>()
  for (const p of pagamentos) {
    const a = ultimoPorCliente.get(p.cliente_id)
    if (!a || p.valido_ate > a.valido_ate) ultimoPorCliente.set(p.cliente_id, p)
  }
  const emAtraso = clientes
    .filter((c) => c.estado === 'Ativo')
    .map((c) => {
      const u = ultimoPorCliente.get(c.id)
      if (!u || u.valido_ate >= hoje) return null
      const dias = Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${u.valido_ate}T00:00:00Z`)) / 86_400_000)
      return { diasEmAtraso: dias, ultimoValor: u.valor }
    })
    .filter((c): c is { diasEmAtraso: number; ultimoValor: number } => c !== null)
  const aging = agingDivida(emAtraso)
  const valorEmAtraso = emAtraso.reduce((s, c) => s + c.ultimoValor, 0)

  // ── Âmbito dos gráficos ──────────────────────────────────────────
  const mesesEscopo =
    tipo === 'sempre'
      ? todosMeses
      : tipo === 'ano'
        ? mesesEntre(`${periodo.ref}-01-01`, `${periodo.ref}-12-01`)
        : mesesEntre(`${somarMeses(periodo.ref, -11)}-01`, `${periodo.ref}-01`)
  const iMes = new Map(todosMeses.map((m, i) => [m, i]))
  const valorMes = (m: string) => mensal.total[iMes.get(m) ?? -1] ?? 0
  const receitaEscopo = mesesEscopo.map((m) => (m > mesAtual ? 0 : valorMes(m)))
  const mesesFechadosEscopo = mesesEscopo.filter((m) => m < mesAtual && m >= primeiraData.slice(0, 7))
  const statsEscopo = estatisticas(mesesFechadosEscopo.map(valorMes))
  const melhorMes = mesesFechadosEscopo.reduce<string | null>((b, m) => (b === null || valorMes(m) > valorMes(b) ? m : b), null)
  const piorMes = mesesFechadosEscopo.reduce<string | null>((b, m) => (b === null || valorMes(m) < valorMes(b) ? m : b), null)
  const mm12Todos = mediaMovel(mensal.total, 12)

  // Gráfico principal
  let grafico: React.ReactNode
  if (tipo === 'mes') {
    const [a, m] = periodo.ref.split('-').map(Number)
    const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate()
    const acumulado = (mesISO: string, ateDia: number) => {
      const porDia = Array(nDias).fill(0)
      for (const p of pagamentos) {
        if (!p.data_pagamento.startsWith(mesISO)) continue
        const d = Number(p.data_pagamento.slice(8, 10))
        if (d <= nDias) porDia[d - 1] += p.valor
      }
      let s = 0
      return porDia.map((v, i) => (i + 1 > ateDia ? null : (s += v)))
    }
    const diaLimite = periodo.parcial ? Number(periodo.fim.slice(8, 10)) : nDias
    grafico = (
      <GraficoFinanceiro
        rotulos={Array.from({ length: nDias }, (_, i) => `Dia ${i + 1}`)}
        rotulosCurtos={Array.from({ length: nDias }, (_, i) => String(i + 1))}
        linhas={[
          { nome: periodo.rotulo, cor: COR.azul, valores: acumulado(periodo.ref, diaLimite) },
          { nome: rotuloMes(somarMeses(periodo.ref, -1)), cor: COR.cinza, valores: acumulado(somarMeses(periodo.ref, -1), nDias), tracejado: true },
          { nome: rotuloMes(somarMeses(periodo.ref, -12)), cor: COR.amarelo, valores: acumulado(somarMeses(periodo.ref, -12), nDias) },
        ]}
      />
    )
  } else if (tipo === 'ano') {
    const anoRef = Number(periodo.ref)
    grafico = (
      <GraficoFinanceiro
        rotulos={NOMES_MESES.map((n) => `${n} ${anoRef}`)}
        rotulosCurtos={MESES_CURTOS}
        barras={[
          { nome: String(anoRef - 1), cor: COR.cinza, valores: NOMES_MESES.map((_, i) => valorMes(`${anoRef - 1}-${String(i + 1).padStart(2, '0')}`)) },
          { nome: String(anoRef), cor: COR.azul, valores: receitaEscopo },
        ]}
        linhas={
          anoRef >= anoAtual
            ? [
                {
                  nome: 'Projeção',
                  cor: COR.amarelo,
                  tracejado: true,
                  valores: mesesEscopo.map((m) => (m >= mesAtual ? projecaoPorMes.get(m) ?? null : m === somarMeses(mesAtual, -1) ? valorMes(m) : null)),
                },
              ]
            : []
        }
      />
    )
  } else {
    const mesesComProj = [...todosMeses, ...projecao.slice(0, 12).map((p) => p.mes).filter((m) => m > mesAtual)]
    grafico = (
      <GraficoFinanceiro
        rotulos={mesesComProj.map((m) => rotuloMes(m))}
        rotulosCurtos={mesesComProj.map((m) => rotuloMes(m, true))}
        empilhar
        mostrarTotal
        barras={estudios.map((e) => ({
          nome: e.nome,
          cor: corGraficoEstudio(e.slug),
          valores: mesesComProj.map((m) => (iMes.has(m) ? mensal.porEstudio.get(e.id)?.[iMes.get(m)!] ?? 0 : 0)),
        }))}
        linhas={[
          { nome: 'Média móvel 12 meses', cor: COR.amarelo, valores: mesesComProj.map((m) => (iMes.has(m) ? mm12Todos[iMes.get(m)!] : null)) },
          {
            nome: 'Projeção 12 meses',
            cor: COR.violeta,
            tracejado: true,
            valores: mesesComProj.map((m) => (m > mesAtual ? projecaoPorMes.get(m) ?? null : m === mesAtual ? Math.max(realMesAtual, projecaoPorMes.get(m) ?? 0) : null)),
          },
        ]}
      />
    )
  }

  // Receita por ano (todos os anos)
  const anos = Array.from(new Set(todosMeses.map((m) => m.slice(0, 4)))).sort().reverse()
  const porAno = anos.map((ano) => {
    const meses = todosMeses.filter((m) => m.startsWith(ano))
    const total = meses.reduce((s, m) => s + valorMes(m), 0)
    const porEst = new Map(estudios.map((e) => [e.id, meses.reduce((s, m) => s + (mensal.porEstudio.get(e.id)?.[iMes.get(m)!] ?? 0), 0)]))
    const mesesComReceita = meses.filter((m) => valorMes(m) > 0).length
    const desc = meses.reduce((s, m) => s + (mensal.descontos[iMes.get(m)!] ?? 0), 0)
    const npag = meses.reduce((s, m) => s + (mensal.pagamentos[iMes.get(m)!] ?? 0), 0)
    const ativosMedios = meses.length ? meses.reduce((s, m) => s + (basePorMes.get(m)?.ativos ?? 0), 0) / meses.length : 0
    const novos = meses.reduce((s, m) => s + (basePorMes.get(m)?.novos ?? 0), 0)
    const perdidos = meses.filter((m) => m < mesAtual).reduce((s, m) => s + (basePorMes.get(m)?.perdidos ?? 0), 0)
    return { ano, total, porEst, mesesComReceita, mediaMensal: mesesComReceita ? total / mesesComReceita : 0, desc, npag, ativosMedios, novos, perdidos }
  })
  const anosCompletos = porAno.filter((a) => a.mesesComReceita === 12 && Number(a.ano) < anoAtual).reverse()
  const cagrHist =
    anosCompletos.length >= 2
      ? cagr(anosCompletos[0].total, anosCompletos[anosCompletos.length - 1].total, anosCompletos.length - 1)
      : null

  // Sazonalidade: ano × mês
  const maxMes = Math.max(1, ...serieFechada.map((s) => s.receita), realMesAtual)

  // Mix do período
  const mixEstudio = estudios.map((e) => ({ nome: e.nome, valor: resumo.porEstudio.get(e.id) ?? 0, cor: corGraficoEstudio(e.slug) }))
  const mixMetodo = [...resumo.porMetodo.entries()].sort((a, b) => b[1] - a[1]).map(([nome, valor], i) => ({ nome, valor, cor: CORES_MIX[i % CORES_MIX.length] }))
  const planosOrdenados = [...resumo.porPlano.entries()].sort((a, b) => b[1] - a[1])
  const mixPlano = [
    ...planosOrdenados.slice(0, 7).map(([id, valor], i) => ({ nome: id ? nomePlano.get(id) ?? 'Plano removido' : 'Sem plano / histórico', valor, cor: CORES_MIX[i] })),
    ...(planosOrdenados.length > 7 ? [{ nome: 'Outros', valor: planosOrdenados.slice(7).reduce((s, [, v]) => s + v, 0), cor: COR.cinza }] : []),
  ]
  const taxaAteDia8 = (() => {
    const doPeriodo = pagamentos.filter((p) => p.data_pagamento >= periodo.inicio && p.data_pagamento <= periodo.fim)
    return doPeriodo.length ? doPeriodo.filter((p) => Number(p.data_pagamento.slice(8, 10)) <= 8).length / doPeriodo.length : 0
  })()

  // Base de clientes no âmbito
  const baseEscopo = mesesEscopo.filter((m) => m <= mesAtual && iMes.has(m)).map((m) => basePorMes.get(m)!)
  const novosPeriodo = baseEscopo.filter((b) => b.mes >= periodo.inicio.slice(0, 7) && b.mes <= periodo.fim.slice(0, 7)).reduce((s, b) => s + b.novos, 0)
  const perdidosPeriodo = baseEscopo
    .filter((b) => b.mes >= periodo.inicio.slice(0, 7) && b.mes <= periodo.fim.slice(0, 7) && b.mes < mesAtual)
    .reduce((s, b) => s + b.perdidos, 0)

  // ── Conclusões automáticas ───────────────────────────────────────
  const conclusoes: { texto: string; tom: 'bom' | 'mau' | 'neutro' }[] = []
  const varPrincipal = comparacaoPrincipal ? variacao(resumo.receita, comparacaoPrincipal.receita) : null
  if (varPrincipal != null) {
    conclusoes.push({
      texto: `A receita de ${periodo.rotulo} é ${eur(resumo.receita)}${parcialTxt}, ${pct(varPrincipal)} ${rotuloComparacao}.`,
      tom: varPrincipal >= 0 ? 'bom' : 'mau',
    })
  }
  if (ult12.length >= 6) {
    const forca = reg12.r2 >= 0.5 ? 'consistente' : reg12.r2 >= 0.2 ? 'moderada' : 'pouco definida (muita oscilação)'
    conclusoes.push({
      texto: `Nos últimos 12 meses fechados, a receita ${reg12.declive >= 0 ? 'sobe' : 'desce'} em média ${eur(Math.abs(reg12.declive))}/mês — tendência ${forca} (R² ${reg12.r2.toFixed(2).replace('.', ',')}).`,
      tom: reg12.declive >= 0 ? 'bom' : 'mau',
    })
  }
  if (crescimento12m != null) {
    conclusoes.push({
      texto: `Receita dos últimos 12 meses: ${eur(ult12.reduce((a, b) => a + b, 0))}, ${pct(crescimento12m)} face aos 12 meses anteriores.`,
      tom: crescimento12m >= 0 ? 'bom' : 'mau',
    })
  }
  if (anosCompletos.length >= 2 && cagrHist != null) {
    conclusoes.push({
      texto: `Crescimento anual composto (CAGR) ${anosCompletos[0].ano}–${anosCompletos[anosCompletos.length - 1].ano}: ${pct(cagrHist)} ao ano.`,
      tom: cagrHist >= 0 ? 'bom' : 'mau',
    })
  }
  if (indices.some((v) => v !== 1)) {
    const iMax = indices.indexOf(Math.max(...indices))
    const iMin = indices.indexOf(Math.min(...indices))
    conclusoes.push({
      texto: `Sazonalidade: ${NOMES_MESES[iMax]} é historicamente o mês mais forte (${pct(indices[iMax] - 1, 0)} face a um mês médio) e ${NOMES_MESES[iMin]} o mais fraco (${pct(indices[iMin] - 1, 0)}). Planeie campanhas e tesouraria para esses meses.`,
      tom: 'neutro',
    })
  }
  conclusoes.push({
    texto: `Previsão para ${anoAtual}: cerca de ${eur(previsaoAno)}${totalAnoAnterior ? ` (${pct(variacao(previsaoAno, totalAnoAnterior))} vs ${anoAtual - 1})` : ''}; próximos 12 meses: ${eur(proximos12)}.`,
    tom: totalAnoAnterior && previsaoAno < totalAnoAnterior ? 'mau' : 'bom',
  })
  if (churnMedio > 0) {
    conclusoes.push({
      texto: `Churn médio mensal de ${pctSimples(churnMedio)} → cada cliente fica em média ${vidaMedia!.toFixed(1).replace('.', ',')} meses e vale cerca de ${eur(ltv!)} (LTV). Reduzir o churn em 1 ponto aumenta o LTV para ~${eur(arpu / Math.max(0.001, churnMedio - 0.01))}.`,
      tom: churnMedio <= 0.05 ? 'bom' : churnMedio <= 0.1 ? 'neutro' : 'mau',
    })
  }
  if (estudios.length > 1 && resumo.receita > 0) {
    const maior = mixEstudio.reduce((a, b) => (b.valor > a.valor ? b : a))
    conclusoes.push({ texto: `${maior.nome} gera ${pctSimples(maior.valor / resumo.receita, 0)} da receita do período.`, tom: 'neutro' })
  }
  if (resumo.descontos > 0) {
    conclusoes.push({
      texto: `Descontos concedidos: ${eur(resumo.descontos)} (${pctSimples(resumo.taxaDesconto)} da faturação bruta).`,
      tom: resumo.taxaDesconto > 0.1 ? 'mau' : 'neutro',
    })
  }
  if (statsEscopo.media > 0 && mesesFechadosEscopo.length >= 3) {
    conclusoes.push({
      texto: `Volatilidade mensal: coeficiente de variação de ${pctSimples(statsEscopo.cv, 0)} (${statsEscopo.cv < 0.1 ? 'receita muito estável' : statsEscopo.cv < 0.25 ? 'oscilação normal' : 'receita irregular — atenção à tesouraria'}).`,
      tom: statsEscopo.cv < 0.25 ? 'neutro' : 'mau',
    })
  }
  if (emAtraso.length > 0) {
    conclusoes.push({
      texto: `${emAtraso.length} clientes ativos sem pagamento válido — cerca de ${eur(valorEmAtraso)} por cobrar.`,
      tom: 'mau',
    })
  }

  // ── Navegação ────────────────────────────────────────────────────
  const href = (p: Record<string, string | undefined>) => {
    const qs = new URLSearchParams()
    if (estudioParam) qs.set('estudio', estudioParam)
    for (const [k, v] of Object.entries(p)) if (v) qs.set(k, v)
    return `/painel/admin/financeiro?${qs.toString()}`
  }
  const refAnterior = tipo === 'mes' ? somarMeses(periodo.ref, -1) : tipo === 'ano' ? String(Number(periodo.ref) - 1) : null
  const refSeguinte = tipo === 'mes' ? somarMeses(periodo.ref, 1) : tipo === 'ano' ? String(Number(periodo.ref) + 1) : null
  const podeSeguinte = refSeguinte !== null && refSeguinte <= (tipo === 'mes' ? mesAtual : String(anoAtual))
  const podeAnterior = refAnterior !== null && refAnterior >= (tipo === 'mes' ? primeiraData.slice(0, 7) : primeiraData.slice(0, 4))

  const csvMensal = todosMeses.map((m) => {
    const i = iMes.get(m)!
    const b = basePorMes.get(m)
    return {
      mes: m,
      ...Object.fromEntries(estudios.map((e) => [`e${e.id}`, Math.round((mensal.porEstudio.get(e.id)?.[i] ?? 0) * 100) / 100])),
      receita: mensal.total[i],
      descontos: mensal.descontos[i],
      pagamentos: mensal.pagamentos[i],
      ativos: b?.ativos ?? 0,
      novos: b?.novos ?? 0,
      perdidos: b?.perdidos ?? 0,
      churn: b?.churn != null ? Math.round(b.churn * 10000) / 100 : '',
    }
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Análise Financeira</h1>
          <p className="mt-1 text-sm text-muted">
            {estudios.map((e) => e.nome).join(' + ')} · dados desde {rotuloMes(primeiraData.slice(0, 7))} · {pagamentos.length.toLocaleString('pt-PT')} pagamentos
          </p>
        </div>
        <ExportarCsvButton
          colunas={[
            { chave: 'mes', label: 'Mês' },
            ...estudios.map((e) => ({ chave: `e${e.id}`, label: `${e.nome} (€)` })),
            { chave: 'receita', label: 'Receita total (€)' },
            { chave: 'descontos', label: 'Descontos (€)' },
            { chave: 'pagamentos', label: 'Nº pagamentos' },
            { chave: 'ativos', label: 'Clientes cobertos' },
            { chave: 'novos', label: 'Novos' },
            { chave: 'perdidos', label: 'Perdidos' },
            { chave: 'churn', label: 'Churn (%)' },
          ]}
          linhas={csvMensal}
          nomeFicheiro="analise-financeira-mensal"
          className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground"
        />
      </div>

      {/* Seletor de período */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-border-subtle bg-surface p-1 shadow-card">
          {(
            [
              ['mes', 'Mês'],
              ['ano', 'Ano'],
              ['sempre', 'Desde sempre'],
            ] as const
          ).map(([t, nome]) => (
            <Link
              key={t}
              href={href({ periodo: t === 'mes' ? undefined : t })}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                tipo === t ? 'bg-brand text-black' : 'text-muted hover:text-foreground'
              }`}
            >
              {nome}
            </Link>
          ))}
        </div>
        {tipo !== 'sempre' && (
          <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-card">
            {podeAnterior ? (
              <Link href={href({ periodo: tipo === 'mes' ? undefined : tipo, ref: refAnterior! })} aria-label="Anterior" className="rounded-full p-1.5 text-muted hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-muted opacity-30"><ChevronLeft className="h-4 w-4" /></span>
            )}
            <span className="min-w-32 px-2 text-center text-sm font-semibold capitalize text-foreground">{periodo.rotulo}</span>
            {podeSeguinte ? (
              <Link href={href({ periodo: tipo === 'mes' ? undefined : tipo, ref: refSeguinte! })} aria-label="Seguinte" className="rounded-full p-1.5 text-muted hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="p-1.5 text-muted opacity-30"><ChevronRight className="h-4 w-4" /></span>
            )}
          </div>
        )}
        {tipo === 'ano' && (
          <div className="flex flex-wrap gap-1">
            {anos.map((a) => (
              <Link key={a} href={href({ periodo: 'ano', ref: a })} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a === periodo.ref ? 'bg-foreground/10 text-foreground' : 'text-muted hover:text-foreground'}`}>
                {a}
              </Link>
            ))}
          </div>
        )}
        {periodo.parcial && <span className="text-xs text-muted">Período em curso — comparações feitas até ao mesmo dia.</span>}
      </div>

      {/* Conclusões */}
      <Cartao className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lightbulb className="h-4 w-4 text-amber-400" /> Conclusões-chave
        </h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {conclusoes.map((c, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.tom === 'bom' ? 'bg-emerald-500' : c.tom === 'mau' ? 'bg-red-500' : 'bg-zinc-500'}`}
                aria-label={c.tom === 'bom' ? 'positivo' : c.tom === 'mau' ? 'atenção' : 'informação'}
              />
              <span>{c.texto}</span>
            </li>
          ))}
        </ul>
      </Cartao>

      {/* KPIs do período */}
      <Seccao titulo={`Desempenho · ${periodo.rotulo}${parcialTxt}`} sub={rotuloComparacao ? `Variações ${rotuloComparacao}${homologo && anterior ? ` (e ${anterior.rotulo} no detalhe)` : ''}.` : undefined}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Receita líquida"
            valor={eur(resumo.receita)}
            tendencia={tendencia(variacao(resumo.receita, comparacaoPrincipal?.receita), rotuloComparacao)}
            historico={receitaEscopo.slice(-12)}
            formula="Soma dos pagamentos recebidos no período (valor pago, já com descontos; sem anulados)."
          />
          <StatCard
            label="Faturação bruta"
            valor={eur(resumo.bruto)}
            sufixo={`descontos ${pctSimples(resumo.taxaDesconto)}`}
            formula="Receita líquida + descontos concedidos."
          />
          <StatCard
            label="Resultado operacional (est.)"
            cor={resultado >= 0 ? PALETA.verde : PALETA.vermelho}
            valor={eur(resultado)}
            sufixo={`margem ${pctSimples(margemOperacional)}`}
            tendencia={tendencia(variacao(resultado, resultadoAnt), anterior ? `vs ${anterior.rotulo}` : '')}
            formula="Receita − compras de caixa − outras saídas − custo estimado das horas de PT. Não inclui rendas, salários fixos nem impostos (não registados na app)."
          />
          <StatCard
            label="Pagamentos"
            valor={resumo.pagamentos.toLocaleString('pt-PT')}
            sufixo={`ticket médio ${eur2(resumo.ticketMedio)}`}
            tendencia={tendencia(variacao(resumo.pagamentos, comparacaoPrincipal?.pagamentos), rotuloComparacao)}
            formula="Nº de pagamentos no período; ticket médio = receita ÷ nº pagamentos."
          />
          <StatCard
            label="Clientes pagantes"
            valor={resumo.clientesPagantes.toLocaleString('pt-PT')}
            tendencia={tendencia(variacao(resumo.clientesPagantes, comparacaoPrincipal?.clientesPagantes), rotuloComparacao)}
            formula="Clientes diferentes com pelo menos um pagamento no período."
          />
          <StatCard
            label="Receita por cliente pagante"
            valor={eur2(resumo.receitaPorCliente)}
            tendencia={tendencia(variacao(resumo.receitaPorCliente, comparacaoPrincipal?.receitaPorCliente), rotuloComparacao)}
            formula="Receita do período ÷ clientes pagantes."
          />
          <StatCard
            label="Novos / perdidos"
            valor={`${novosPeriodo} / ${perdidosPeriodo}`}
            sufixo={`saldo ${novosPeriodo - perdidosPeriodo >= 0 ? '+' : ''}${novosPeriodo - perdidosPeriodo}`}
            formula="Novos: primeiro pagamento de sempre no período. Perdidos: estavam cobertos num mês e deixaram de estar no seguinte (só meses fechados)."
          />
          <StatCard
            label="Pagos até ao dia 8"
            cor={taxaAteDia8 >= 0.8 ? PALETA.verde : PALETA.ambar}
            valor={Math.round(taxaAteDia8 * 100)}
            sufixo="%"
            formula="Pagamentos do período feitos até ao dia 8 do mês ÷ total de pagamentos do período."
          />
        </div>
      </Seccao>

      {/* Gráfico principal */}
      <Seccao
        titulo={tipo === 'mes' ? 'Receita acumulada ao longo do mês' : tipo === 'ano' ? `Receita mensal ${periodo.ref} vs ${Number(periodo.ref) - 1}` : 'Receita mensal desde sempre'}
        sub={
          tipo === 'mes'
            ? 'Compara o ritmo de entrada de dinheiro com o mês anterior e com o mesmo mês do ano passado.'
            : tipo === 'ano'
              ? 'Barras: receita de cada mês. Tracejado: projeção para os meses que faltam (tendência + sazonalidade).'
              : 'Barras empilhadas por estúdio, média móvel de 12 meses (tendência de fundo) e projeção dos próximos 12 meses.'
        }
      >
        <Cartao>{grafico}</Cartao>
      </Seccao>

      {/* Retrato de hoje + projeções */}
      <div className="grid gap-x-6 lg:grid-cols-2">
        <Seccao titulo="Retrato de hoje" sub="Receita recorrente e valor do cliente, calculados a partir da validade dos pagamentos.">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="MRR" aoVivo valor={eur(mrr.mrr)} formula="Receita recorrente mensal: pagamento que cobre hoje cada cliente, dividido pelos meses que cobre (um trimestral conta 1/3 por mês)." />
            <StatCard label="ARR" valor={eur(mrr.mrr * 12)} formula="MRR × 12." />
            <StatCard label="ARPU" valor={eur2(arpu)} sufixo={`${mrr.cobertos} cobertos · ${ativosFicha} ativos`} formula="MRR ÷ clientes cobertos hoje por um pagamento válido." />
            <StatCard
              label="Churn mensal (12m)"
              cor={churnMedio <= 0.05 ? PALETA.verde : churnMedio <= 0.1 ? PALETA.ambar : PALETA.vermelho}
              valor={pctSimples(churnMedio)}
              formula="Média dos últimos 12 meses fechados de: clientes perdidos no mês ÷ clientes cobertos no mês anterior."
            />
            <StatCard label="LTV (valor do cliente)" valor={ltv != null ? eur(ltv) : '—'} formula="ARPU ÷ churn mensal: receita que um cliente médio gera durante toda a relação." />
            <StatCard label="Vida média do cliente" valor={vidaMedia != null ? vidaMedia.toFixed(1).replace('.', ',') : '—'} sufixo="meses" formula="1 ÷ churn mensal." />
          </div>
        </Seccao>

        <Seccao titulo="Projeções e tendência" sub="Modelo: tendência linear dos últimos 24 meses fechados, ajustada à sazonalidade histórica de cada mês.">
          <Cartao>
            <Linha label={`Previsão de fecho de ${anoAtual}`} valor={eur(previsaoAno)} />
            <Linha label={`  já faturado em ${anoAtual}`} valor={eur(realAnoFechado + realMesAtual)} />
            <Linha label={`  ${anoAtual - 1} (real)`} valor={eur(totalAnoAnterior)} />
            <Linha label={`Variação prevista vs ${anoAtual - 1}`} valor={pct(variacao(previsaoAno, totalAnoAnterior))} />
            <Linha label="Receita prevista próximos 12 meses" valor={eur(proximos12)} />
            <Linha label="Run-rate anual (últimos 3 meses × 4)" valor={eur(serieFechada.slice(-3).reduce((s, x) => s + x.receita, 0) * 4)} />
            <Linha label="Tendência mensal (12m)" valor={`${reg12.declive >= 0 ? '+' : '−'}${eur(Math.abs(reg12.declive))}/mês`} />
            <Linha label="Crescimento 12m vs 12m anteriores" valor={pct(crescimento12m)} />
            <Linha label="CAGR (anos completos)" valor={cagrHist != null ? pct(cagrHist) : '—'} destaque />
          </Cartao>
        </Seccao>
      </div>

      {/* Base de clientes */}
      <Seccao
        titulo="Base de clientes · aquisição e perda"
        sub="Clientes cobertos por um pagamento em cada mês; novos e reativados para cima, perdidos para baixo. O mês corrente ainda não conta perdas."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao>
            <GraficoFinanceiro
              formato="num"
              altura={220}
              rotulos={baseEscopo.map((b) => rotuloMes(b.mes))}
              rotulosCurtos={baseEscopo.map((b) => rotuloMes(b.mes, true))}
              linhas={[{ nome: 'Clientes cobertos', cor: COR.azul, valores: baseEscopo.map((b) => b.ativos) }]}
            />
          </Cartao>
          <Cartao>
            <GraficoFinanceiro
              formato="num"
              altura={220}
              empilhar
              rotulos={baseEscopo.map((b) => rotuloMes(b.mes))}
              rotulosCurtos={baseEscopo.map((b) => rotuloMes(b.mes, true))}
              barras={[
                { nome: 'Novos', cor: COR.aqua, valores: baseEscopo.map((b) => b.novos) },
                { nome: 'Reativados', cor: COR.violeta, valores: baseEscopo.map((b) => b.reativados) },
                { nome: 'Perdidos', cor: COR.laranja, valores: baseEscopo.map((b) => (b.mes < mesAtual ? -b.perdidos : 0)) },
              ]}
            />
          </Cartao>
        </div>
      </Seccao>

      {/* Mix */}
      <Seccao titulo={`Composição da receita · ${periodo.rotulo}`}>
        <div className="grid gap-4 md:grid-cols-3">
          <Cartao>
            <p className="mb-3 text-sm font-semibold text-foreground">Por estúdio</p>
            <ListaMix itens={mixEstudio} />
          </Cartao>
          <Cartao>
            <p className="mb-3 text-sm font-semibold text-foreground">Por método de pagamento</p>
            <ListaMix itens={mixMetodo} />
          </Cartao>
          <Cartao>
            <p className="mb-3 text-sm font-semibold text-foreground">Por plano</p>
            <ListaMix itens={mixPlano} />
          </Cartao>
        </div>
      </Seccao>

      {/* Estatística + custos */}
      <div className="grid gap-x-6 lg:grid-cols-2">
        <Seccao
          titulo="Estatística mensal"
          sub={`Meses fechados ${tipo === 'mes' ? 'dos últimos 12 meses' : tipo === 'ano' ? `de ${periodo.ref}` : 'desde o início'} (${mesesFechadosEscopo.length}).`}
        >
          <Cartao>
            <Linha label="Média mensal" valor={eur(statsEscopo.media)} />
            <Linha label="Mediana" valor={eur(statsEscopo.mediana)} />
            <Linha label="Desvio-padrão" valor={eur(statsEscopo.desvio)} />
            <Linha label="Coeficiente de variação" valor={pctSimples(statsEscopo.cv, 0)} />
            <Linha label={`Melhor mês${melhorMes ? ` (${rotuloMes(melhorMes)})` : ''}`} valor={eur(statsEscopo.max)} />
            <Linha label={`Pior mês${piorMes ? ` (${rotuloMes(piorMes)})` : ''}`} valor={eur(statsEscopo.min)} />
            <Linha label="Amplitude" valor={eur(statsEscopo.max - statsEscopo.min)} destaque />
          </Cartao>
        </Seccao>

        <Seccao titulo={`Conta de exploração simplificada · ${periodo.rotulo}`} sub="Com os custos que a app regista. Rendas, salários fixos, seguros e impostos não estão incluídos.">
          <Cartao>
            <Linha label="Faturação bruta" valor={eur(resumo.bruto)} />
            <Linha label="− Descontos" valor={eur(resumo.descontos)} />
            <Linha label="= Receita líquida" valor={eur(resumo.receita)} destaque />
            <Linha label="− Compras (caixa)" valor={eur(custos.compras)} />
            <Linha label="− Outras saídas (caixa)" valor={eur(custos.outras)} />
            <Linha label={`− Horas de PT (${Math.round(custos.horas)}h × ${eur2(custoHoraPt)})`} valor={eur(custos.custoPt)} />
            <Linha label="= Resultado operacional estimado" valor={`${eur(resultado)} · ${pctSimples(margemOperacional)}`} destaque />
            {custos.horas > 0 && <Linha label="Receita por hora de PT" valor={eur2(resumo.receita / custos.horas)} />}
          </Cartao>
        </Seccao>
      </div>

      {/* Anos */}
      <Seccao
        titulo="Evolução anual"
        sub={`Anos incompletos assinalados. ${cagrHist != null ? `CAGR dos anos completos: ${pct(cagrHist)}.` : ''}`}
        acao={
          <ExportarCsvButton
            colunas={[
              { chave: 'ano', label: 'Ano' },
              ...estudios.map((e) => ({ chave: `e${e.id}`, label: `${e.nome} (€)` })),
              { chave: 'total', label: 'Total (€)' },
              { chave: 'media', label: 'Média mensal (€)' },
              { chave: 'descontos', label: 'Descontos (€)' },
              { chave: 'pagamentos', label: 'Nº pagamentos' },
              { chave: 'novos', label: 'Novos clientes' },
              { chave: 'perdidos', label: 'Clientes perdidos' },
            ]}
            linhas={porAno.map((a) => ({
              ano: a.ano,
              ...Object.fromEntries(estudios.map((e) => [`e${e.id}`, Math.round((a.porEst.get(e.id) ?? 0) * 100) / 100])),
              total: Math.round(a.total * 100) / 100,
              media: Math.round(a.mediaMensal * 100) / 100,
              descontos: Math.round(a.desc * 100) / 100,
              pagamentos: a.npag,
              novos: a.novos,
              perdidos: a.perdidos,
            }))}
            nomeFicheiro="evolucao-anual"
            className="text-xs text-muted underline hover:text-foreground"
          />
        }
      >
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2 font-semibold">Ano</th>
                {estudios.map((e) => (
                  <th key={e.id} className="px-3 py-2 text-right font-semibold">{e.nome}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">vs ano ant.</th>
                <th className="px-3 py-2 text-right font-semibold">Média/mês</th>
                <th className="px-3 py-2 text-right font-semibold">Descontos</th>
                <th className="px-3 py-2 text-right font-semibold">Pagamentos</th>
                <th className="px-3 py-2 text-right font-semibold">Clientes médios</th>
                <th className="px-3 py-2 text-right font-semibold">Novos / perdidos</th>
              </tr>
            </thead>
            <tbody>
              {porAno.map((a, i) => {
                const ant = porAno[i + 1]
                const v = ant ? variacao(a.total, ant.total) : null
                return (
                  <tr key={a.ano} className="border-t border-border-subtle">
                    <td className="px-4 py-2 font-semibold text-foreground">
                      <Link href={href({ periodo: 'ano', ref: a.ano })} className="hover:underline">{a.ano}</Link>
                      {(a.mesesComReceita < 12 || Number(a.ano) === anoAtual) && (
                        <span className="ml-1.5 text-xs font-normal text-muted">({a.mesesComReceita} meses)</span>
                      )}
                    </td>
                    {estudios.map((e) => (
                      <td key={e.id} className="px-3 py-2 text-right tabular-nums">{eur(a.porEst.get(e.id) ?? 0)}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{eur(a.total)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${v == null ? 'text-muted' : v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pct(v, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(a.mediaMensal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{eur(a.desc)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{a.npag.toLocaleString('pt-PT')}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{Math.round(a.ativosMedios)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{a.novos} / {a.perdidos}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Seccao>

      {/* Sazonalidade */}
      <Seccao titulo="Mapa de sazonalidade" sub="Receita de cada mês (quanto mais intenso, maior). A última linha é o índice sazonal: 100 = mês médio do ano.">
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-3 shadow-card">
          <table className="w-full min-w-[860px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr className="text-muted">
                <th className="w-14 text-left font-semibold">Ano</th>
                {MESES_CURTOS.map((m) => (
                  <th key={m} className="font-semibold capitalize">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...anos].reverse().map((a) => (
                <tr key={a}>
                  <td className="font-semibold text-foreground">{a}</td>
                  {MESES_CURTOS.map((_, i) => {
                    const m = `${a}-${String(i + 1).padStart(2, '0')}`
                    const existe = iMes.has(m)
                    const v = existe ? valorMes(m) : 0
                    return (
                      <td key={m} className="p-0">
                        <CelulaSazonal href={existe ? href({ ref: m }) : null} titulo={existe ? `${rotuloMes(m)}: ${eur(v)}` : 'Sem dados'} intensidade={existe && v > 0 ? v / maxMes : null}>
                          {existe && v > 0 ? formatarValor(v, 'eur', true) : '—'}
                        </CelulaSazonal>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td className="font-semibold text-muted">Índice</td>
                {indices.map((v, i) => (
                  <td key={i} className={`text-center font-mono tabular-nums ${v >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(v * 100)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Seccao>

      {/* Cobrança */}
      <Seccao titulo="Cobrança e risco" sub="Clientes com ficha ativa mas sem pagamento válido hoje, por antiguidade (valor aproximado = último pagamento).">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {aging.map((f) => (
            <StatCard key={f.faixa} label={f.faixa} cor={PALETA.vermelho} valor={f.clientes} sufixo={`clientes · ${eur(f.valorAproximado)}`} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Total aproximado por cobrar: {eur(valorEmAtraso)}.</p>
      </Seccao>

      <p className="mt-10 text-xs text-muted">
        Notas: receita = dinheiro efetivamente recebido (data do pagamento), inclui o histórico importado do Excel e exclui pagamentos anulados.
        {estudios.length < todosEstudios.length && ` Filtrado para ${estudios.map((e) => e.nome).join(', ')}.`}{' '}
      </p>
    </div>
  )
}

function Seccao({ titulo, sub, children, acao }: { titulo: string; sub?: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{titulo}</h2>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
        </div>
        {acao}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Cartao({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border-subtle bg-surface p-4 shadow-card ${className}`}>{children}</div>
}

function ListaMix({ itens }: { itens: { nome: string; valor: number; cor: string }[] }) {
  const total = itens.reduce((s, x) => s + x.valor, 0)
  if (total <= 0) return <p className="text-sm text-muted">Sem receita no período.</p>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {itens
          .filter((x) => x.valor > 0)
          .map((x) => (
            <div key={x.nome} title={`${x.nome}: ${eur(x.valor)}`} style={{ width: `${(x.valor / total) * 100}%`, background: x.cor }} />
          ))}
      </div>
      {itens.map((x) => (
        <div key={x.nome} className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex min-w-0 items-center gap-2 text-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: x.cor }} />
            <span className="truncate">{x.nome}</span>
          </span>
          <span className="shrink-0 font-mono tabular-nums text-muted">
            {eur(x.valor)} · <span className="text-foreground">{pctSimples(x.valor / total, 1)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function Linha({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${
        destaque ? 'border-t border-border-subtle pt-2 font-semibold text-foreground' : 'text-muted'
      }`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums text-foreground">{valor}</span>
    </div>
  )
}

function CelulaSazonal({
  href,
  titulo,
  intensidade,
  children,
}: {
  href: string | null
  titulo: string
  intensidade: number | null
  children: React.ReactNode
}) {
  const conteudo = (
    <>
      <span className="absolute inset-0" style={{ background: '#22d3ee', opacity: intensidade != null ? 0.08 + 0.62 * intensidade : 0.03 }} />
      <span className="relative">{children}</span>
    </>
  )
  const cls = 'relative flex h-9 items-center justify-center overflow-hidden rounded-md font-mono tabular-nums text-foreground'
  return href ? (
    <Link href={href} title={titulo} className={`${cls} hover:ring-1 hover:ring-white/30`}>
      {conteudo}
    </Link>
  ) : (
    <span title={titulo} className={cls}>
      {conteudo}
    </span>
  )
}
