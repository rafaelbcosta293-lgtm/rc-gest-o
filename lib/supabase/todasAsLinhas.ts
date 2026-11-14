type Resposta<T> = { data: T[] | null; error: { message: string } | null }

const TAMANHO_PAGINA = 1000

// A API do Supabase devolve no máximo 1000 linhas por pedido, sem avisar
// que cortou o resto — por isso qualquer leitura que possa passar disso
// (pagamentos, agenda, presenças...) vai buscando páginas até vir uma
// incompleta. `pedir` tem de ter uma ordem estável (ex.: .order('id'))
// para as páginas não se sobreporem nem saltarem linhas.
export async function todasAsLinhas<T>(
  pedir: (de: number, ate: number) => PromiseLike<Resposta<T>>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const linhas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await pedir(de, de + TAMANHO_PAGINA - 1)
    if (error) return { data: linhas, error }
    const pagina = data ?? []
    linhas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) return { data: linhas, error: null }
  }
}
