'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sincronizarNifsZsgo, type ResultadoSincronizacaoNif } from './actions'

export default function SincronizarNifs() {
  const router = useRouter()
  const [aPendente, iniciarTransicao] = useTransition()
  const [resultado, setResultado] = useState<ResultadoSincronizacaoNif | { error: string } | null>(null)

  function sincronizar() {
    setResultado(null)
    iniciarTransicao(async () => {
      const r = await sincronizarNifsZsgo()
      setResultado(r)
      if (!('error' in r) && r.atualizados.length > 0) router.refresh()
    })
  }

  return (
    <div className="mt-4 rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Preencher NIFs a partir do ZS Go</h2>
          <p className="mt-0.5 text-xs text-muted">
            Procura, pelo nome, clientes que já têm NIF no ZS Go (de faturas anteriores a esta app)
            e preenche-o aqui — só quando o nome é inequívoco dos dois lados.
          </p>
        </div>
        <button
          type="button"
          onClick={sincronizar}
          disabled={aPendente}
          className="shrink-0 rounded-full border border-border-strong px-4 py-2 text-xs font-semibold hover:bg-foreground/[.08] disabled:opacity-60"
        >
          {aPendente ? 'A verificar…' : 'Sincronizar agora'}
        </button>
      </div>

      {resultado && 'error' in resultado && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {resultado.error}
        </p>
      )}

      {resultado && !('error' in resultado) && (
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <p className="font-medium text-teal-700 dark:text-teal-400">
            {resultado.atualizados.length === 0
              ? 'Nenhum NIF novo encontrado.'
              : `${resultado.atualizados.length} ${resultado.atualizados.length === 1 ? 'cliente atualizado' : 'clientes atualizados'}: ${resultado.atualizados.map((a) => a.nome).join(', ')}.`}
          </p>
          {resultado.ambiguosApp.length > 0 && (
            <p className="text-amber-600">
              Há mais do que um cliente nosso com este nome — não dá para saber qual, confirma à
              mão: {resultado.ambiguosApp.join(', ')}.
            </p>
          )}
          {resultado.ambiguosZsgo.length > 0 && (
            <p className="text-amber-600">
              Há mais do que um cliente no ZS Go com este nome — não dá para saber qual, confirma à
              mão: {resultado.ambiguosZsgo.join(', ')}.
            </p>
          )}
          {resultado.semNifNoZsgo > 0 && (
            <p className="text-muted">
              {resultado.semNifNoZsgo} {resultado.semNifNoZsgo === 1 ? 'cliente encontrado' : 'clientes encontrados'} no
              ZS Go pelo nome, mas sem NIF válido guardado lá.
            </p>
          )}
          <p className="text-muted">
            {resultado.semCorrespondencia} sem nenhum cliente com o mesmo nome no ZS Go.
          </p>
        </div>
      )}
    </div>
  )
}
