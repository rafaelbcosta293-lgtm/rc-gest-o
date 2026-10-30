import { describe, expect, it } from 'vitest'
import { parseCsv, leadsDeCsv, gerarCsv } from './csv'

describe('parseCsv', () => {
  it('separa linhas e campos simples por vírgula', () => {
    const linhas = parseCsv('a,b,c\n1,2,3')
    expect(linhas).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('respeita aspas duplas, incluindo vírgulas e aspas escapadas dentro do campo', () => {
    const linhas = parseCsv('nome,nota\n"Silva, João","disse ""sim"""')
    expect(linhas).toEqual([
      ['nome', 'nota'],
      ['Silva, João', 'disse "sim"'],
    ])
  })

  it('aceita quebras de linha \\r\\n e ignora uma linha final vazia', () => {
    const linhas = parseCsv('a,b\r\n1,2\r\n')
    expect(linhas).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('leadsDeCsv', () => {
  it('lê as colunas reconhecidas pelo cabeçalho, em qualquer ordem', () => {
    const csv = 'telefone,nome,origem\n912345678,Ana Silva,Instagram'
    const { leads, erros } = leadsDeCsv(csv)
    expect(erros).toHaveLength(0)
    expect(leads).toEqual([
      {
        nome: 'Ana Silva',
        telefone: '912345678',
        email: null,
        origem: 'Instagram',
        campanha: null,
        modalidade_interesse: null,
        objetivo: null,
        interesse: null,
        valor_potencial: null,
        temperatura: null,
      },
    ])
  })

  it('ignora acentos e maiúsculas no cabeçalho ("Modalidade" = modalidade_interesse)', () => {
    const csv = 'Nome,Modalidade\nBruno,Treino Personalizado'
    const { leads } = leadsDeCsv(csv)
    expect(leads[0].modalidade_interesse).toBe('Treino Personalizado')
  })

  it('marca como erro qualquer linha sem nome, sem a incluir nos leads', () => {
    const csv = 'nome,telefone\n,912345678\nCarla,923456789'
    const { leads, erros } = leadsDeCsv(csv)
    expect(leads).toHaveLength(1)
    expect(leads[0].nome).toBe('Carla')
    expect(erros).toEqual([{ linha: 2, mensagem: 'Sem nome — linha ignorada' }])
  })

  it('aceita vírgula como separador decimal em valor_potencial', () => {
    const csv = 'nome,valor_potencial\nDiana,49,90'.replace('49,90', '"49,90"')
    const { leads } = leadsDeCsv(csv)
    expect(leads[0].valor_potencial).toBe(49.9)
  })

  it('ficheiro vazio devolve listas vazias', () => {
    expect(leadsDeCsv('')).toEqual({ leads: [], erros: [] })
  })
})

describe('gerarCsv', () => {
  const colunas = [
    { chave: 'nome', label: 'Nome' },
    { chave: 'nota', label: 'Nota' },
  ]

  it('gera o cabeçalho a partir dos labels, e uma linha por registo', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Ana', nota: 'ok' }])
    expect(csv).toBe('Nome,Nota\r\nAna,ok')
  })

  it('escapa campos com vírgula, aspas ou quebra de linha', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Silva, João', nota: 'disse "sim"' }])
    expect(csv).toBe('Nome,Nota\r\n"Silva, João","disse ""sim"""')
  })

  it('trata null/undefined como campo vazio', () => {
    const csv = gerarCsv(colunas, [{ nome: 'Ana', nota: null }])
    expect(csv).toBe('Nome,Nota\r\nAna,')
  })

  it('o resultado é lido de volta pelo parseCsv tal como foi gerado', () => {
    const linhas = [{ nome: 'Silva, João', nota: 'disse "sim"' }, { nome: 'Bruno', nota: null }]
    const csv = gerarCsv(colunas, linhas)
    const lido = parseCsv(csv)
    expect(lido).toEqual([
      ['Nome', 'Nota'],
      ['Silva, João', 'disse "sim"'],
      ['Bruno', ''],
    ])
  })
})
