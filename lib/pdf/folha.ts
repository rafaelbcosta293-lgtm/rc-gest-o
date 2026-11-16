import { rgb, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'

// As peças comuns dos documentos em PDF (A4, ao alto): medidas, cores e
// a "Folha" — texto, parágrafos e tabelas com mudança de página.

export const LARGURA = 595.28
export const ALTURA = 841.89
export const MARGEM = 40
export const UTIL = LARGURA - 2 * MARGEM

export const PRETO = rgb(0.09, 0.09, 0.11)
export const CINZA = rgb(0.42, 0.42, 0.46)
export const LINHA = rgb(0.82, 0.82, 0.85)
export const FUNDO_CABECALHO = rgb(0.93, 0.93, 0.95)
export const FUNDO_FIM_DE_SEMANA = rgb(0.965, 0.965, 0.975)
export const DOURADO = rgb(0.72, 0.58, 0.24)


export type Coluna = { titulo: string; largura: number; direita?: boolean }

export class Folha {
  pagina!: PDFPage
  y = 0
  private seguros = new Map<string, string>()

  constructor(
    private doc: PDFDocument,
    private normal: PDFFont,
    private negrito: PDFFont
  ) {
    this.novaPagina()
  }

  novaPagina() {
    this.pagina = this.doc.addPage([LARGURA, ALTURA])
    this.y = ALTURA - MARGEM
  }

  // Garante espaço para mais "altura" pontos; senão muda de página.
  espaco(altura: number) {
    if (this.y - altura < MARGEM + 20) this.novaPagina()
  }

  // As letras-padrão do PDF só têm o alfabeto ocidental: o que não
  // existir (emojis, etc.) fica de fora em vez de fazer falhar o documento.
  seguro(texto: string): string {
    const guardado = this.seguros.get(texto)
    if (guardado !== undefined) return guardado
    let limpo = ''
    for (const letra of texto.replace(/\s+/g, ' ')) {
      try {
        this.normal.encodeText(letra)
        limpo += letra
      } catch {
        // fica de fora
      }
    }
    limpo = limpo.replace(/ +/g, ' ').trim()
    this.seguros.set(texto, limpo)
    return limpo
  }

  largura(texto: string, tamanho: number, negrito = false) {
    return (negrito ? this.negrito : this.normal).widthOfTextAtSize(this.seguro(texto), tamanho)
  }

  // Corta o texto (com "…") para caber na largura dada.
  caber(texto: string, larguraMax: number, tamanho: number, negrito = false): string {
    let t = this.seguro(texto)
    if (this.largura(t, tamanho, negrito) <= larguraMax) return t
    while (t.length > 1 && this.largura(`${t}…`, tamanho, negrito) > larguraMax) t = t.slice(0, -1)
    return `${t.trimEnd()}…`
  }

  texto(texto: string, x: number, y: number, { tamanho = 9, negrito = false, cor = PRETO, direita = false, larguraMax }: OpcoesTexto = {}) {
    const t = larguraMax ? this.caber(texto, larguraMax, tamanho, negrito) : this.seguro(texto)
    const posX = direita ? x - this.largura(t, tamanho, negrito) : x
    this.pagina.drawText(t, { x: posX, y, size: tamanho, font: negrito ? this.negrito : this.normal, color: cor })
  }

  // Um parágrafo que quebra linhas sozinho. Devolve nada; avança o "y".
  paragrafo(texto: string, { tamanho = 9, cor = PRETO, negrito = false }: OpcoesTexto = {}) {
    const palavras = this.seguro(texto).split(' ')
    let linha = ''
    const escrever = () => {
      this.espaco(tamanho + 4)
      this.texto(linha, MARGEM, this.y - tamanho, { tamanho, cor, negrito })
      this.y -= tamanho + 4
    }
    for (const palavra of palavras) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra
      if (this.largura(tentativa, tamanho, negrito) > UTIL && linha) {
        escrever()
        linha = palavra
      } else linha = tentativa
    }
    if (linha) escrever()
  }

  risco(cor = LINHA, espessura = 0.6) {
    this.pagina.drawLine({ start: { x: MARGEM, y: this.y }, end: { x: LARGURA - MARGEM, y: this.y }, thickness: espessura, color: cor })
  }

  cabecalhoTabela(colunas: Coluna[], altura = 16) {
    this.pagina.drawRectangle({ x: MARGEM, y: this.y - altura, width: UTIL, height: altura, color: FUNDO_CABECALHO })
    let x = MARGEM
    for (const c of colunas) {
      this.texto(c.titulo, c.direita ? x + c.largura - 4 : x + 4, this.y - altura + 5, { tamanho: 7.5, negrito: true, cor: CINZA, direita: c.direita, larguraMax: c.largura - 6 })
      x += c.largura
    }
    this.y -= altura
  }

  linhaTabela(colunas: Coluna[], valores: string[], { altura = 13, negrito = false, fundo, cor = PRETO }: { altura?: number; negrito?: boolean; fundo?: ReturnType<typeof rgb>; cor?: ReturnType<typeof rgb> } = {}) {
    if (fundo) this.pagina.drawRectangle({ x: MARGEM, y: this.y - altura, width: UTIL, height: altura, color: fundo })
    let x = MARGEM
    colunas.forEach((c, i) => {
      this.texto(valores[i] ?? '', c.direita ? x + c.largura - 4 : x + 4, this.y - altura + 4, { tamanho: 8, negrito, cor, direita: c.direita, larguraMax: c.largura - 6 })
      x += c.largura
    })
    this.y -= altura
    this.risco(LINHA, 0.4)
  }
}

export type OpcoesTexto = { tamanho?: number; negrito?: boolean; cor?: ReturnType<typeof rgb>; direita?: boolean; larguraMax?: number }
