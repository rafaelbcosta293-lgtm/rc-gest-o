import { CircleCheck } from 'lucide-react'
import Marca from '@/components/Marca'
import Formulario, { Campo, CampoPassword } from '@/components/Formulario'
import { entrar } from './actions'

export const metadata = { title: 'Entrar' }

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ ativada?: string }> }) {
  const { ativada } = await searchParams
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-[max(3.5rem,12vh)] pb-8">
      <div className="flex justify-center">
        <Marca largura={168} />
      </div>
      <h1 className="mt-12 text-[1.7rem] leading-tight font-bold tracking-tight">Entrar</h1>
      <p className="mt-1 text-[0.95rem] text-muted">Use o seu nº de cliente e a sua password.</p>
      {ativada && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm leading-snug text-emerald-800">
          <CircleCheck className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" />
          <span>Conta ativada. Já pode entrar.</span>
        </p>
      )}
      <Formulario acao={entrar} botao="Entrar">
        <Campo rotulo="Nº de cliente" name="numero" autoComplete="username" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="Ex.: L25022" required />
        <CampoPassword rotulo="Password" name="password" autoComplete="current-password" required />
      </Formulario>
      <div className="mt-8 rounded-2xl bg-soft px-4 py-3.5 text-sm leading-snug text-muted">
        <p className="font-semibold text-foreground">Ainda não tem acesso ou esqueceu-se da password?</p>
        <p className="mt-1">Peça à equipa do estúdio. Recebe um link por SMS para escolher a sua password.</p>
      </div>
      <p className="mt-auto pt-8 text-center text-xs text-zinc-400">RC Private Fitness Studio</p>
    </main>
  )
}
