import { describe, expect, it } from 'vitest'
import {
  balancoMes,
  dataNoMes,
  estadoDespesa,
  proximoVencimento,
  sugerirRecorrentes,
  vencimentosEntre,
} from './despesas'

describe('vencimentos das recorrentes', () => {
  it('mensal, encostando ao último dia nos meses curtos', () => {
    const rec = { periodicidade: 'mensal' as const, dia_vencimento: 31, inicio: '2026-01-31', fim: null }
    expect(vencimentosEntre(rec, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('trimestral conta a partir do mês de início e respeita o fim', () => {
    const rec = { periodicidade: 'trimestral' as const, dia_vencimento: 20, inicio: '2026-02-20', fim: '2026-09-01' }
    expect(vencimentosEntre(rec, '2026-01-01', '2026-12-31')).toEqual(['2026-02-20', '2026-05-20', '2026-08-20'])
  })

  it('anual só no mês certo, e nunca antes do início', () => {
    const rec = { periodicidade: 'anual' as const, dia_vencimento: 15, inicio: '2026-05-15', fim: null }
    expect(vencimentosEntre(rec, '2026-11-01', '2027-06-30')).toEqual(['2027-05-15'])
    expect(vencimentosEntre({ ...rec, inicio: '2026-05-20' }, '2026-05-01', '2026-05-31')).toEqual([])
  })

  it('próximo vencimento a partir de hoje', () => {
    expect(proximoVencimento(8, '2026-11-14')).toBe('2026-12-08')
    expect(proximoVencimento(20, '2026-11-14')).toBe('2026-11-20')
    expect(dataNoMes('2028-02', 30)).toBe('2028-02-29')
  })
})

describe('estado e balanço', () => {
  const hoje = '2026-11-14'
  it('estados', () => {
    expect(estadoDespesa({ pago: true, vencimento: '2026-11-01', data: '2026-11-01', dias_aviso: 3 }, hoje)).toBe('paga')
    expect(estadoDespesa({ pago: false, vencimento: '2026-11-13', data: '2026-11-13', dias_aviso: 3 }, hoje)).toBe('em_atraso')
    expect(estadoDespesa({ pago: false, vencimento: '2026-11-16', data: '2026-11-16', dias_aviso: 3 }, hoje)).toBe('a_vencer')
    expect(estadoDespesa({ pago: false, vencimento: '2026-11-14', data: '2026-11-14', dias_aviso: 0 }, hoje)).toBe('a_vencer')
    expect(estadoDespesa({ pago: false, vencimento: '2026-11-25', data: '2026-11-25', dias_aviso: 3 }, hoje)).toBe('por_pagar')
    expect(estadoDespesa({ pago: false, vencimento: null, data: '2026-11-15', dias_aviso: null }, hoje)).toBe('a_vencer')
  })

  it('balanço do mês: pago, por pagar e em atraso, por categoria', () => {
    const b = balancoMes(
      [
        { categoria: 'Serviços', valor: 50, pago: true, vencimento: null, data: '2026-11-02', dias_aviso: null },
        { categoria: 'Impostos', valor: 200, pago: false, vencimento: '2026-11-10', data: '2026-11-10', dias_aviso: 3 },
        { categoria: 'Serviços', valor: 30.5, pago: false, vencimento: '2026-11-28', data: '2026-11-28', dias_aviso: 3 },
      ],
      hoje,
      ['Serviços', 'Impostos']
    )
    expect(b).toMatchObject({ total: 280.5, pago: 50, porPagar: 230.5, emAtraso: 200, nPorPagar: 2, nEmAtraso: 1 })
    expect(b.porCategoria.map((c) => c.categoria)).toEqual(['Serviços', 'Impostos'])
    expect(b.porCategoria[0]).toMatchObject({ total: 80.5, pago: 50, porPagar: 30.5 })
  })
})

describe('sugestões de recorrentes', () => {
  it('só o que aparece em 6+ dos últimos 12 meses e ainda não é recorrente', () => {
    const linhas = []
    for (let m = 1; m <= 10; m++) {
      const mes = `2026-${String(m).padStart(2, '0')}`
      linhas.push({ estudio_id: 1, data: `${mes}-01`, categoria: 'Amortizações/ Empréstimos', subcategoria: 'Renda', valor: 700 })
      if (m <= 3) linhas.push({ estudio_id: 1, data: `${mes}-01`, categoria: 'Consumíveis', subcategoria: 'Café', valor: 10 })
      linhas.push({ estudio_id: 1, data: `${mes}-01`, categoria: 'Serviços', subcategoria: 'Vodafone', valor: 30 })
    }
    const s = sugerirRecorrentes(linhas, '2026-11', [{ estudio_id: 1, categoria: 'Serviços', subcategoria: 'Vodafone' }])
    expect(s).toEqual([{ estudio_id: 1, categoria: 'Amortizações/ Empréstimos', subcategoria: 'Renda', meses: 10, valorMedio: 700 }])
  })
})
