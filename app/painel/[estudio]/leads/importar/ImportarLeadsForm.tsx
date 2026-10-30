'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { leadsDeCsv, type LeadImportado } from '@/lib/data/csv'
import { importarLeadsCsv } from '../actions'

export default function ImportarLeadsForm({
  estudioSlug,
  estudioId,
}: {
  estudioSlug: string
  estudioId: number
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [leads, setLeads] = useState<LeadImportado[]>([])
  const [erros, setErros] = useState<{ linha: number; mensagem: string }[]>([])
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [aEnviar, iniciarTransicao] = useTransition()

  function lerFicheiro(ficheiro: File) {
    const leitor = new FileReader()
    leitor.onload = () => {
      const texto = typeof leitor.result === 'string' ? leitor.result : ''
      const resultado = leadsDeCsv(texto)
      setLeads(resultado.leads)
      setErros(resultado.erros)
      setErroEnvio(null)
    }
    leitor.readAsText(ficheiro, 'utf-8')
  }

  function confirmar() {
    setErroEnvio(null)
    iniciarTransicao(async () => {
      const resultado = await importarLeadsCsv({ estudioSlug, estudioId, leads })
      if ('error' in resultado) {
        setErroEnvio(resultado.error)
        return
      }
      router.push(`/painel/${estudioSlug}/leads`)
    })
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="rounded-xl border border-dashed border-black/15 p-6 text-center dark:border-white/15">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const ficheiro = e.target.files?.[0]
            if (ficheiro) lerFicheiro(ficheiro)
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-foreground/[.06]"
        >
          Escolher ficheiro .csv
        </button>
        <p className="mt-3 text-xs text-zinc-500">
          Colunas reconhecidas: nome (obrigatória), telefone, email, origem, campanha,
          modalidade_interesse, objetivo, interesse, valor_potencial, temperatura. A ordem das
          colunas não importa.
        </p>
      </div>

      {erroEnvio && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroEnvio}
        </p>
      )}

      {erros.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {erros.length} {erros.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}:{' '}
          {erros.map((e) => `linha ${e.linha} (${e.mensagem})`).join(', ')}
        </div>
      )}

      {leads.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Temperatura</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 20).map((l, i) => (
                  <tr key={i} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-3 py-2 text-foreground">{l.nome}</td>
                    <td className="px-3 py-2 text-muted">{l.telefone ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{l.origem ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{l.temperatura ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length > 20 && (
              <p className="border-t border-black/5 px-3 py-2 text-xs text-zinc-500 dark:border-white/5">
                … e mais {leads.length - 20}.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={aEnviar}
            className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-pop hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aEnviar ? 'A importar…' : `Importar ${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`}
          </button>
        </>
      )}
    </div>
  )
}
