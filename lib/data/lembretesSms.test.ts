import { describe, expect, it } from 'vitest'
import {
  dataDeAmanhaEmLisboa,
  estadoParaBanner,
  nomeDiaSemana,
  preencherTemplateLembrete,
  TEMPLATE_LEMBRETE_OMISSAO,
} from './lembretesSms'

describe('nomeDiaSemana', () => {
  it('devolve o nome por extenso, em minúsculas', () => {
    expect(nomeDiaSemana('2026-11-03')).toBe('terça-feira') // confirmado: 3 nov 2026 é terça
    expect(nomeDiaSemana('2026-11-07')).toBe('sábado')
    expect(nomeDiaSemana('2026-11-08')).toBe('domingo')
    expect(nomeDiaSemana('2026-11-02')).toBe('segunda-feira')
  })
})

describe('preencherTemplateLembrete', () => {
  it('substitui todas as variáveis do template padrão', () => {
    const texto = preencherTemplateLembrete(TEMPLATE_LEMBRETE_OMISSAO, {
      nome: 'Ana',
      data: '2026-11-03',
      horaInicio: '10:00:00',
    })
    expect(texto).toBe(
      'Olá Ana! Lembramos que o teu treino é terça-feira, dia 3, às 10:00. Contamos contigo! ' +
        'Com os melhores cumprimentos, Equipa RC Private Fitness Studio'
    )
  })

  it('aceita templates personalizados com as variáveis em qualquer ordem', () => {
    const texto = preencherTemplateLembrete('{hora} · {dia_semana} · {dia_mes} · {nome}', {
      nome: 'Bruno',
      data: '2026-11-07',
      horaInicio: '18:30:00',
    })
    expect(texto).toBe('18:30 · sábado · 7 · Bruno')
  })
})

describe('estadoParaBanner', () => {
  it('não mostra a faixa com menos de 3 falhas consecutivas', () => {
    expect(estadoParaBanner({ tentativas_falhadas: 0, offline_desde: null })).toEqual({
      offline: false,
      desde: null,
    })
    expect(estadoParaBanner({ tentativas_falhadas: 2, offline_desde: '2026-10-31T10:00:00Z' })).toEqual({
      offline: false,
      desde: null,
    })
  })

  it('mostra a faixa a partir de 3 falhas consecutivas, com a hora do início da crise', () => {
    expect(estadoParaBanner({ tentativas_falhadas: 3, offline_desde: '2026-10-31T10:00:00Z' })).toEqual({
      offline: true,
      desde: '2026-10-31T10:00:00Z',
    })
    expect(estadoParaBanner({ tentativas_falhadas: 5, offline_desde: '2026-10-31T10:00:00Z' })).toEqual({
      offline: true,
      desde: '2026-10-31T10:00:00Z',
    })
  })
})

describe('dataDeAmanhaEmLisboa', () => {
  it('soma um dia à data de Lisboa, não à data UTC', () => {
    // 23:30 UTC de 14 de junho já é 00:30 de 15 de junho em Lisboa
    // (verão, UTC+1) — se se somasse 1 dia à data UTC (14), em vez da
    // data de Lisboa (15), o resultado ficaria um dia atrasado.
    const data = new Date('2026-06-14T23:30:00Z')
    expect(dataDeAmanhaEmLisboa(data)).toBe('2026-06-16')
  })
})
