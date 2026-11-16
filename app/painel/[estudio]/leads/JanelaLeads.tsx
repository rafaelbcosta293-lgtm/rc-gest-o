'use client'

import { useCallback } from 'react'
import Link from '@/components/LinkRapido'
import { ProvedorJanela } from '@/components/janela/Janela'
import { atualizarLead, criarLead, dadosDaJanelaLead, guardarLeadNaJanela, type DadosJanelaLead } from './actions'
import LeadForm from './LeadForm'

// A janela das leads: botão direito numa lead (ou "+ Lead") abre o
// formulário de sempre numa caixa por cima da lista, sem sair dali.
export default function JanelaLeads({ slug, children }: { slug: string; children: React.ReactNode }) {
  const carregar = useCallback((alvo: string | null) => dadosDaJanelaLead(slug, alvo), [slug])
  return (
    <ProvedorJanela<DadosJanelaLead>
      carregar={carregar}
      guardar={guardarLeadNaJanela}
      titulo={(alvo) => (alvo ? 'Editar lead' : 'Nova lead')}
      largura="max-w-3xl"
      conteudo={(d, alvo) => (
        <>
          <LeadForm
            key={alvo ?? 'nova'}
            estudioSlug={slug}
            estudioId={d.estudioId}
            pts={d.pts}
            lead={d.lead ?? undefined}
            action={d.lead ? atualizarLead : criarLead}
            outrosEstudios={d.lead ? d.outrosEstudios : []}
          />
          {alvo && (
            <Link href={`/painel/${slug}/leads/${alvo}`} className="mt-3 block text-center text-xs text-muted underline hover:text-foreground">
              Abrir a ficha completa (contactos, histórico, converter em cliente)
            </Link>
          )}
        </>
      )}
    >
      {children}
    </ProvedorJanela>
  )
}
