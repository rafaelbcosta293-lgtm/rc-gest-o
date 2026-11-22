'use client'

import { useActionState } from 'react'
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
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.erro}
        </p>
      )}
      <button
        disabled={pendente}
        className="h-12 w-full rounded-xl bg-zinc-900 text-base font-bold text-white transition active:scale-[.98] disabled:opacity-50"
      >
        {pendente ? 'Um momento…' : botao}
      </button>
    </form>
  )
}

export function Campo({ rotulo, ...props }: { rotulo: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{rotulo}</span>
      <input
        {...props}
        className="mt-1 h-12 w-full rounded-xl border border-border bg-white px-3 text-base outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand/40 read-only:bg-zinc-50 read-only:text-zinc-500"
      />
    </label>
  )
}
