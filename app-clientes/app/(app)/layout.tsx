import Marca from '@/components/Marca'
import Navegacao from '@/components/Navegacao'
import { contaAtual } from '@/lib/dados'
import { sair } from '../entrar/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const conta = await contaAtual()
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <Marca pequeno />
        <div className="text-right">
          <p className="text-sm font-semibold">{conta.nome}</p>
          <form action={sair}>
            <button className="text-xs text-muted underline">Sair</button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-5 pb-28">{children}</main>
      <Navegacao />
    </div>
  )
}
