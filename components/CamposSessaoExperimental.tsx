'use client'

import { useEffect, useRef, useState } from 'react'

export type LeadOpcao = { id: string; nome: string; telefone: string | null }

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

// Campos de "Sessão experimental": nome da pessoa — com sugestões a
// partir das leads do estúdio, escolher uma pré-preenche o telemóvel —
// e telemóvel, sempre editável à mão mesmo depois de escolher uma
// lead. É daqui, não de uma ficha de cliente, que o lembrete SMS do
// dia seguinte vai buscar o contacto: a pessoa ainda não é cliente.
export default function CamposSessaoExperimental({
  leads,
  defaultNome = '',
  defaultTelefone = '',
  defaultLeadId = '',
}: {
  leads: LeadOpcao[]
  defaultNome?: string
  defaultTelefone?: string
  defaultLeadId?: string
}) {
  const [nome, setNome] = useState(defaultNome)
  const [telefone, setTelefone] = useState(defaultTelefone)
  const [leadId, setLeadId] = useState(defaultLeadId)
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  const termo = nome.trim().toLowerCase()
  const filtrados = termo
    ? leads.filter((l) => l.nome.toLowerCase().startsWith(termo)).slice(0, 8)
    : leads.slice(0, 8)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div ref={containerRef} className="relative flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted">Nome</label>
        <input
          name="titulo"
          value={nome}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setNome(e.target.value)
            setLeadId('')
            setAberto(true)
          }}
          placeholder="Escreve para procurar nas leads…"
          autoComplete="off"
          required
          className={inputCls}
        />
        <input type="hidden" name="lead_id" value={leadId} />
        {aberto && filtrados.length > 0 && (
          <div className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface py-1 shadow-pop">
            {filtrados.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setNome(l.nome)
                  setTelefone(l.telefone ?? '')
                  setLeadId(l.id)
                  setAberto(false)
                }}
                className="flex w-full flex-col px-3 py-1.5 text-left text-sm text-foreground hover:bg-brand/[.06]"
              >
                <span>{l.nome}</span>
                {l.telefone && <span className="text-xs text-muted">{l.telefone}</span>}
              </button>
            ))}
          </div>
        )}
        {aberto && termo && filtrados.length === 0 && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs text-muted shadow-pop">
            Sem leads com esse nome — podes escrever à mão e preencher o telemóvel abaixo.
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted">Telemóvel</label>
        <input
          name="telefone"
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="9XX XXX XXX"
          required
          className={inputCls}
        />
      </div>
    </div>
  )
}
