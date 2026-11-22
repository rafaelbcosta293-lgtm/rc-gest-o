import Marca from '@/components/Marca'
import Formulario, { Campo } from '@/components/Formulario'
import { ativar } from '../entrar/actions'
import { limparNumeroCliente } from '@/lib/supabase'

export default async function AtivarPage({ searchParams }: { searchParams: Promise<{ n?: string; c?: string }> }) {
  const { n, c } = await searchParams
  const numero = limparNumeroCliente(n ?? '')
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="flex justify-center">
        <Marca />
      </div>
      <h1 className="mt-8 text-2xl font-bold tracking-tight">Ativar a sua conta</h1>
      <p className="mt-1 text-sm text-muted">Escolha uma password. Para entrar vai usar o seu nº de cliente e esta password.</p>
      {!numero || !c ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Este link está incompleto. Abra o link do SMS que recebeu ou peça um novo à equipa do estúdio.
        </p>
      ) : (
        <Formulario acao={ativar} botao="Ativar e entrar">
          <Campo rotulo="Nº de cliente" name="numero" defaultValue={numero} readOnly autoComplete="username" />
          <input type="hidden" name="codigo" value={c} />
          <Campo rotulo="Nova password (mínimo 8 caracteres)" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
          <Campo rotulo="Repetir a password" name="confirmar" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
        </Formulario>
      )}
    </main>
  )
}
