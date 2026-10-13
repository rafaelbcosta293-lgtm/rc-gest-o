/** "Marta Fonseca" → "MF". */
export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ""
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

/** "912 345 001" → "tel:912345001". */
export function ligacaoTelefone(numero: string) {
  return `tel:${numero.replace(/[^\d+]/g, "")}`
}

export { normalizarPesquisa } from "@/lib/texto"

/** Os searchParams podem vir repetidos (?q=a&q=b): usa o primeiro. */
export function primeiroValor(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor
}

/** Número de dias de um intervalo aaaa-mm-dd, contando o primeiro e o último. */
export function contarDias(inicio: string, fim: string) {
  const dia = (data: string) => {
    const [ano, mes, d] = data.split("-").map(Number)
    return Date.UTC(ano, mes - 1, d) / 86_400_000
  }
  return dia(fim) - dia(inicio) + 1
}
