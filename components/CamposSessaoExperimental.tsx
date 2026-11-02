'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { criarLeadRapida } from '@/app/painel/[estudio]/leads/actions'

export type LeadOpcao = { id: string; nome: string; telefone: string | null }

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

// Campos de "Sessão experimental": nome da pessoa — com sugestões a
// partir das leads do estúdio, escolher uma pré-preenche o telemóvel —
// e telemóvel, sempre editável à mão mesmo depois de escolher uma
// lead. É daqui, não de uma ficha de cliente, que o lembrete SMS do
// dia seguinte vai buscar o contacto: a pessoa ainda não é cliente.
//
// Quando a pessoa ainda não está nas leads, um botão cria a lead já
// aqui (sem sair do agendamento) — a lead nova fica logo escolhida.
export default function CamposSessaoExperimental({
  leads,
  estudioSlug,
  estudioId,
  defaultNome = '',
  defaultTelefone = '',
  defaultLeadId = '',
}: {
  leads: LeadOpcao[]
  estudioSlug: string
  estudioId: number
  defaultNome?: string
  defaultTelefone?: string
  defaultLeadId?: string
}) {
  const [nome, setNome] = useState(defaultNome)
  const [telefone, setTelefone] = useState(defaultTelefone)
  const [leadId, setLeadId] = useState(defaultLeadId)
  const [leadsCriadas, setLeadsCriadas] = useState<LeadOpcao[]>([])
  const [aberto, setAberto] = useState(false)
  const [aCriar, iniciarCriacao] = useTransition()
  const [erroCriar, setErroCriar] = useState<string | null>(null)
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

  const todasLeads = [...leadsCriadas, ...leads]
  const termo = nome.trim().toLowerCase()
  const filtrados = termo
    ? todasLeads.filter((l) => l.nome.toLowerCase().startsWith(termo)).slice(0, 8)
    : todasLeads.slice(0, 8)

  function criarLead() {
    setErroCriar(null)
    iniciarCriacao(async () => {
      const resultado = await criarLeadRapida({
        estudioSlug,
        estudioId,
        nome: nome.trim(),
        telefone: telefone.trim() || null,
      })
      if ('error' in resultado) {
        setErroCriar(resultado.error)
        return
      }
      setLeadsCriadas((lista) => [resultado.lead, ...lista])
      setNome(resultado.lead.nome)
      setTelefone(resultado.lead.telefone ?? '')
      setLeadId(resultado.lead.id)
      setAberto(false)
    })
  }

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
            setErroCriar(null)
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
          <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-border-subtle bg-surface p-3 text-xs text-muted shadow-pop">
            <p>Sem leads com esse nome.</p>
            <button
              type="button"
              onClick={criarLead}
              disabled={aCriar}
              className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand bg-brand/10 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-brand/20 disabled:opacity-60"
            >
              {aCriar ? 'A criar lead…' : `+ Criar lead "${nome.trim()}"`}
            </button>
            {erroCriar && <p className="mt-1.5 text-red-600 dark:text-red-400">{erroCriar}</p>}
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
