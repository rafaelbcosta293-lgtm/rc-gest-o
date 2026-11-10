'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { criarLeadRapida } from '@/app/painel/[estudio]/leads/actions'
import { ORIGENS_LEAD, OBJETIVOS_LEAD } from '@/lib/data/constantes'
import type { EstadoLead } from '@/lib/supabase/database.types'

export type LeadOpcao = { id: string; nome: string; telefone: string | null }

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

const MAX_OBJETIVOS = 3

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

  // O mini-formulário de "nova lead" só aparece depois de se confirmar
  // que a pessoa não está ainda nas leads — fica fora do pequeno
  // dropdown de sugestões (esse é só para nomes já conhecidos), para
  // ter espaço para os campos todos.
  const [aCriarLead, setACriarLead] = useState(false)

  // Só usados ao criar uma lead nova aqui mesmo (nunca ao escolher uma
  // já existente) — origem, estado e objetivo (até 3) ficam a fazer
  // falta para a lead não nascer sem esta informação mínima.
  const [origem, setOrigem] = useState<string>('')
  const [origemOutra, setOrigemOutra] = useState('')
  const [estadoLead, setEstadoLead] = useState<EstadoLead>('Experimental agendada')
  const [objetivos, setObjetivos] = useState<string[]>([])

  function alternarObjetivo(o: string) {
    setObjetivos((lista) => {
      if (lista.includes(o)) return lista.filter((x) => x !== o)
      if (lista.length >= MAX_OBJETIVOS) return lista
      return [...lista, o]
    })
  }

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

    const origemFinal = origem === 'Outra' ? origemOutra.trim() : origem
    if (!origemFinal) {
      setErroCriar('Escolhe a origem.')
      return
    }
    if (objetivos.length === 0) {
      setErroCriar('Escolhe pelo menos um objetivo (até 3).')
      return
    }

    iniciarCriacao(async () => {
      const resultado = await criarLeadRapida({
        estudioSlug,
        estudioId,
        nome: nome.trim(),
        telefone: telefone.trim(),
        origem: origemFinal,
        estado: estadoLead,
        objetivos,
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
      setACriarLead(false)
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
        {aberto && termo && filtrados.length === 0 && !aCriarLead && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-border-subtle bg-surface p-3 text-xs text-muted shadow-pop">
            <p>Sem leads com esse nome.</p>
            <button
              type="button"
              onClick={() => {
                setACriarLead(true)
                setAberto(false)
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand bg-brand/10 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-brand/20"
            >
              + Criar lead &quot;{nome.trim()}&quot;
            </button>
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
          placeholder="9XX XXX XXX ou +indicativo"
          required
          className={inputCls}
        />
      </div>

      {/* Dados mínimos para a lead nova não nascer sem informação — só
          aparece depois de se confirmar que a pessoa ainda não está nas
          leads (ver botão "+ Criar lead" acima). */}
      {aCriarLead && (
        <div className="flex flex-col gap-3 rounded-lg border border-brand/40 bg-brand/[.04] p-3 sm:col-span-2">
          <p className="text-xs font-semibold text-foreground">
            Nova lead &quot;{nome.trim()}&quot; — falta só isto
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted">Origem</label>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">— Escolhe —</option>
                {ORIGENS_LEAD.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {origem === 'Outra' && (
                <input
                  value={origemOutra}
                  onChange={(e) => setOrigemOutra(e.target.value)}
                  placeholder="Qual?"
                  required
                  className={`${inputCls} mt-1`}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted">Estado</label>
              <select
                value={estadoLead}
                onChange={(e) => setEstadoLead(e.target.value as EstadoLead)}
                required
                className={inputCls}
              >
                <option value="Experimental agendada">Experimental agendada</option>
                <option value="Nova">Nova</option>
                <option value="Contactada">Contactada</option>
                <option value="Qualificada">Qualificada</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">
              Objetivo (até {MAX_OBJETIVOS}) — {objetivos.length}/{MAX_OBJETIVOS}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OBJETIVOS_LEAD.map((o) => {
                const selecionado = objetivos.includes(o)
                const desativado = !selecionado && objetivos.length >= MAX_OBJETIVOS
                return (
                  <label
                    key={o}
                    className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selecionado
                        ? 'border-brand bg-brand/20 text-foreground'
                        : 'border-border-subtle bg-surface text-muted'
                    } ${desativado ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selecionado}
                      disabled={desativado}
                      onChange={() => alternarObjetivo(o)}
                      className="sr-only"
                    />
                    {o}
                  </label>
                )
              })}
            </div>
          </div>

          {erroCriar && <p className="text-xs text-red-600 dark:text-red-400">{erroCriar}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={criarLead}
              disabled={aCriar}
              className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong disabled:opacity-60"
            >
              {aCriar ? 'A criar lead…' : 'Criar lead'}
            </button>
            <button
              type="button"
              onClick={() => {
                setACriarLead(false)
                setErroCriar(null)
              }}
              disabled={aCriar}
              className="rounded-full border border-border-subtle px-4 py-1.5 text-xs font-semibold hover:bg-foreground/[.06]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
