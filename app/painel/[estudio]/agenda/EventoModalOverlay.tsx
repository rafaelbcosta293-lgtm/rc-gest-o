'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Trash2, Ban, RotateCcw } from 'lucide-react'
import ClienteCombobox, { type ClienteOpcao } from '@/components/ClienteCombobox'
import CamposSessaoExperimental, { type LeadOpcao } from '@/components/CamposSessaoExperimental'
import { TIPOS_EVENTO_AGENDA } from '@/lib/data/agenda'
import type { TipoEventoAgenda as TipoEvento } from '@/lib/supabase/database.types'
import type { EscopoApagar, EscopoEditar } from './actions'
import type { EstadoModal, PtOpcao, EstudioOpcao } from './AgendaInterativa'

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

const DURACOES_COMUNS = [30, 40, 45, 60, 90, 120]

// Ficha de criar/editar evento — carregada à parte (ver AgendaInterativa.tsx,
// next/dynamic) e só pedida ao browser quando se abre mesmo o modal, em vez
// de entrar sempre no bundle inicial da Agenda (a página mais visitada).
export default function EventoModalOverlay({
  modal,
  clientes,
  outroEstudio,
  clientesOutroEstudio,
  leads,
  pts,
  estudioId,
  erro,
  aPendente,
  slug,
  onFechar,
  onSubmeter,
  onDesmarcar,
  onReativar,
  onApagar,
  onPararSerie,
  somenteLeitura,
}: {
  modal: Extract<EstadoModal, { aberto: true }>
  clientes: ClienteOpcao[]
  outroEstudio: EstudioOpcao | null
  clientesOutroEstudio: ClienteOpcao[]
  leads: LeadOpcao[]
  pts: PtOpcao[]
  estudioId: number
  erro: string | null
  aPendente: boolean
  slug: string
  onFechar: () => void
  onSubmeter: (formData: FormData, clienteIds: string[]) => void
  onDesmarcar: (contarComoRealizado: boolean, foiRemarcado: boolean) => void
  onReativar: () => void
  onApagar: (escopo: EscopoApagar) => void
  onPararSerie: () => void
  somenteLeitura: boolean
}) {
  const editar = modal.modo === 'editar'
  const evento = modal.modo === 'editar' ? modal.evento : null
  const dataDefault = modal.modo === 'editar' ? modal.evento.data : modal.data
  const horaDefault = modal.modo === 'editar' ? modal.evento.hora_inicio.slice(0, 5) : modal.horaInicio
  const duracaoDefault = modal.modo === 'editar' ? modal.evento.duracao_min : modal.duracaoMin

  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? 'Treino')
  const experimental = tipo === 'Sessão experimental'

  // Desmarcar não é imediato — pede sempre, antes, se o treino foi
  // realizado mesmo assim ou não (obrigatório, sem omissão possível),
  // para a ficha do cliente nunca ficar errada por um clique a mais.
  const [aConfirmarDesmarcar, setAConfirmarDesmarcar] = useState(false)
  const [contarComoRealizado, setContarComoRealizado] = useState<boolean | null>(null)
  const [foiRemarcado, setFoiRemarcado] = useState<boolean | null>(null)

  // Apagar também não é imediato quando o evento é parte de uma série
  // — pede sempre primeiro qual o âmbito (só este, os seguintes, os
  // anteriores ou a série toda), nunca ao acaso.
  const [aConfirmarApagar, setAConfirmarApagar] = useState(false)
  const [escopoApagar, setEscopoApagar] = useState<EscopoApagar>('um')

  // Editar uma ocorrência de uma série — por omissão só afeta esta,
  // mas pode-se escolher alargar a "este e os seguintes" ou "toda a
  // série" (ver EscopoEditar em actions.ts). Só disponível quando não
  // há treino em simultâneo (participantes.length <= 1) — reconciliar
  // grupos de várias pessoas em várias ocorrências de uma vez é um
  // problema diferente, fora deste v1.
  const [escopoEditar, setEscopoEditar] = useState<EscopoEditar>('um')

  // Quem já está neste treino — para um treino em simultâneo, o grupo
  // tem mais do que uma pessoa; pode-se adicionar ou remover enquanto
  // se edita, e guardar aplica a todas.
  const [participantes, setParticipantes] = useState<ClienteOpcao[]>(() =>
    modal.modo === 'editar'
      ? modal.grupo
          .map((e) => (e.cliente ? { id: e.cliente.id, nome: e.cliente.nome } : null))
          .filter((c): c is ClienteOpcao => c !== null)
      : []
  )

  // Repetição só existe ao criar — uma ocorrência já guardada edita-se
  // sempre sozinha (ver aviso "só afeta esta ocorrência" mais abaixo).
  const [repete, setRepete] = useState(false)
  const [limiteModo, setLimiteModo] = useState<'vezes' | 'ate' | 'indefinido'>('vezes')

  // Opção discreta para agendar aqui um cliente do outro estúdio (ver
  // NovoEventoForm para a explicação completa) — desligada por omissão.
  const [clienteDeFora, setClienteDeFora] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {editar ? (somenteLeitura ? 'Ver evento' : 'Editar evento') : 'Novo evento'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-1 text-muted hover:bg-brand/[.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {evento?.serie_id && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand/[.06] px-3 py-2">
            <p className="text-xs text-muted">
              {participantes.length <= 1
                ? 'Parte de uma série repetida — escolhe abaixo se guardar afeta só este dia, este e os seguintes, ou toda a série.'
                : 'Parte de uma série repetida — guardar, desmarcar ou apagar um treino em simultâneo afeta só este dia.'}
            </p>
            {!somenteLeitura && (
              <button
                type="button"
                onClick={onPararSerie}
                disabled={aPendente}
                className="shrink-0 rounded-full border border-border-strong px-2.5 py-1 text-xs font-bold hover:bg-foreground/[.08] disabled:opacity-60"
              >
                Parar repetição
              </button>
            )}
          </div>
        )}

        {somenteLeitura && (
          <p className="mt-2 rounded-md bg-brand/[.06] px-3 py-2 text-xs text-muted">
            A tua conta só pode ver a Agenda — pede a um responsável para fazer alterações.
          </p>
        )}

        {participantes.length > 1 && (
          <p className="mt-2 rounded-lg bg-brand/[.06] px-3 py-2 text-xs text-muted">
            Treino em simultâneo — guardar, mover, desmarcar ou apagar aplica-se a todas as
            pessoas.
          </p>
        )}

        {erro && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {erro}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmeter(
              new FormData(e.currentTarget),
              participantes.map((c) => c.id)
            )
          }}
          className="mt-3 flex flex-col gap-3"
        >
          <fieldset disabled={somenteLeitura} className="contents">
          <div className="grid grid-cols-5 gap-1 rounded-full bg-border-subtle p-1">
            {TIPOS_EVENTO_AGENDA.map((t) => (
              <label key={t} className="relative">
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  checked={tipo === t}
                  onChange={() => setTipo(t)}
                  className="peer sr-only"
                />
                <span className="block cursor-pointer rounded-full px-1 py-1 text-center text-[9px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                  {t}
                </span>
              </label>
            ))}
          </div>

          {experimental ? (
            <CamposSessaoExperimental
              leads={leads}
              estudioSlug={slug}
              estudioId={estudioId}
              defaultNome={evento?.titulo ?? ''}
              defaultTelefone={evento?.telefone ?? ''}
              defaultLeadId={evento?.lead_id ?? ''}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {participantes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {participantes.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full bg-brand/[.12] px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {c.nome}
                      <button
                        type="button"
                        onClick={() => setParticipantes((lista) => lista.filter((x) => x.id !== c.id))}
                        className="text-muted hover:text-foreground"
                        title={`Remover ${c.nome} deste treino`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <ClienteCombobox
                clientes={clienteDeFora ? clientesOutroEstudio : clientes}
                excluirIds={participantes.map((c) => c.id)}
                onSelecionar={(c) => setParticipantes((lista) => [...lista, c])}
                placeholder={
                  participantes.length === 0
                    ? '— Reunião / outro (sem cliente) — ou escreve para adicionar'
                    : 'Adicionar mais alguém ao mesmo treino…'
                }
              />
              {outroEstudio && (
                <label className="inline-flex w-fit items-center gap-1.5 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={clienteDeFora}
                    onChange={(e) => setClienteDeFora(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Cliente de {outroEstudio.nome}
                </label>
              )}
            </div>
          )}

          <select name="pt_id" defaultValue={evento?.pt_id ?? ''} className={inputCls}>
            <option value="">— Sem instrutor —</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          {/* Só faz sentido para Reunião/Outro — Treino e Avaliação têm
              sempre um cliente (o combobox acima), não um título livre. */}
          {(tipo === 'Reunião' || tipo === 'Outro') && (
            <input
              name="titulo"
              defaultValue={evento?.titulo ?? ''}
              placeholder="Título (sem cliente)"
              className={inputCls}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              name="data"
              defaultValue={dataDefault}
              required
              readOnly={escopoEditar !== 'um'}
              title={escopoEditar !== 'um' ? 'A data de cada ocorrência mantém-se — escolhe "Só este" para a mudar.' : undefined}
              className={`${inputCls} ${escopoEditar !== 'um' ? 'opacity-50' : ''}`}
            />
            <input type="time" name="hora_inicio" defaultValue={horaDefault} required className={inputCls} />
            <input
              type="number"
              name="duracao_min"
              min={5}
              max={1440}
              step={1}
              list="duracoes-comuns-modal"
              defaultValue={duracaoDefault}
              required
              className={inputCls}
              title="Duração em minutos — qualquer valor, não só os sugeridos"
            />
            <datalist id="duracoes-comuns-modal">
              {DURACOES_COMUNS.map((min) => (
                <option key={min} value={min} />
              ))}
            </datalist>
          </div>

          {editar && evento?.serie_id && participantes.length <= 1 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-semibold text-muted">Ao guardar, aplicar a</legend>
              <div className="grid grid-cols-3 gap-1 rounded-full bg-border-subtle p-1">
                {(
                  [
                    { valor: 'um', label: 'Só este' },
                    { valor: 'seguintes', label: 'Este e seguintes' },
                    { valor: 'serie', label: 'Toda a série' },
                  ] as const
                ).map((o) => (
                  <label key={o.valor} className="relative">
                    <input
                      type="radio"
                      name="escopo"
                      value={o.valor}
                      checked={escopoEditar === o.valor}
                      onChange={() => setEscopoEditar(o.valor)}
                      className="peer sr-only"
                    />
                    <span className="block cursor-pointer rounded-full px-1 py-1 text-center text-[10px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
              {escopoEditar !== 'um' && (
                <p className="text-[11px] text-muted">
                  A data de cada ocorrência mantém-se — só a hora, duração, instrutor, cliente,
                  tipo e nota ficam iguais em todas.
                </p>
              )}
            </fieldset>
          )}

          {!editar && (
            <div className="rounded-lg border border-border-subtle bg-surface p-3">
              <label className="text-xs font-semibold text-muted">Repetição</label>
              <select
                name="repeticao"
                defaultValue="nao"
                onChange={(e) => setRepete(e.target.value !== 'nao')}
                className={`${inputCls} mt-1.5`}
              >
                <option value="nao">Não repete</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
              </select>

              {repete && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1 rounded-full bg-border-subtle p-1">
                    {(
                      [
                        { valor: 'vezes', label: 'Nº de vezes' },
                        { valor: 'ate', label: 'Até uma data' },
                        { valor: 'indefinido', label: 'Indefinidamente' },
                      ] as const
                    ).map((o) => (
                      <label key={o.valor} className="relative">
                        <input
                          type="radio"
                          name="limite_modo"
                          value={o.valor}
                          checked={limiteModo === o.valor}
                          onChange={() => setLimiteModo(o.valor)}
                          className="peer sr-only"
                        />
                        <span className="block cursor-pointer rounded-full px-1 py-1 text-center text-[10px] font-semibold text-muted transition-all peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-pop">
                          {o.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {limiteModo === 'vezes' && (
                    <input
                      type="number"
                      name="repete_vezes"
                      min={1}
                      max={52}
                      defaultValue={8}
                      className={inputCls}
                      placeholder="Quantas vezes"
                    />
                  )}
                  {limiteModo === 'ate' && (
                    <input type="date" name="repete_ate" required className={inputCls} />
                  )}
                  {limiteModo === 'indefinido' && (
                    <p className="text-xs text-muted">
                      Repete sempre à mesma hora até interromperes a série na ficha de um dos
                      eventos — não precisa de data de fim.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <textarea
            name="nota"
            rows={2}
            defaultValue={evento?.nota ?? ''}
            placeholder="Nota (opcional)"
            className={inputCls}
          />

          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="submit"
              disabled={aPendente}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover disabled:opacity-60"
            >
              {aPendente ? 'A guardar…' : 'Guardar'}
            </button>
            <div className="flex items-center gap-1.5">
              {editar && evento?.estado === 'Cancelado' && (
                <button
                  type="button"
                  onClick={onReativar}
                  disabled={aPendente}
                  title="Reativar"
                  className="rounded-full p-2 text-muted hover:bg-brand/[.06] hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              {editar && (
                <button
                  type="button"
                  onClick={() => {
                    if (evento?.serie_id) {
                      setEscopoApagar('um')
                      setAConfirmarApagar(true)
                      return
                    }
                    const aviso =
                      modal.modo === 'editar' && modal.grupo.length > 1
                        ? 'Apagar este treino em simultâneo? Remove todas as pessoas. Não é possível desfazer.'
                        : 'Apagar este evento? Não é possível desfazer.'
                    if (window.confirm(aviso)) onApagar('um')
                  }}
                  disabled={aPendente}
                  title="Apagar"
                  className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          </fieldset>
        </form>

        {/* Desmarcar ganha uma caixa à parte, bem visível — não é um
            ícone perdido ao lado de apagar/reativar — e nunca desmarca
            de imediato: pede sempre, primeiro, se o treino foi
            realizado mesmo assim ou não (sem valor por omissão). */}
        {editar && evento?.estado !== 'Cancelado' && !aConfirmarDesmarcar && !somenteLeitura && (
          <button
            type="button"
            onClick={() => {
              setContarComoRealizado(null)
              setFoiRemarcado(null)
              setAConfirmarDesmarcar(true)
            }}
            disabled={aPendente}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
          >
            <Ban className="h-4 w-4" /> Desmarcar
          </button>
        )}

        {editar && aConfirmarDesmarcar && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Desmarcar este evento</p>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-[11px] font-semibold text-muted">
                O treino foi realizado, mesmo assim? (obrigatório)
              </legend>
              <div className="flex gap-1">
                <label
                  className={`flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                    contarComoRealizado === true
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-subtle bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="conta_como_realizado_modal"
                    className="sr-only"
                    checked={contarComoRealizado === true}
                    onChange={() => setContarComoRealizado(true)}
                  />
                  Sim, conta como realizado
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                    contarComoRealizado === false
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-subtle bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="conta_como_realizado_modal"
                    className="sr-only"
                    checked={contarComoRealizado === false}
                    onChange={() => setContarComoRealizado(false)}
                  />
                  Não
                </label>
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-[11px] font-semibold text-muted">
                Já foi remarcada para outro dia? (obrigatório)
              </legend>
              <div className="flex gap-1">
                <label
                  className={`flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                    foiRemarcado === true ? 'border-accent bg-accent-soft' : 'border-border-subtle bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="foi_remarcado_modal"
                    className="sr-only"
                    checked={foiRemarcado === true}
                    onChange={() => setFoiRemarcado(true)}
                  />
                  Sim, já remarcou
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-md border px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                    foiRemarcado === false ? 'border-accent bg-accent-soft' : 'border-border-subtle bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="foi_remarcado_modal"
                    className="sr-only"
                    checked={foiRemarcado === false}
                    onChange={() => setFoiRemarcado(false)}
                  />
                  Ainda não
                </label>
              </div>
            </fieldset>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={aPendente || contarComoRealizado === null || foiRemarcado === null}
                onClick={() => {
                  if (contarComoRealizado === null || foiRemarcado === null) return
                  onDesmarcar(contarComoRealizado, foiRemarcado)
                }}
                className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {aPendente ? 'A desmarcar…' : 'Confirmar'}
              </button>
              <button
                type="button"
                disabled={aPendente}
                onClick={() => setAConfirmarDesmarcar(false)}
                className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[.06]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Apagar um evento de série repetida pede sempre, primeiro, o
            âmbito — só esta ocorrência, os seguintes, os anteriores ou
            toda a série — nunca um clique só a apagar tudo às cegas. */}
        {editar && aConfirmarApagar && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-xs font-bold text-red-700 dark:text-red-300">
              Apagar evento — esta é uma série repetida
            </p>
            <fieldset className="flex flex-col gap-1">
              {(
                [
                  { valor: 'um', label: 'Só este evento' },
                  { valor: 'seguintes', label: 'Este e os seguintes' },
                  { valor: 'anteriores', label: 'Este e os anteriores' },
                  { valor: 'serie', label: 'Toda a série (passados e futuros)' },
                ] as const
              ).map((o) => (
                <label
                  key={o.valor}
                  className={`cursor-pointer rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    escopoApagar === o.valor
                      ? 'border-red-400 bg-red-100 dark:bg-red-900/40'
                      : 'border-border-subtle bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="escopo_apagar_modal"
                    className="sr-only"
                    checked={escopoApagar === o.valor}
                    onChange={() => setEscopoApagar(o.valor)}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={aPendente}
                onClick={() => {
                  const avisos: Record<EscopoApagar, string> = {
                    um:
                      modal.modo === 'editar' && modal.grupo.length > 1
                        ? 'Apagar este treino em simultâneo? Remove todas as pessoas. Não é possível desfazer.'
                        : 'Apagar este evento? Não é possível desfazer.',
                    seguintes: 'Apagar este evento e todos os seguintes desta série? Não é possível desfazer.',
                    anteriores: 'Apagar este evento e todos os anteriores desta série? Não é possível desfazer.',
                    serie: 'Apagar TODOS os eventos desta série, passados e futuros? Não é possível desfazer.',
                  }
                  if (window.confirm(avisos[escopoApagar])) onApagar(escopoApagar)
                }}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {aPendente ? 'A apagar…' : 'Confirmar'}
              </button>
              <button
                type="button"
                disabled={aPendente}
                onClick={() => setAConfirmarApagar(false)}
                className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[.06]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {editar && evento && (
          <Link
            href={`/painel/${slug}/agenda/${evento.id}`}
            className="mt-3 block text-center text-xs text-muted underline hover:text-foreground"
          >
            Ver ficha completa
          </Link>
        )}
      </div>
    </div>
  )
}
