// Parser de CSV simples (vírgulas, aspas duplas para escapar vírgulas e
// quebras de linha) — suficiente para a importação de leads, sem
// precisar de uma dependência externa para um ficheiro tipicamente
// pequeno (algumas centenas de linhas). XLSX/Google Sheets ficam de
// fora do v1, só CSV.
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let linhaAtual: string[] = []
  let campoAtual = ''
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campoAtual += '"'
          i++
        } else {
          dentroDeAspas = false
        }
      } else {
        campoAtual += c
      }
      continue
    }
    if (c === '"') {
      dentroDeAspas = true
    } else if (c === ',') {
      linhaAtual.push(campoAtual)
      campoAtual = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linhaAtual.push(campoAtual)
      linhas.push(linhaAtual)
      linhaAtual = []
      campoAtual = ''
    } else {
      campoAtual += c
    }
  }
  if (campoAtual !== '' || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual)
    linhas.push(linhaAtual)
  }
  return linhas.filter((l) => !(l.length === 1 && l[0] === ''))
}

export type LeadImportado = {
  nome: string
  telefone: string | null
  email: string | null
  origem: string | null
  campanha: string | null
  modalidade_interesse: string | null
  objetivo: string | null
  interesse: string | null
  valor_potencial: number | null
  temperatura: string | null
}

export const COLUNAS_CSV_LEADS = [
  'nome',
  'telefone',
  'email',
  'origem',
  'campanha',
  'modalidade_interesse',
  'objetivo',
  'interesse',
  'valor_potencial',
  'temperatura',
] as const

const COLUNAS_RECONHECIDAS: Record<string, keyof LeadImportado> = {
  nome: 'nome',
  telefone: 'telefone',
  email: 'email',
  origem: 'origem',
  campanha: 'campanha',
  modalidade_interesse: 'modalidade_interesse',
  modalidade: 'modalidade_interesse',
  objetivo: 'objetivo',
  interesse: 'interesse',
  valor_potencial: 'valor_potencial',
  temperatura: 'temperatura',
}

function normalizarCabecalho(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
}

export type ResultadoImportacaoCsv = {
  leads: LeadImportado[]
  erros: { linha: number; mensagem: string }[]
}

export function leadsDeCsv(texto: string): ResultadoImportacaoCsv {
  const linhas = parseCsv(texto)
  if (linhas.length === 0) return { leads: [], erros: [] }

  const cabecalho = linhas[0].map(normalizarCabecalho)
  const indices: Partial<Record<keyof LeadImportado, number>> = {}
  cabecalho.forEach((c, i) => {
    const chave = COLUNAS_RECONHECIDAS[c]
    if (chave && indices[chave] === undefined) indices[chave] = i
  })

  const leads: LeadImportado[] = []
  const erros: { linha: number; mensagem: string }[] = []

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i]
    const numeroLinha = i + 1 // 1-based, contando com o cabeçalho

    const campo = (chave: keyof LeadImportado) => {
      const idx = indices[chave]
      if (idx === undefined) return ''
      return (linha[idx] ?? '').trim()
    }

    const nome = campo('nome')
    if (!nome) {
      erros.push({ linha: numeroLinha, mensagem: 'Sem nome — linha ignorada' })
      continue
    }

    const valorTexto = campo('valor_potencial')
    const valor = valorTexto ? Number(valorTexto.replace(',', '.')) : null

    leads.push({
      nome,
      telefone: campo('telefone') || null,
      email: campo('email') || null,
      origem: campo('origem') || null,
      campanha: campo('campanha') || null,
      modalidade_interesse: campo('modalidade_interesse') || null,
      objetivo: campo('objetivo') || null,
      interesse: campo('interesse') || null,
      valor_potencial: valor !== null && Number.isFinite(valor) ? valor : null,
      temperatura: campo('temperatura') || null,
    })
  }

  return { leads, erros }
}
