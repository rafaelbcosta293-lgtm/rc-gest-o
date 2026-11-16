'use client'

import { useCallback } from 'react'
import { ProvedorJanela } from '@/components/janela/Janela'
import { atualizarAvaliacao, criarAvaliacao, dadosDaJanelaAvaliacao, guardarAvaliacaoNaJanela, type DadosJanelaAvaliacao } from './actions'
import AvaliacaoForm from './AvaliacaoForm'

// A janela das avaliações: "+ Avaliação", "Editar" ou o botão direito
// numa avaliação abrem o formulário de sempre numa caixa por cima da
// página do cliente, sem sair dali.
export default function JanelaAvaliacoes({ slug, clienteId, children }: { slug: string; clienteId: string; children: React.ReactNode }) {
  const carregar = useCallback((alvo: string | null) => dadosDaJanelaAvaliacao(slug, clienteId, alvo), [slug, clienteId])
  return (
    <ProvedorJanela<DadosJanelaAvaliacao>
      carregar={carregar}
      guardar={guardarAvaliacaoNaJanela}
      titulo={(alvo) => (alvo ? 'Editar avaliação' : 'Nova avaliação')}
      largura="max-w-3xl"
      conteudo={(d, alvo) => (
        <AvaliacaoForm
          key={alvo ?? 'nova'}
          estudioSlug={slug}
          clienteId={clienteId}
          pts={d.pts}
          avaliacao={d.avaliacao ?? undefined}
          alturaSugerida={d.avaliacao ? undefined : d.alturaSugerida}
          action={d.avaliacao ? atualizarAvaliacao : criarAvaliacao}
        />
      )}
    >
      {children}
    </ProvedorJanela>
  )
}
