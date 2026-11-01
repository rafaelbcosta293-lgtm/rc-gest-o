'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { atualizarClienteRapido } from './actions'
import type { EstadoCliente, GeneroCliente } from '@/lib/supabase/database.types'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

export type ClienteEdicao = {
  id: string
  nome: string
  numeroSocio: string | null
  telefone: string | null
  email: string | null
  nascimento: string | null
  frequenciaSemanal: number | null
  estado: EstadoCliente
  genero: GeneroCliente | null
}

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'
const labelCls = 'text-sm font-medium text-foreground'

// Edição rápida, aberta com o botão direito do rato em cima do nome, na
// lista de Clientes — guarda sem sair da página (ao contrário da "Editar
// ficha" completa, que continua a existir para os campos mais raros:
// alerta, PT principal, objetivo, evento, notas).
export default function EditarClienteModal({
  slug,
  cliente,
  onFechar,
}: {
  slug: string
  cliente: ClienteEdicao
  onFechar: () => void
}) {
  const router = useRouter()
  const [aPendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const { sujo, marcarSujo, limparSujo } = useAvisoSairSemGuardar()

  // Fechar pelo fundo ou pelo "X" (ao contrário de guardar com sucesso,
  // que fecha sempre direto) pergunta primeiro se há alterações por
  // guardar — o mesmo cuidado do resto da app, aplicado aqui porque o
  // hook só interceta cliques em links, não o fundo/botão deste modal.
  function fecharComAviso() {
    if (sujo && !window.confirm('Tens alterações por guardar. Fechar sem guardar?')) return
    onFechar()
  }

  function aoSubmeter(formData: FormData) {
    const nome = (formData.get('nome') as string).trim()
    const numeroSocio = (formData.get('numero_socio') as string)?.trim() || null
    const telefone = (formData.get('telefone') as string)?.trim() || null
    const email = (formData.get('email') as string)?.trim() || null
    const nascimento = (formData.get('nascimento') as string) || null
    const frequenciaSemanal = formData.get('frequencia_semanal')
      ? Number(formData.get('frequencia_semanal'))
      : null
    const estado = formData.get('estado') as string
    const genero = (formData.get('genero') as string) || null

    iniciarTransicao(async () => {
      const resultado = await atualizarClienteRapido({
        estudioSlug: slug,
        id: cliente.id,
        nome,
        numeroSocio,
        telefone,
        email,
        nascimento,
        frequenciaSemanal,
        estado,
        genero,
      })
      if ('error' in resultado) {
        setErro(resultado.error)
      } else {
        limparSujo()
        onFechar()
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={fecharComAviso}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Editar cliente</h2>
          <button
            type="button"
            onClick={fecharComAviso}
            className="rounded-full p-1 text-muted hover:bg-brand/[.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {erro}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            aoSubmeter(new FormData(e.currentTarget))
          }}
          onChange={marcarSujo}
          className="mt-3 flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label htmlFor="nome" className={labelCls}>
                Nome
              </label>
              <input id="nome" name="nome" required defaultValue={cliente.nome} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="numero_socio" className={labelCls}>
                Nº de sócio
              </label>
              <input
                id="numero_socio"
                name="numero_socio"
                defaultValue={cliente.numeroSocio ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="estado" className={labelCls}>
                Estado
              </label>
              <select id="estado" name="estado" defaultValue={cliente.estado} className={inputCls}>
                <option value="Ativo">Ativo</option>
                <option value="Suspenso">Suspenso</option>
                <option value="Ex-cliente">Ex-cliente</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="telefone" className={labelCls}>
                Telefone
              </label>
              <input id="telefone" name="telefone" defaultValue={cliente.telefone ?? ''} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={labelCls}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={cliente.email ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="nascimento" className={labelCls}>
                Data de nascimento
              </label>
              <input
                id="nascimento"
                name="nascimento"
                type="date"
                defaultValue={cliente.nascimento ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="frequencia_semanal" className={labelCls}>
                Treinos / semana
              </label>
              <select
                id="frequencia_semanal"
                name="frequencia_semanal"
                defaultValue={cliente.frequenciaSemanal ?? ''}
                className={inputCls}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}× por semana
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="genero" className={labelCls}>
                Género
              </label>
              <select id="genero" name="genero" defaultValue={cliente.genero ?? ''} className={inputCls}>
                <option value="">—</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <a
              href={`/painel/${slug}/treinos/${cliente.id}/editar?voltar=clientes`}
              className="text-xs text-muted underline hover:text-foreground"
            >
              Editar ficha completa
            </a>
            <button
              type="submit"
              disabled={aPendente}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover disabled:opacity-60"
            >
              {aPendente ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
