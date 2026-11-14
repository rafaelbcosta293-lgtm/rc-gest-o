type Resposta<T> = { data: T[] | null; error: { message: string } | null }

const TAMANHO_PAGINA = 1000

// A API do Supabase devolve no máximo 1000 linhas por pedido, sem avisar
// que cortou o resto — por isso qualquer leitura que possa passar disso
// (pagamentos, agenda, presenças...) vai buscando páginas até vir uma
// incompleta. `pedir` tem de ter uma ordem estável (ex.: .order('id'))
// para as páginas não se sobreporem nem saltarem linhas.
//
// Com `emParalelo` > 1 pede vários blocos de páginas ao mesmo tempo
// (para tabelas grandes, como o histórico de pagamentos) — no máximo
// pede `emParalelo - 1` páginas a mais, que vêm vazias.
export async function todasAsLinhas<T>(
  pedir: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  { emParalelo = 1 }: { emParalelo?: number } = {}
): Promise<{ data: T[]; error: { message: string } | null }> {
  const linhas: T[] = []
  const bloco = Math.max(1, Math.floor(emParalelo))
  for (let pagina0 = 0; ; pagina0 += bloco) {
    const respostas = await Promise.all(
      Array.from({ length: bloco }, (_, k) => {
        const de = (pagina0 + k) * TAMANHO_PAGINA
        return pedir(de, de + TAMANHO_PAGINA - 1)
      })
    )
    for (const { data, error } of respostas) {
      if (error) return { data: linhas, error }
      const pagina = data ?? []
      linhas.push(...pagina)
      if (pagina.length < TAMANHO_PAGINA) return { data: linhas, error: null }
    }
  }
}
