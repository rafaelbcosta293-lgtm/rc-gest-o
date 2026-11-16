import { describe, expect, it } from 'vitest'
import { calcularCustoPorLead, custoPorLeadDoMes, ehAnuncio, explicarCustoPorLead } from './custoPorLead'

const leads = (mes: string, n: number) => Array.from({ length: n }, (_, i) => ({ data: `${mes}-${String((i % 27) + 1).padStart(2, '0')}` }))

describe('ehAnuncio', () => {
  it('só a linha de anúncios da categoria de publicidade', () => {
    expect(ehAnuncio({ categoria: 'Publicidade / Marketing', subcategoria: 'MKT - Anúncios' })).toBe(true)
    expect(ehAnuncio({ categoria: 'Publicidade / Marketing', subcategoria: 'MKT - Gestão redes socias' })).toBe(false)
    expect(ehAnuncio({ categoria: 'Serviços', subcategoria: 'Anúncios' })).toBe(false)
    expect(ehAnuncio({ categoria: 'Publicidade / Marketing', subcategoria: null })).toBe(false)
  })
})

describe('calcularCustoPorLead', () => {
  it('divide os anúncios pelas leads, só nos meses que têm as duas coisas', () => {
    const c = calcularCustoPorLead(
      [
        { data: '2026-06-01', valor: 150 }, // mês sem leads registadas: não conta
        { data: '2026-10-01', valor: 100 },
        { data: '2026-11-01', valor: 400 },
      ],
      [...leads('2026-10', 5), ...leads('2026-11', 15)],
      '2026-11'
    )
    expect(c).toMatchObject({ valor: 25, anuncios: 500, leads: 20, motivo: 'ok' })
    expect(c.meses.map((m) => m.mes)).toEqual(['2026-10', '2026-11'])
    expect(c.meses[1].aDecorrer).toBe(true)
    expect(explicarCustoPorLead(c)).toContain('inclui o mês a decorrer')
  })

  it('com poucas leads não dá número', () => {
    const c = calcularCustoPorLead([{ data: '2026-09-01', valor: 68.62 }], leads('2026-09', 1), '2026-11')
    expect(c).toMatchObject({ valor: null, motivo: 'poucas-leads', leads: 1 })
    expect(explicarCustoPorLead(c)).toContain('pelo menos 5 leads')
  })

  it('leads sem anúncios lançados nesses meses: diz que falta a despesa', () => {
    const c = calcularCustoPorLead([{ data: '2026-06-01', valor: 150 }], leads('2026-11', 17), '2026-11')
    expect(c).toMatchObject({ valor: null, motivo: 'sem-anuncios' })
    expect(explicarCustoPorLead(c)).toContain('MKT - Anúncios')
  })

  it('não olha para lá da janela de meses', () => {
    const c = calcularCustoPorLead([{ data: '2025-01-01', valor: 999 }], leads('2025-01', 50), '2026-11', 6)
    expect(c.valor).toBeNull()
  })
})

describe('mês a mês', () => {
  it('dá o custo de cada mês e muda quando o valor do anúncio muda', () => {
    const conta = (valorNovembro: number) =>
      calcularCustoPorLead([{ data: '2026-11-01', valor: valorNovembro }], leads('2026-11', 9), '2026-11')
    const novembro = (c: ReturnType<typeof conta>) => c.todosOsMeses.find((m) => m.mes === '2026-11')
    expect(custoPorLeadDoMes(novembro(conta(400)))).toBe(44.44)
    expect(custoPorLeadDoMes(novembro(conta(180)))).toBe(20)
    expect(conta(180).valor).toBe(20)
    // todos os meses da janela aparecem, mesmo os vazios
    expect(conta(400).todosOsMeses.map((m) => m.mes)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(custoPorLeadDoMes(conta(400).todosOsMeses[0])).toBeNull()
  })

  it('a janela pode acabar num mês passado, sem o dar como "a decorrer"', () => {
    const c = calcularCustoPorLead([{ data: '2026-09-01', valor: 70 }], leads('2026-09', 7), '2026-09', 3, '2026-11')
    expect(c).toMatchObject({ valor: 10, motivo: 'ok' })
    expect(c.meses[0].aDecorrer).toBe(false)
  })
})
