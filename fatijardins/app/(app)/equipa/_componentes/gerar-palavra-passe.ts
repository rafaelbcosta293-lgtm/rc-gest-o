/**
 * Gera uma palavra-passe temporária fácil de ler e ditar ao telefone,
 * ex.: "Cedro-Lavanda-4821" (sem acentos nem carateres ambíguos).
 */
const PALAVRAS = [
  "Alecrim", "Buxo", "Cedro", "Folha", "Hera", "Horta", "Lavanda", "Lirio", "Louro", "Murta",
  "Oliveira", "Pinho", "Ramo", "Relva", "Rosa", "Salvia", "Sebe", "Tulipa", "Vaso", "Videira",
]

function aleatorio(maximo: number) {
  const valores = new Uint32Array(1)
  crypto.getRandomValues(valores)
  return valores[0] % maximo
}

export function gerarPalavraPasse() {
  const primeira = PALAVRAS[aleatorio(PALAVRAS.length)]
  let segunda = PALAVRAS[aleatorio(PALAVRAS.length)]
  while (segunda === primeira) segunda = PALAVRAS[aleatorio(PALAVRAS.length)]
  const numero = String(1000 + aleatorio(9000))
  return `${primeira}-${segunda}-${numero}`
}
