// Valores calculados de uma avaliação física — as mesmas fórmulas das
// colunas geradas na base de dados (massa_gorda_kg e imc, arredondadas
// a 2 casas), para o formulário mostrar o resultado enquanto se escreve.

const arredondar2 = (n: number) => Math.round(n * 100) / 100

export function calcularDerivados(
  pesoKg: number | null,
  massaGordaPct: number | null,
  alturaCm: number | null
): { massaGordaKg: number | null; imc: number | null } {
  const massaGordaKg = pesoKg != null && massaGordaPct != null ? arredondar2((pesoKg * massaGordaPct) / 100) : null
  const imc = pesoKg != null && alturaCm ? arredondar2(pesoKg / ((alturaCm / 100) * (alturaCm / 100))) : null
  return { massaGordaKg, imc }
}
