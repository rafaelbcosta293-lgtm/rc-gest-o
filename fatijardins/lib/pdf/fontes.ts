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

/** Latim (com acentos), pontuação, moedas, setas e símbolos usuais. */
const INTERVALOS_PREPARADOS = [
  [0x20, 0x24f],
  [0x2000, 0x20cf],
  [0x2100, 0x21ff],
] as const

let preparacao: Promise<void> | null = null

/**
 * O fontkit guarda cada glifo em cache da primeira vez que o usa. Ao gravar
 * um PDF, os glifos compostos (Ç, ã, é…) carregam as letras base (C, a, e)
 * sem o carater associado e, nos PDF seguintes do mesmo processo, essas
 * letras ficavam sem texto (não se podiam copiar nem pesquisar). Pedir já
 * os carateres usuais deixa-os em cache com o carater certo.
 */
async function prepararGlifos() {
  for (const { fontWeight } of PESOS) {
    const fonte = Font.getFont({ fontFamily: FAMILIA, fontWeight })
    await fonte.load()
    for (const [inicio, fim] of INTERVALOS_PREPARADOS) {
      for (let carater = inicio; carater <= fim; carater++) fonte.data?.glyphForCodePoint(carater)
    }
  }
}

/**
 * Regista e prepara a fonte (uma vez por processo) e devolve a família a
 * usar. Se os ficheiros faltarem, usa a Helvetica (o texto é normalizado).
 */
export async function registarFontes(): Promise<string> {
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
      return "Helvetica"
    }
    Font.register({ family: FAMILIA, fonts: fontes })
  }

  preparacao ??= prepararGlifos().catch((erro) => {
    preparacao = null
    throw erro
  })
  await preparacao
  return FAMILIA
}
