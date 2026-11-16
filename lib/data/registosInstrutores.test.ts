import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { caminhoNoArquivo, mesAnterior, montarRegistosDoMes, nomeDoFicheiro, type DadosDoMes } from './registosInstrutores'
import { gerarPdfRegistos } from '@/lib/pdf/registosInstrutoresPdf'

const base: DadosDoMes = {
  ano: 2026,
  mes: 10,
  hoje: '2026-11-05',
  estudios: [
    { id: 1, nome: 'Fátima', slug: 'fatima' },
    { id: 2, nome: 'Leiria', slug: 'leiria' },
  ],
  perfis: [
    { id: 'carolina', nome: 'Carolina Ribeiro', ativo: true, eliminado_em: null },
    { id: 'daniela', nome: 'Daniela Gomes', ativo: false, eliminado_em: '2026-11-01T10:00:00Z' },
    { id: 'antigo', nome: 'Saiu Há Muito', ativo: false, eliminado_em: null },
    { id: 'dono', nome: 'Dono', ativo: true, eliminado_em: null },
    { id: 'miguel', nome: 'Miguel Lapas', ativo: true, eliminado_em: null },
  ],
  contasFixas: new Set(['dono']),
  ligacoes: [{ perfil_id: 'miguel', estudio_id: 2 }],
  configs: [{ perfil_id: 'carolina', estudio_id: 1, horas_diarias: '8.00', tipo_contrato: 'contrato' }],
  registos: [
    { perfil_id: 'carolina', data: '2026-10-01', entrada_1: '08:00:00', saida_1: '13:00:00', entrada_2: '14:00:00', saida_2: '18:00:00', horas: '9.00', ferias: false, nota: 'Formação à tarde 🏋️' },
    { perfil_id: 'carolina', data: '2026-10-02', entrada_1: null, saida_1: null, entrada_2: null, saida_2: null, horas: 0, ferias: true, nota: null },
    { perfil_id: 'carolina', data: '2026-09-30', entrada_1: '08:00:00', saida_1: '12:00:00', entrada_2: null, saida_2: null, horas: 4, ferias: false, nota: null },
    { perfil_id: 'daniela', data: '2026-10-06', entrada_1: '17:00:00', saida_1: '21:00:00', entrada_2: null, saida_2: null, horas: 4, ferias: false, nota: null },
  ],
  pedidosFerias: [{ perfil_id: 'carolina', dias: ['2026-10-12', '2026-10-13', '2026-11-02'] }],
  fechos: [{ perfil_id: 'carolina', estado: 'Aprovado', submetido_em: '2026-11-02T09:00:00Z', aprovado_em: '2026-11-03T09:00:00Z' }],
  ausencias: [{ pt_id: 'miguel', inicio: '2026-09-29', fim: '2026-10-02', tipo: 'Doença', nota: 'Baixa médica' }],
  escalas: [
    { pt_id: 'carolina', data: '2026-10-01', estudio_id: 1 },
    { pt_id: 'carolina', data: '2026-10-01', estudio_id: 1 },
    { pt_id: 'carolina', data: '2026-10-05', estudio_id: 1 },
    { pt_id: 'miguel', data: '2026-10-07', estudio_id: 2 },
  ],
}

describe('montarRegistosDoMes', () => {
  const mes = montarRegistosDoMes(base)
  const de = (id: string) => mes.instrutores.find((i) => i.id === id)!

  it('inclui a equipa ativa e quem saiu mas tem registos — nunca as contas do negócio', () => {
    expect(mes.instrutores.map((i) => i.id)).toEqual(['carolina', 'daniela', 'miguel'])
    expect(de('daniela').situacao).toBe('eliminado')
    expect(mes.ateDia).toBeUndefined()
  })

  it('junta horas, férias (pedidos e marcadas no registo) e estado do mês', () => {
    const c = de('carolina')
    expect(c.dias.map((d) => d.data)).toEqual(['2026-10-01', '2026-10-02'])
    expect(c.dias[0]).toMatchObject({ entrada1: '08:00', saida2: '18:00', horas: 9 })
    expect(c.resumo.horasRealizadas).toBe(9)
    expect(c.resumo.diasFerias).toEqual(['2026-10-02', '2026-10-12', '2026-10-13'])
    expect(c.estado).toBe('Aprovado')
    expect(c.estudioNome).toBe('Fátima')
  })

  it('conta a escala em horas (meia hora por turno) e por dia', () => {
    expect(de('carolina').horasEscala).toBe(1.5)
    expect(de('carolina').escalaPorDia).toEqual({ '2026-10-01': 1, '2026-10-05': 0.5 })
  })

  it('apanha as ausências que tocam no mês e conta só os dias do mês', () => {
    const m = de('miguel')
    expect(m.ausencias).toHaveLength(1)
    expect(m.diasDeAusencia).toBe(2)
    expect(m.estudioNome).toBe('Leiria')
    expect(m.tipoContrato).toBe('contrato')
  })

  it('num mês a decorrer, as contas vão só até hoje', () => {
    expect(montarRegistosDoMes({ ...base, hoje: '2026-10-15' }).ateDia).toBe('2026-10-15')
  })
})

describe('arquivo mensal', () => {
  it('o mês anterior', () => {
    expect(mesAnterior('2026-11-05')).toEqual({ ano: 2026, mes: 10 })
    expect(mesAnterior('2027-01-01')).toEqual({ ano: 2026, mes: 12 })
  })
  it('nomes dos ficheiros', () => {
    expect(caminhoNoArquivo(2026, 3)).toBe('registos-instrutores/2026-03.pdf')
    expect(nomeDoFicheiro(2026, 3)).toBe('registos-instrutores-2026-03.pdf')
  })
})

describe('gerarPdfRegistos', () => {
  it('faz um PDF com o resumo e uma página por instrutor', async () => {
    const bytes = await gerarPdfRegistos(montarRegistosDoMes(base), new Date('2026-11-05T06:20:00Z'))
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(4)
    expect(doc.getTitle()).toBe('Registos dos instrutores — outubro de 2026')
    if (process.env.PDF_DE_EXEMPLO) writeFileSync(process.env.PDF_DE_EXEMPLO, bytes)
  })

  it('também faz o documento de um mês sem ninguém', async () => {
    const bytes = await gerarPdfRegistos({ ano: 2026, mes: 1, instrutores: [] })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})
