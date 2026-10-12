// Remove acentos e ignora maiúsculas/minúsculas, para comparar nomes
// como a pessoa os escreve (ex.: "ale" encontra "Alexandre").
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
