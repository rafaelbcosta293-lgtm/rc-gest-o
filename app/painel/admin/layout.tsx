import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessaoAtual } from '@/lib/data/sessao'
import { podeAcederAdmin } from '@/lib/data/acessos'
import AdminNav from './AdminNav'

// Administração é só para o dono da app — verificado por email antes de
// sequer chegar à password partilhada da área (essa é uma segunda
// camada opcional, esta é obrigatória).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessaoAtual()

  if (!podeAcederAdmin(sessao.email)) {
    redirect('/painel?erro=sem-acesso')
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-surface/70 px-4 py-2.5 backdrop-blur-xl">
        <Link href="/painel" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="RC Private Fitness Studio" className="h-8 w-auto" />
        </Link>
        <AdminNav />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}
