'use client'

import { useCallback } from 'react'
import { ProvedorJanela } from '@/components/janela/Janela'
import { atualizarCliente, criarCliente, dadosDaJanelaCliente, guardarClienteNaJanela, type DadosJanelaCliente } from './actions'
import ClienteForm from './ClienteForm'

// A janela da ficha do cliente: "+ Cliente" e "Editar ficha" abrem o
// formulário de sempre numa caixa por cima da página, sem sair dali.
// Um cliente novo, depois de criado, abre na página dele.
export default function JanelaClientes({ slug, children }: { slug: string; children: React.ReactNode }) {
  const carregar = useCallback((alvo: string | null) => dadosDaJanelaCliente(slug, alvo), [slug])
  return (
    <ProvedorJanela<DadosJanelaCliente>
      carregar={carregar}
      guardar={guardarClienteNaJanela}
      titulo={(alvo) => (alvo ? 'Editar ficha do cliente' : 'Novo cliente')}
      largura="max-w-3xl"
      seguirAoCriar
      conteudo={(d, alvo) => (
        <ClienteForm
          key={alvo ?? 'novo'}
          estudioSlug={slug}
          estudioId={d.estudioId}
          cliente={d.cliente ?? undefined}
          servicos={d.servicos}
          servicosLigados={d.servicosLigados}
          action={d.cliente ? atualizarCliente : criarCliente}
        />
      )}
    >
      {children}
    </ProvedorJanela>
  )
}
