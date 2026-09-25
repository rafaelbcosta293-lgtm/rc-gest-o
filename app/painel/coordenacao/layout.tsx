import { redirect } from 'next/navigation'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederCoordenacao } from '@/lib/data/acessos'

// Coordenação é só para o dono e para a conta geral do negócio —
// verificado por email antes de sequer chegar à password partilhada da
// área (essa é uma segunda camada opcional, esta é obrigatória).
export default async function CoordenacaoLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoAtual()

  if (!podeAcederCoordenacao(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return <>{children}</>
}
