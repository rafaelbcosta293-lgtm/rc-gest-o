import "server-only"

import { existsSync } from "node:fs"
import path from "node:path"

import { Font } from "@react-pdf/renderer"

/**
 * Fonte dos PDF: a Geist (a mesma da app), instalada por npm (pacote
 * "geist", licença SIL OFL) e lida do disco, sem pedidos à rede. Tem os
 * carateres de que precisamos (€, º, ç, ã, ², –, •, espaço inseparável…),
 * ao contrário da Helvetica base do PDF. O next.config.ts inclui estes
 * ficheiros na função do PDF (outputFileTracingIncludes).
 */
const PASTA_FONTES = path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans")

const PESOS = [
  { ficheiro: "Geist-Regular.ttf", fontWeight: 400 },
  { ficheiro: "Geist-SemiBold.ttf", fontWeight: 600 },
  { ficheiro: "Geist-Bold.ttf", fontWeight: 700 },
] as const

const FAMILIA = "Geist"

export type FontePdf = {
  familia: string
  /** Se a fonte tem o carater (código Unicode): os outros não se desenham bem. */
  temCarater: (codigo: number) => boolean
}

/** Latim (com acentos), pontuação, moedas, setas e símbolos usuais. */
const INTERVALOS_PREPARADOS = [
  [0x20, 0x24f],
  [0x2000, 0x20cf],
  [0x2100, 0x21ff],
] as const

/**
 * Carateres da Helvetica base do PDF (codificação WinAnsi): ASCII, Latin-1
 * e os símbolos da tabela do Windows (€, –, —, “ ”, ‘ ’, •, …, ™…).
 */
const WIN_ANSI = new Set<number>([
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i),
  ...Array.from({ length: 0x100 - 0xa0 }, (_, i) => 0xa0 + i),
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

const HELVETICA: FontePdf = { familia: "Helvetica", temCarater: (codigo) => WIN_ANSI.has(codigo) }

let preparacao: Promise<FontePdf> | null = null

/**
 * Carrega os três pesos. O fontkit guarda cada glifo em cache da primeira
 * vez que o usa. Ao gravar um PDF, os glifos compostos (Ç, ã, é…) carregam
 * as letras base (C, a, e) sem o carater associado e, nos PDF seguintes do
 * mesmo processo, essas letras ficavam sem texto (não se podiam copiar nem
 * pesquisar). Pedir já os carateres usuais deixa-os em cache com o carater certo.
 */
async function prepararGeist(): Promise<FontePdf> {
  const fontes: NonNullable<ReturnType<typeof Font.getFont>["data"]>[] = []
  for (const { fontWeight } of PESOS) {
    const fonte = Font.getFont({ fontFamily: FAMILIA, fontWeight })
    await fonte.load()
    if (!fonte.data) throw new Error(`PDF: não foi possível carregar a fonte ${FAMILIA} ${fontWeight}.`)
    for (const [inicio, fim] of INTERVALOS_PREPARADOS) {
      for (let carater = inicio; carater <= fim; carater++) fonte.data.glyphForCodePoint(carater)
    }
    fontes.push(fonte.data)
  }
  // Só conta o que os três pesos têm (o texto pode estar em qualquer um).
  return { familia: FAMILIA, temCarater: (codigo) => fontes.every((fonte) => fonte.hasGlyphForCodePoint(codigo)) }
}

/**
 * Regista e prepara a fonte (uma vez por processo) e devolve-a. Se os
 * ficheiros faltarem, usa a Helvetica (só com os carateres WinAnsi).
 */
export async function registarFontes(): Promise<FontePdf> {
  // Sem hifenização (as regras por omissão são do inglês): as palavras
  // passam inteiras para a linha seguinte; só as muito longas (endereços)
  // se partem para caberem na coluna.
  Font.registerHyphenationCallback((palavra) =>
    palavra.length > 24 ? (palavra.match(/.{1,12}/gu) ?? [palavra]) : [palavra]
  )

  if (!Font.getRegisteredFontFamilies().includes(FAMILIA)) {
    const fontes = PESOS.map(({ ficheiro, fontWeight }) => ({ src: path.join(PASTA_FONTES, ficheiro), fontWeight }))
    if (!fontes.every(({ src }) => existsSync(src))) {
      console.error(`PDF: fontes não encontradas em ${PASTA_FONTES}; a usar a Helvetica.`)
      return HELVETICA
    }
    Font.register({ family: FAMILIA, fonts: fontes })
  }

  preparacao ??= prepararGeist().catch((erro) => {
    preparacao = null
    throw erro
  })
  return preparacao
}
