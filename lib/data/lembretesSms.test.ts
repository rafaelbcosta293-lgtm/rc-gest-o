import { describe, expect, it } from 'vitest'
import {
  dataDeAmanhaEmLisboa,
  nomeDiaSemana,
  preencherTemplateLembrete,
  proximoDiaAlvoLembrete,
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

  it('usa só o primeiro nome quando o nome do cliente é composto', () => {
    const texto = preencherTemplateLembrete('Olá {nome}!', {
      nome: 'José Manuel Antunes Alves de Freitas',
      data: '2026-11-03',
      horaInicio: '10:00:00',
    })
    expect(texto).toBe('Olá José!')
  })
})

describe('proximoDiaAlvoLembrete', () => {
  it('no Fátima, salta de domingo para segunda — o lembrete de segunda sai no sábado', () => {
    // 2026-11-08 é domingo, 2026-11-09 é segunda (confirmado acima).
    expect(proximoDiaAlvoLembrete('2026-11-08', 'fatima')).toBe('2026-11-09')
  })

  it('não mexe em dias que não sejam de fecho', () => {
    expect(proximoDiaAlvoLembrete('2026-11-07', 'fatima')).toBe('2026-11-07') // sábado
    expect(proximoDiaAlvoLembrete('2026-11-09', 'fatima')).toBe('2026-11-09') // segunda
  })

  it('não mexe em estúdios sem dias de fecho configurados (ex.: Leiria)', () => {
    expect(proximoDiaAlvoLembrete('2026-11-08', 'leiria')).toBe('2026-11-08')
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
