/**
 * Compressão de fotos no browser antes de as enviar para o Storage.
 * As fotos do telemóvel têm muitas vezes 4–12 MB; reduzidas a 1600 px no
 * lado maior e gravadas em JPEG ficam com 200–500 KB, o que poupa dados
 * móveis e torna o envio rápido mesmo com pouca rede.
 * Só funciona no browser (usa canvas).
 */

export const LADO_MAXIMO_FOTO = 1600
export const QUALIDADE_JPEG = 0.8

export type ImagemComprimida = {
  blob: Blob
  largura: number
  altura: number
}

type ImagemCarregada = {
  imagem: CanvasImageSource
  largura: number
  altura: number
  libertar: () => void
}

/** Abre a imagem já rodada segundo o EXIF (fotos tiradas com o telemóvel ao alto). */
async function carregarImagem(ficheiro: Blob): Promise<ImagemCarregada> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(ficheiro, { imageOrientation: "from-image" })
      return { imagem: bitmap, largura: bitmap.width, altura: bitmap.height, libertar: () => bitmap.close() }
    } catch {
      // Alguns browsers não aceitam as opções ou o formato: tentar com <img>.
    }
  }

  const url = URL.createObjectURL(ficheiro)
  try {
    const img = new Image()
    img.decoding = "async"
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("Não foi possível abrir a imagem."))
      img.src = url
    })
    // O <img> aplica a orientação do EXIF por omissão (image-orientation: from-image).
    return {
      imagem: img,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      libertar: () => URL.revokeObjectURL(url),
    }
  } catch (erro) {
    URL.revokeObjectURL(url)
    throw erro
  }
}

/**
 * Reduz a imagem (lado maior até ladoMaximo, nunca aumenta) e converte-a
 * em JPEG. Fundos transparentes (PNG) ficam brancos.
 */
export async function comprimirImagem(
  ficheiro: Blob,
  { ladoMaximo = LADO_MAXIMO_FOTO, qualidade = QUALIDADE_JPEG }: { ladoMaximo?: number; qualidade?: number } = {}
): Promise<ImagemComprimida> {
  const origem = await carregarImagem(ficheiro)
  try {
    if (!origem.largura || !origem.altura) throw new Error("Imagem sem dimensões.")
    const escala = Math.min(1, ladoMaximo / Math.max(origem.largura, origem.altura))
    const largura = Math.max(1, Math.round(origem.largura * escala))
    const altura = Math.max(1, Math.round(origem.altura * escala))

    const canvas = document.createElement("canvas")
    canvas.width = largura
    canvas.height = altura
    const contexto = canvas.getContext("2d")
    if (!contexto) throw new Error("O browser não permite processar imagens.")
    contexto.fillStyle = "#ffffff"
    contexto.fillRect(0, 0, largura, altura)
    contexto.imageSmoothingEnabled = true
    contexto.imageSmoothingQuality = "high"
    contexto.drawImage(origem.imagem, 0, 0, largura, altura)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade))
    // Liberta já a memória do canvas (importante no Safari do iPhone).
    canvas.width = 0
    canvas.height = 0
    if (!blob) throw new Error("Não foi possível converter a imagem.")
    return { blob, largura, altura }
  } finally {
    origem.libertar()
  }
}
