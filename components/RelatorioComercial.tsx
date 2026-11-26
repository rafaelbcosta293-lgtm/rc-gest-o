import type { ReactNode } from 'react'
import { diaCurto, MESES } from '@/lib/data/presencas'
import {
  ROTULO_TIPO_WALK_IN,
  SEM_VISITA,
  TIPOS_VISITA,
  WALK_IN_POR_CLASSIFICAR,
  calcularRelatorioComercial,
  periodosDoRelatorio,
  type DadosRelatorioComercial,
  type MetricasComerciais,
  type TipoVisita,
  type TipoWalkIn,
} from '@/lib/data/relatorioComercial'

const ROTULO_VISITA: Record<TipoVisita, string> = { 'Treino experimental': 'Treinos experimentais', 'Visita de condições': 'Visitas de condições' }

// O relatório comercial: o funil do CRM (leads → contactos → marcações →
// visitas → inscrições, com os walk-ins à parte) em três colunas — o
// dia, o mês até esse dia e o ano até esse dia — saídas dos mesmos dados.

const pct = (t: number | null) => (t === null ? '—' : `${Math.round(t * 100)} %`)

type Linha =
  | { tipo: 'titulo'; nome: string }
  | { tipo: 'valor'; nome: string; valor: (m: MetricasComerciais) => number; forte?: boolean; sub?: boolean; nota?: (m: MetricasComerciais) => string | null }
  | { tipo: 'taxa'; nome: string; como: string; valor: (m: MetricasComerciais) => number | null; partes: (m: MetricasComerciais) => [number, number] }
  | { tipo: 'total'; nome: string; valor: (m: MetricasComerciais) => number }

