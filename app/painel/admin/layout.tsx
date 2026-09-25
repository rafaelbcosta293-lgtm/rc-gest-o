import { redirect } from 'next/navigation'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'

// Administração é só para o dono da app — verificado por email antes de
// sequer chegar à password partilhada da área (essa é uma segunda
// camada opcional, esta é obrigatória).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoAtual()

  if (!podeAcederAdmin(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return <>{children}</>
}
