import Marca from '@/components/Marca'
import Formulario, { Campo } from '@/components/Formulario'
import { entrar } from './actions'

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ ativada?: string }> }) {
  const { ativada } = await searchParams
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="flex justify-center">
        <Marca />
      </div>
      <h1 className="mt-8 text-2xl font-bold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted">Use o seu nº de cliente e a sua password.</p>
      {ativada && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Conta ativada. Já pode entrar.</p>}
      <Formulario acao={entrar} botao="Entrar">
        <Campo rotulo="Nº de cliente" name="numero" autoComplete="username" autoCapitalize="characters" placeholder="ex.: L25022" required />
        <Campo rotulo="Password" name="password" type="password" autoComplete="current-password" required />
      </Formulario>
      <p className="mt-6 text-center text-sm text-muted">
        Esqueceu-se da password ou ainda não tem acesso? Peça à equipa do estúdio um novo link por SMS.
      </p>
    </main>
  )
}
