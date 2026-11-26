import { describe, expect, it } from 'vitest'
import { calcularRelatorioComercial, canalDaOrigem, periodosDoRelatorio, type DadosRelatorioComercial, type LeadRelatorio } from './relatorioComercial'

const lead = (id: string, extra: Partial<LeadRelatorio> = {}): LeadRelatorio => ({
  id,
  origem: 'Meta Ads',
  walk_in: false,
  walk_in_tipo: null,
  estado: 'Nova',
  entrada: '2026-11-10',
  fecho_em: null,
  ...extra,
})

describe('canalDaOrigem', () => {
  it('junta as várias formas de escrever a mesma origem', () => {
    expect(canalDaOrigem('Meta Ads')).toBe('Formulário Meta')
    expect(canalDaOrigem('Website')).toBe('Landing page')
    expect(canalDaOrigem('instagram')).toBe('Chat Instagram')
    expect(canalDaOrigem('Chamada telefónica')).toBe('Call-in')
    expect(canalDaOrigem('Indicação')).toBe('Member-get-member')
    expect(canalDaOrigem('E-mail')).toBe('Email')
    expect(canalDaOrigem(' walk-in ')).toBe('Walk-in')
  })
  it('uma origem desconhecida fica com o nome que tem; vazia é "Sem origem"', () => {
    expect(canalDaOrigem('Google Forms')).toBe('Google Forms')
    expect(canalDaOrigem('  ')).toBe('Sem origem')
    expect(canalDaOrigem(null)).toBe('Sem origem')
  })
})

describe('calcularRelatorioComercial', () => {
  const dados: DadosRelatorioComercial = {
    leads: [
      lead('a'),
      lead('b', { origem: 'Website' }),
      lead('c', { origem: 'instagram', estado: 'Ganha', fecho_em: '2026-11-20' }),
      lead('d', { origem: 'Feira de Ourém' }),
      lead('e', { origem: null }),
      lead('w1', { origem: 'Walk-in', walk_in: true, walk_in_tipo: 'Passagem', estado: 'Ganha', fecho_em: '2026-11-12' }),
      lead('w2', { origem: 'Walk-in', walk_in: true }),
      lead('fora', { entrada: '2026-10-30' }),
    ],
    contactos: [
      { lead_id: 'a', data: '2026-11-11', sucesso: true },
      { lead_id: 'a', data: '2026-11-12', sucesso: true },
      { lead_id: 'b', data: '2026-11-11', sucesso: false },
      { lead_id: 'c', data: '2026-11-11', sucesso: true },
      { lead_id: 'd', data: '2026-11-11', sucesso: null },
      { lead_id: 'a', data: '2026-10-31', sucesso: true },
    ],
    sessoes: [
      { lead_id: 'a', data: '2026-11-14', marcadaEm: '2026-11-12', cancelada: true, concluida: false },
      { lead_id: 'c', data: '2026-11-15', marcadaEm: '2026-11-11', cancelada: false, concluida: false },
      { lead_id: 'b', data: '2026-11-16', marcadaEm: '2026-11-13', cancelada: false, concluida: false },
      { lead_id: 'd', data: '2026-12-02', marcadaEm: '2026-11-20', cancelada: false, concluida: false },
    ],
    compareceram: new Set(['c']),
  }
  const m = calcularRelatorioComercial(dados, '2026-11-01', '2026-12-01', '2026-11-26')

  it('leads por origem, com os walk-ins à parte', () => {
    expect(m.leads).toBe(5)
    expect(Object.fromEntries(m.porCanal.map((c) => [c.nome, c.n]))).toMatchObject({ 'Formulário Meta': 1, 'Landing page': 1, 'Chat Instagram': 1, 'Call-in': 0 })
    expect(m.outrasOrigens).toEqual([
      { nome: 'Feira de Ourém', n: 1 },
      { nome: 'Sem origem', n: 1 },
    ])
    expect(m.walkIns).toBe(2)
    expect(Object.fromEntries(m.walkInsPorTipo.map((c) => [c.nome, c.n]))).toEqual({ Passagem: 1, 'Member-get-member': 0, 'Redes sociais': 0, 'Por classificar': 1 })
  })

  it('contactos: sem indicação de sucesso conta como sem sucesso; leads contactadas não se repetem', () => {
    expect([m.contactosSucesso, m.contactosSemSucesso, m.contactosTotal]).toEqual([3, 2, 5])
    expect(m.leadsContactadas).toBe(2)
    expect(m.taxaContacto).toBeCloseTo(2 / 5)
  })

  it('marcações pelo dia em que foram feitas; visitas pelo dia para que estavam marcadas', () => {
    expect(m.marcacoes).toBe(4)
    expect(m.taxaMarcacao).toBeCloseTo(4 / 3)
    expect(m.emAgenda).toBe(3)
    expect(m.visitas).toBe(1)
    expect(m.visitasPorRegistar).toBe(1)
    expect(m.taxaComparencia).toBeCloseTo(1 / 3)
  })

  it('inscrições de visitas, de walk-ins e total', () => {
    expect([m.inscricoesVisitas, m.walkInsFechados, m.totalInscricoes]).toEqual([1, 1, 2])
    expect(m.taxaFechoVisitas).toBe(1)
    expect(m.taxaFechoWalkIns).toBe(0.5)
  })

  it('sem nada no período, as taxas ficam por calcular (não dão zero)', () => {
    const vazio = calcularRelatorioComercial(dados, '2026-01-01', '2026-01-02', '2026-11-26')
    expect(vazio.leads).toBe(0)
    expect([vazio.taxaContacto, vazio.taxaMarcacao, vazio.taxaComparencia, vazio.taxaFechoVisitas, vazio.taxaFechoWalkIns]).toEqual([null, null, null, null, null])
  })
})

describe('periodosDoRelatorio', () => {
  it('dia, mês até ao dia e ano até ao dia', () => {
    expect(periodosDoRelatorio('2026-11-26')).toEqual({ dia: ['2026-11-26', '2026-11-27'], mes: ['2026-11-01', '2026-11-27'], ano: ['2026-01-01', '2026-11-27'] })
    expect(periodosDoRelatorio('2026-12-31').dia).toEqual(['2026-12-31', '2027-01-01'])
  })
})
