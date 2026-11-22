import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import Marca from '@/components/Marca'
import Formulario, { Campo, CampoPassword } from '@/components/Formulario'
import { ativar } from '../entrar/actions'
import { limparNumeroCliente } from '@/lib/supabase'

export const metadata = { title: 'Ativar conta' }

export default async function AtivarPage({ searchParams }: { searchParams: Promise<{ n?: string; c?: string }> }) {
  const { n, c } = await searchParams
  const numero = limparNumeroCliente(n ?? '')
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-[max(3.5rem,12vh)] pb-8">
      <div className="flex justify-center">
        <Marca largura={168} />
      </div>
      <h1 className="mt-12 text-[1.7rem] leading-tight font-bold tracking-tight">Escolha a sua password</h1>
      <p className="mt-1 text-[0.95rem] leading-snug text-muted">É o último passo. A partir de agora entra com o seu nº de cliente e esta password.</p>
      {!numero || !c ? (
        <>
          <p className="mt-6 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-snug text-amber-900">
            <CircleAlert className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" />
            <span>Este link está incompleto. Abra o link do SMS que recebeu ou peça um novo à equipa do estúdio.</span>
          </p>
          <Link href="/entrar" className="mt-4 flex h-12 items-center justify-center rounded-xl text-[0.95rem] font-semibold ring-1 ring-zinc-300 active:bg-soft">
            Já tenho password — entrar
          </Link>
        </>
      ) : (
        <Formulario acao={ativar} botao="Guardar e entrar">
          <Campo rotulo="Nº de cliente" name="numero" defaultValue={numero} readOnly autoComplete="username" />
          <input type="hidden" name="codigo" value={c} />
          <CampoPassword rotulo="Nova password" name="password" minLength={8} maxLength={72} autoComplete="new-password" ajuda="Pelo menos 8 caracteres." required />
          <CampoPassword rotulo="Repetir a password" name="confirmar" minLength={8} maxLength={72} autoComplete="new-password" required />
        </Formulario>
      )}
      <p className="mt-auto pt-8 text-center text-xs text-zinc-400">RC Private Fitness Studio</p>
    </main>
  )
}
