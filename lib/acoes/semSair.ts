// Usar uma ação "antiga" (das que acabam com redirect para outra página)
// a partir de uma janela que abre por cima da página, sem sair do sítio.
//
// As ações dos formulários terminam sempre com redirect(): para a página
// seguinte quando corre bem, ou de volta com "?error=…" quando corre
// mal. Aqui chama-se a ação tal como está, apanha-se esse redirect e
// devolve-se o resultado — a janela mostra o erro ou fecha-se, e a lista
// por baixo atualiza-se. Assim a lógica de cada ação fica num só sítio.

export type ResultadoSemSair = {
  // A mensagem de erro que a ação quis mostrar, ou null se correu bem.
  erro: string | null
  // Para onde a ação queria ir (pode servir a quem chama).
  destino: string | null
}

// O endereço para onde um redirect() do Next queria ir, ou null se o
// erro apanhado não é um redirect. (O Next assinala o redirect com um
// erro cujo "digest" é "NEXT_REDIRECT;tipo;endereço;código;".)
export function destinoDoRedirect(erro: unknown): string | null {
  if (typeof erro !== 'object' || erro === null || !('digest' in erro)) return null
  const digest = (erro as { digest: unknown }).digest
  if (typeof digest !== 'string') return null
  const partes = digest.split(';')
  if (partes[0] !== 'NEXT_REDIRECT' || partes.length < 5) return null
  return partes.slice(2, -2).join(';')
}

export async function semSair(acao: (formData: FormData) => Promise<unknown>, formData: FormData): Promise<ResultadoSemSair> {
  try {
    await acao(formData)
    return { erro: null, destino: null }
  } catch (e) {
    const destino = destinoDoRedirect(e)
    // Tudo o que não seja um redirect (página não encontrada, erro a
    // sério) segue o seu caminho.
    if (destino === null) throw e
    let erro: string | null = null
    try {
      erro = new URL(destino, 'http://x').searchParams.get('error')
    } catch {
      // endereço estranho: trata-se como sucesso
    }
    return { erro, destino }
  }
}
