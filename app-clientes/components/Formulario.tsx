'use client'

import { useActionState, useState } from 'react'
import { CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import type { EstadoFormulario } from '@/app/entrar/actions'

// Formulário de entrada/ativação com mensagem de erro e botão a "pensar".
export default function Formulario({
  acao,
  botao,
  children,
}: {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>
  botao: string
  children: React.ReactNode
}) {
  const [estado, executar, pendente] = useActionState(acao, undefined)
  return (
    <form action={executar} className="mt-6 space-y-4">
      {children}
      {estado?.erro && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm leading-snug text-red-800">
          <CircleAlert className="mt-px h-[1.1rem] w-[1.1rem] shrink-0" />
          <span>{estado.erro}</span>
        </p>
      )}
      <button
        disabled={pendente}
        aria-busy={pendente}
        className="flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-base font-semibold text-white transition active:scale-[.985] active:bg-zinc-800 disabled:opacity-70"
      >
        {pendente && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {pendente ? 'Um momento…' : botao}
      </button>
    </form>
  )
}

const CAIXA =
  'h-[3.25rem] w-full rounded-xl border border-border bg-white px-3.5 text-base outline-none transition placeholder:text-zinc-400 focus:border-brand-strong focus:ring-2 focus:ring-brand/40 read-only:bg-soft read-only:text-muted'

export function Campo({ rotulo, ajuda, ...props }: { rotulo: string; ajuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{rotulo}</span>
      <input {...props} className={`mt-1.5 ${CAIXA}`} />
      {ajuda && <span className="mt-1.5 block text-xs leading-snug text-muted">{ajuda}</span>}
    </label>
  )
}

// Campo de password com botão para a ver enquanto se escreve.
export function CampoPassword({ rotulo, ajuda, ...props }: { rotulo: string; ajuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">{rotulo}</span>
        <span className="relative mt-1.5 block">
          <input {...props} type={visivel ? 'text' : 'password'} className={`${CAIXA} pr-12`} />
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? 'Esconder a password' : 'Mostrar a password'}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted"
          >
            {visivel ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </span>
      </label>
      {ajuda && <p className="mt-1.5 text-xs leading-snug text-muted">{ajuda}</p>}
    </div>
  )
}
