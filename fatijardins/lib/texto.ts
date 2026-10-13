/** Minúsculas e sem acentos, para pesquisar "joao" e encontrar "João". */
export function normalizarPesquisa(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt").trim()
}

/**
 * Só os algarismos de um número de telefone ou NIF, sem o indicativo de
 * Portugal ("+351 912 345 678" → "912345678").
 */
export function soAlgarismos(texto: string) {
  return texto.replace(/\D/g, "").replace(/^(00)?351(?=\d{9}$)/, "")
}
