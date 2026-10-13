"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { toast } from "sonner"

import type { ResultadoAcao } from "@/lib/acoes"

type Opcoes<TDados> = {
  /** Chamado depois de a ação correr bem (antes de redirecionar). */
  aoConcluir?: (resultado: Extract<ResultadoAcao<TDados>, { ok: true }>) => void
  /** Não mostrar a notificação de sucesso. */
  semNotificacao?: boolean
}

/**
 * Liga um formulário react-hook-form a uma Server Action.
 * - Valida no browser com o zodResolver do formulário.
 * - Envia os valores tal como estão nos campos (texto); o servidor volta a
 *   validar com o mesmo esquema Zod antes de gravar.
 * - Mostra os erros devolvidos pelo servidor nos campos e numa notificação.
 */
export function useAcaoFormulario<TCampos extends FieldValues, TDados = undefined>(
  form: UseFormReturn<TCampos, unknown, unknown>,
  acao: (valores: TCampos) => Promise<ResultadoAcao<TDados>>,
  opcoes: Opcoes<TDados> = {}
) {
  const router = useRouter()
  const [aGuardar, iniciar] = useTransition()

  const submeter = form.handleSubmit(() => {
    iniciar(async () => {
      let resultado: ResultadoAcao<TDados>
      try {
        resultado = await acao(form.getValues())
      } catch {
        toast.error("Não foi possível comunicar com o servidor. Verifique a ligação à internet.")
        return
      }

      if (!resultado.ok) {
        for (const [campo, mensagens] of Object.entries(resultado.campos ?? {})) {
          if (mensagens?.[0]) form.setError(campo as Path<TCampos>, { message: mensagens[0] })
        }
        toast.error(resultado.erro)
        return
      }

      if (!opcoes.semNotificacao) toast.success(resultado.mensagem ?? "Guardado.")
      opcoes.aoConcluir?.(resultado)
      if (resultado.redirecionar) router.push(resultado.redirecionar)
    })
  })

  return { submeter, aGuardar }
}
