/**
 * Gera os ícones da app (PWA, favicon e ícone do iPhone) a partir do
 * símbolo da Fatijardins (o mesmo de components/logotipo.tsx).
 *
 * Uso: node scripts/gerar-icones.mjs
 *
 * Quando existir o logótipo oficial, altere FOLHA/CORES aqui e em
 * components/logotipo.tsx e volte a correr o script.
 * Usa o sharp, que já vem instalado com o Next.js.
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

const VERDE = "#15803d"
const FOLHA_COR = "#dcfce7"
const FOLHA =
  "M47 15C30 15 18 24 18 38c0 4 1 7 3 10 2-9 8-17 17-22-7 6-11 13-13 23 3 1 5 1 8 1 13 0 19-11 17-35z"

/** Símbolo normal: quadrado verde de cantos arredondados (fundo transparente). */
function svgArredondado(tamanho) {
  const dimensoes = tamanho ? ` width="${tamanho}" height="${tamanho}"` : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dimensoes}>
  <rect width="64" height="64" rx="16" fill="${VERDE}"/>
  <path d="${FOLHA}" fill="${FOLHA_COR}"/>
</svg>
`
}

/**
 * Fundo verde a cheio, sem cantos, com a folha reduzida ao centro.
 * Para ícones "maskable" (Android corta-os em círculo/forma própria) e
 * para o iPhone (que arredonda os cantos sozinho).
 */
function svgCheio(tamanho, escala) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${tamanho}" height="${tamanho}">
  <rect width="64" height="64" fill="${VERDE}"/>
  <g transform="translate(32 32) scale(${escala}) translate(-32 -32)">
    <path d="${FOLHA}" fill="${FOLHA_COR}"/>
  </g>
</svg>
`
}

function png(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}

/** Junta vários PNG num ficheiro .ico (formato com PNG embutido). */
function criarIco(imagens) {
  const cabecalho = Buffer.alloc(6)
  cabecalho.writeUInt16LE(0, 0) // reservado
  cabecalho.writeUInt16LE(1, 2) // tipo: ícone
  cabecalho.writeUInt16LE(imagens.length, 4)

  let posicao = 6 + imagens.length * 16
  const entradas = imagens.map(({ tamanho, dados }) => {
    const entrada = Buffer.alloc(16)
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0) // largura
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1) // altura
    entrada.writeUInt8(0, 2) // cores da paleta
    entrada.writeUInt8(0, 3) // reservado
    entrada.writeUInt16LE(1, 4) // planos
    entrada.writeUInt16LE(32, 6) // bits por píxel
    entrada.writeUInt32LE(dados.length, 8)
    entrada.writeUInt32LE(posicao, 12)
    posicao += dados.length
    return entrada
  })

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map(({ dados }) => dados)])
}

async function gravar(relativo, conteudo) {
  const destino = path.join(RAIZ, relativo)
  await mkdir(path.dirname(destino), { recursive: true })
  await writeFile(destino, conteudo)
  console.log(`✓ ${relativo}`)
}

await gravar("public/icons/icon.svg", svgArredondado())
await gravar("public/icons/icon-192.png", await png(svgArredondado(192)))
await gravar("public/icons/icon-512.png", await png(svgArredondado(512)))
// A folha fica dentro da "zona segura" (círculo central de 80%).
await gravar("public/icons/icon-maskable-512.png", await png(svgCheio(512, 0.8)))
await gravar("public/icons/apple-touch-icon.png", await png(svgCheio(180, 0.9)))

// Convenções de metadata do Next.js: geram as <link rel="icon"> e
// <link rel="apple-touch-icon"> automaticamente.
await gravar("app/icon.svg", svgArredondado())
await gravar("app/apple-icon.png", await png(svgCheio(180, 0.9)))

const tamanhosFavicon = [16, 32, 48]
const imagensFavicon = await Promise.all(
  tamanhosFavicon.map(async (tamanho) => ({ tamanho, dados: await png(svgArredondado(tamanho)) }))
)
await gravar("app/favicon.ico", criarIco(imagensFavicon))
