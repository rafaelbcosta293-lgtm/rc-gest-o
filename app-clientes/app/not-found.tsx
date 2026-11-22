import Link from 'next/link'
import Marca from '@/components/Marca'

export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Marca largura={130} />
      <h1 className="mt-8 text-xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="mt-1.5 text-[0.95rem] text-muted">O endereço que abriu não existe.</p>
      <Link href="/" className="mt-6 flex h-12 items-center rounded-xl bg-zinc-900 px-6 text-[0.95rem] font-semibold text-white">
        Voltar ao início
      </Link>
    </main>
  )
}