export default function RelatorioComercial({ dados, dia, hoje }: { dados: DadosRelatorioComercial; dia: string; hoje: string }) {
  const p = periodosDoRelatorio(dia)
  const colunas: { nome: string; quando: string; m: MetricasComerciais }[] = [
    { nome: 'Dia', quando: dia === hoje ? 'hoje' : diaCurto(dia), m: calcularRelatorioComercial(dados, ...p.dia, hoje) },
    { nome: 'Mês', quando: MESES[Number(dia.slice(5, 7)) - 1].toLowerCase(), m: calcularRelatorioComercial(dados, ...p.mes, hoje) },
    { nome: 'Ano', quando: dia.slice(0, 4), m: calcularRelatorioComercial(dados, ...p.ano, hoje) },
  ]
  const ano = colunas[2].m

  // Origens fora da lista habitual e walk-ins por classificar só ganham
  // linha quando existem (no ano), para a tabela não encher de zeros.
  const outras = ano.outrasOrigens.map((o) => o.nome)
  const haPorClassificar = (ano.walkInsPorTipo.find((t) => t.nome === WALK_IN_POR_CLASSIFICAR)?.n ?? 0) > 0
  const contagem = (lista: { nome: string; n: number }[], nome: string) => lista.find((x) => x.nome === nome)?.n ?? 0

  const linhas: Linha[] = [
    { tipo: 'titulo', nome: 'Leads angariadas' },
    { tipo: 'valor', nome: 'Total de leads angariadas', forte: true, valor: (m) => m.leads },
    ...ano.porCanal.map((c): Linha => ({ tipo: 'valor', nome: c.nome, sub: true, valor: (m) => contagem(m.porCanal, c.nome) })),
    ...outras.map((nome): Linha => ({ tipo: 'valor', nome, sub: true, valor: (m) => contagem(m.outrasOrigens, nome) })),
    { tipo: 'valor', nome: 'Walk-ins', forte: true, valor: (m) => m.walkIns },
    ...ano.walkInsPorTipo
      .filter((t) => t.nome !== WALK_IN_POR_CLASSIFICAR || haPorClassificar)
      .map((t): Linha => ({ tipo: 'valor', nome: ROTULO_TIPO_WALK_IN[t.nome as TipoWalkIn] ?? t.nome, sub: true, valor: (m) => contagem(m.walkInsPorTipo, t.nome) })),

    { tipo: 'titulo', nome: 'Contactos' },
    { tipo: 'valor', nome: 'Contactos com sucesso', sub: true, valor: (m) => m.contactosSucesso },
    { tipo: 'valor', nome: 'Contactos sem sucesso', sub: true, valor: (m) => m.contactosSemSucesso },
    { tipo: 'valor', nome: 'Total de contactos', forte: true, valor: (m) => m.contactosTotal },
    { tipo: 'valor', nome: 'Leads contactadas com sucesso', valor: (m) => m.leadsContactadas },
    { tipo: 'taxa', nome: 'Taxa de contacto', como: 'leads contactadas com sucesso ÷ leads angariadas', valor: (m) => m.taxaContacto, partes: (m) => [m.leadsContactadas, m.leads] },

    { tipo: 'titulo', nome: 'Marcações' },
    { tipo: 'valor', nome: 'Marcações feitas', forte: true, valor: (m) => m.marcacoes },
    ...TIPOS_VISITA.map((t): Linha => ({ tipo: 'valor', nome: ROTULO_VISITA[t], sub: true, valor: (m) => contagem(m.marcacoesPorTipo, t) })),
    { tipo: 'taxa', nome: 'Taxa de marcação', como: 'marcações ÷ contactos com sucesso', valor: (m) => m.taxaMarcacao, partes: (m) => [m.marcacoes, m.contactosSucesso] },

    { tipo: 'titulo', nome: 'Visitas' },
    { tipo: 'valor', nome: 'Marcações em agenda', forte: true, valor: (m) => m.emAgenda },
    ...TIPOS_VISITA.map((t): Linha => ({ tipo: 'valor', nome: ROTULO_VISITA[t], sub: true, valor: (m) => contagem(m.emAgendaPorTipo, t) })),
    {
      tipo: 'valor',
      nome: 'Visitas realizadas',
      forte: true,
      valor: (m) => m.visitas,
      nota: (m) => (m.visitasPorRegistar > 0 ? `+ ${m.visitasPorRegistar} por registar` : null),
    },
    ...TIPOS_VISITA.map((t): Linha => ({ tipo: 'valor', nome: ROTULO_VISITA[t], sub: true, valor: (m) => contagem(m.visitasPorTipo, t) })),
    { tipo: 'taxa', nome: 'Taxa de comparência', como: 'visitas realizadas ÷ marcações em agenda', valor: (m) => m.taxaComparencia, partes: (m) => [m.visitas, m.emAgenda] },

    { tipo: 'titulo', nome: 'Inscrições' },
    { tipo: 'valor', nome: 'Inscrições de visitas / treinos experimentais', forte: true, valor: (m) => m.inscricoesVisitas },
    { tipo: 'valor', nome: 'De treinos experimentais', sub: true, valor: (m) => contagem(m.inscricoesPorTipo, 'Treino experimental') },
    { tipo: 'valor', nome: 'De visitas de condições', sub: true, valor: (m) => contagem(m.inscricoesPorTipo, 'Visita de condições') },
    ...(contagem(ano.inscricoesPorTipo, SEM_VISITA) > 0 ? [{ tipo: 'valor', nome: SEM_VISITA, sub: true, valor: (m: MetricasComerciais) => contagem(m.inscricoesPorTipo, SEM_VISITA) } as Linha] : []),
    { tipo: 'taxa', nome: 'Taxa de fecho de visitas', como: 'inscrições de visitas ÷ visitas realizadas', valor: (m) => m.taxaFechoVisitas, partes: (m) => [m.inscricoesVisitas, m.visitas] },
    { tipo: 'valor', nome: 'Walk-ins', valor: (m) => m.walkIns },
    { tipo: 'valor', nome: 'Walk-ins fechados', forte: true, valor: (m) => m.walkInsFechados },
    { tipo: 'taxa', nome: 'Taxa de fecho de walk-ins', como: 'walk-ins fechados ÷ walk-ins', valor: (m) => m.taxaFechoWalkIns, partes: (m) => [m.walkInsFechados, m.walkIns] },
    { tipo: 'total', nome: 'Total de inscrições', valor: (m) => m.totalInscricoes },
  ]

  const celula = 'px-3 py-1.5 text-right tabular-nums'
  const corpo: ReactNode[] = linhas.map((l, i) => {
    if (l.tipo === 'titulo') {
      return (
        <tr key={i}>
          <th scope="colgroup" colSpan={4} className="border-t border-border-subtle bg-foreground/[.03] px-3 pt-3 pb-1.5 text-left text-[11px] font-semibold tracking-wider text-muted uppercase">
            {l.nome}
          </th>
        </tr>
      )
    }
    if (l.tipo === 'taxa') {
      return (
        <tr key={i} className="bg-brand/[.10]">
          <th scope="row" className="px-3 py-2 text-left font-semibold text-foreground">
            {l.nome}
            <span className="block text-[11px] font-normal text-muted">{l.como}</span>
          </th>
          {colunas.map((c) => {
            const [parte, todo] = l.partes(c.m)
            return (
              <td key={c.nome} className={`${celula} py-2`}>
                <span className="text-base font-bold text-foreground">{pct(l.valor(c.m))}</span>
                <span className="block text-[11px] text-muted">
                  {parte} de {todo}
                </span>
              </td>
            )
          })}
        </tr>
      )
    }
    if (l.tipo === 'total') {
      return (
        <tr key={i} className="border-t-2 border-foreground/20">
          <th scope="row" className="px-3 py-3 text-left text-base font-bold text-foreground">
            {l.nome}
          </th>
          {colunas.map((c) => (
            <td key={c.nome} className={`${celula} py-3 text-xl font-bold text-foreground`}>
              {l.valor(c.m)}
            </td>
          ))}
        </tr>
      )
    }
    return (
      <tr key={i} className="border-t border-border-subtle/60">
        <th scope="row" className={`px-3 py-1.5 text-left ${l.forte ? 'font-semibold text-foreground' : 'font-normal text-foreground/80'} ${l.sub ? 'pl-7' : ''}`}>
          {l.nome}
        </th>
        {colunas.map((c) => {
          const v = l.valor(c.m)
          const nota = l.nota?.(c.m)
          return (
            <td key={c.nome} className={`${celula} ${l.forte ? 'font-semibold text-foreground' : v === 0 ? 'text-muted' : 'text-foreground'}`}>
              {v}
              {nota && <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-400">{nota}</span>}
            </td>
          )
        })}
      </tr>
    )
  })

  return (
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface shadow-card">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted">
              Indicador
            </th>
            {colunas.map((c) => (
              <th key={c.nome} scope="col" className="w-[19%] px-3 py-2.5 text-right text-sm font-bold text-foreground">
                {c.nome}
                <span className="block text-[11px] font-normal text-muted">{c.quando}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{corpo}</tbody>
      </table>
    </div>
  )
}
