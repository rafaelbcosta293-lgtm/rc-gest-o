import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// Memória curta do servidor, partilhada entre pedidos seguidos.
//
// Há duas perguntas que quase todas as páginas fazem antes de ir buscar
// os seus dados — "quem é este utilizador?" e "que estúdios existem?" —
// e cada uma custava uma ida à Supabase ANTES de a página poder começar
// o resto. Guardando a resposta aqui por pouco tempo, a navegação entre
// pastas deixa de pagar essas idas: a página vai logo aos dados.
//
// A chave é sempre o token de acesso da própria sessão (ver
// chaveDaSessao): só quem apresenta exatamente o mesmo token recebe a
// resposta guardada, por isso um utilizador nunca vê a de outro. O que
// se guarda é o que a Supabase respondeu a esse token — a RLS continua a
// decidir tudo o que cada consulta devolve.
type Entrada<T> = { valor: Promise<T>; ate: number }

const LIMITE_DE_ENTRADAS = 500

export function criarMemoria<T>(validadeMs: number) {
  const mapa = new Map<string, Entrada<T>>()

  function arrumar(agora: number) {
    if (mapa.size <= LIMITE_DE_ENTRADAS) return
    for (const [chave, entrada] of mapa) if (entrada.ate <= agora) mapa.delete(chave)
    // Ainda cheia: sai a mais antiga (o Map guarda a ordem de entrada).
    while (mapa.size > LIMITE_DE_ENTRADAS) {
      const primeira = mapa.keys().next()
      if (primeira.done) break
      mapa.delete(primeira.value)
    }
  }

  return {
    // "guardar" decide se a resposta merece ficar (ex.: não se guarda
    // "sem sessão" nem uma lista vazia — pergunta-se outra vez a seguir).
    // Uma resposta que falhe também nunca fica guardada.
    obter(chave: string | null, carregar: () => Promise<T>, guardar: (valor: T) => boolean = () => true): Promise<T> {
      if (!chave) return carregar()
      const agora = Date.now()
      const existente = mapa.get(chave)
      if (existente && existente.ate > agora) return existente.valor

      const entrada: Entrada<T> = { valor: carregar(), ate: agora + validadeMs }
      mapa.set(chave, entrada)
      arrumar(agora)
      const esquecer = () => {
        if (mapa.get(chave) === entrada) mapa.delete(chave)
      }
      entrada.valor.then((valor) => {
        if (!guardar(valor)) esquecer()
      }, esquecer)
      return entrada.valor
    },
    limpar() {
      mapa.clear()
    },
  }
}

// O token de acesso da sessão atual, lido da cookie sem ir à rede (o
// proxy já o renovou, se fosse preciso, antes de a página correr). Serve
// só de chave para a memória acima — nunca para decidir permissões.
export const chaveDaSessao = cache(async (supabase: SupabaseClient): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
})
