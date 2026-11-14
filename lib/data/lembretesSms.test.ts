import { describe, expect, it } from 'vitest'
import {
  dataDeAmanhaEmLisboa,
  nomeDiaSemana,
  preencherTemplateLembrete,
  proximoDiaAlvoLembrete,
  TEMPLATE_LEMBRETE_OMISSAO,
  templateSabadoDerivado,
  trocarAmanhaPorProximo,
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

  it('nome preferido sobrepõe-se ao primeiro nome', () => {
    const texto = preencherTemplateLembrete('Olá {nome}!', {
      nome: 'Rui Pedro Catarino',
      data: '2026-11-03',
      horaInicio: '10:00:00',
      nomePreferido: 'Pedro',
    })
    expect(texto).toBe('Olá Pedro!')
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

  it('Leiria também fecha ao domingo — o lembrete de segunda sai no sábado', () => {
    expect(proximoDiaAlvoLembrete('2026-11-15', 'leiria')).toBe('2026-11-16')
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

describe('lembrete de sábado (para segunda-feira)', () => {
  const template =
    'Bom dia {nome}! Lembramos que amanhã, {dia_semana}, dia {dia_mes}, às {hora}, tem o seu treino no RC Private Fitness Studio.'

  it('diz "na próxima segunda-feira" em vez de "amanhã"', () => {
    const texto = preencherTemplateLembrete(template, {
      nome: 'Ana Costa',
      data: '2026-11-16',
      horaInicio: '10:00:00',
      naoEAmanha: true,
    })
    expect(texto).toBe(
      'Bom dia Ana! Lembramos que na próxima segunda-feira, dia 16, às 10:00, tem o seu treino no RC Private Fitness Studio.'
    )
  })

  it('nos outros dias mantém "amanhã"', () => {
    const texto = preencherTemplateLembrete(template, { nome: 'Ana Costa', data: '2026-11-17', horaInicio: '07:30:00' })
    expect(texto).toBe(
      'Bom dia Ana! Lembramos que amanhã, terça-feira, dia 17, às 07:30, tem o seu treino no RC Private Fitness Studio.'
    )
  })

  it('funciona também com "amanhã" sem o dia da semana a seguir', () => {
    expect(trocarAmanhaPorProximo('O teu treino é amanhã às {hora}.', '2026-11-16')).toBe(
      'O teu treino é na próxima segunda-feira às {hora}.'
    )
  })
})

describe('modelo próprio do sábado', () => {
  const diario = 'Olá {nome}! Amanhã, {dia_semana}, às {hora}, tens treino.'

  it('usa o modelo de sábado quando existe', () => {
    const texto = preencherTemplateLembrete(diario, {
      nome: 'Ana Costa',
      data: '2026-11-16',
      horaInicio: '09:00:00',
      naoEAmanha: true,
      templateSabado: 'Bom fim de semana, {nome}! Segunda ({dia_mes}) às {hora} contamos contigo.',
    })
    expect(texto).toBe('Bom fim de semana, Ana! Segunda (16) às 09:00 contamos contigo.')
  })

  it('sem modelo de sábado (ou vazio), cai no diário com "amanhã" trocado', () => {
    const texto = preencherTemplateLembrete(diario, {
      nome: 'Ana Costa',
      data: '2026-11-16',
      horaInicio: '09:00:00',
      naoEAmanha: true,
      templateSabado: '   ',
    })
    expect(texto).toBe('Olá Ana! na próxima segunda-feira, às 09:00, tens treino.')
  })

  it('o modelo de sábado nunca é usado nos outros dias', () => {
    const texto = preencherTemplateLembrete(diario, {
      nome: 'Ana Costa',
      data: '2026-11-17',
      horaInicio: '09:00:00',
      templateSabado: 'NÃO',
    })
    expect(texto).toBe('Olá Ana! Amanhã, terça-feira, às 09:00, tens treino.')
  })

  it('deriva o ponto de partida a partir do modelo diário', () => {
    expect(templateSabadoDerivado('Lembramos que amanhã, {dia_semana}, dia {dia_mes}')).toBe(
      'Lembramos que na próxima {dia_semana}, dia {dia_mes}'
    )
  })
})
