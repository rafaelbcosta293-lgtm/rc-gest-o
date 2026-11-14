'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import { BLOCOS_HORARIO, DIAS_SEMANA, chaveSlot } from '@/lib/data/horarios'
import { fmt } from '@/lib/data/presencas'
import type { Perfil } from '@/lib/supabase/database.types'

export type SlotPt = { pt_id: string; nome: string }
export type CorPt = { bg: string; tx: string }

const CINZA_OMISSAO: CorPt = { bg: '#F2F5FA', tx: '#6B7688' }

function corDoPt(corPorPt: Record<string, CorPt> | undefined, ptId: string): CorPt {
  return corPorPt?.[ptId] ?? CINZA_OMISSAO
}

// Com mais de uma pessoa no mesmo bloco, ficam lado a lado (em colunas
// da mesma largura, sempre pela mesma ordem — alfabética — para cada
// pessoa manter a sua coluna de linha para linha) e só com o primeiro
// nome, para caber; o nome completo aparece ao passar o rato.
function Insignia({ nome, cor, compacta = false }: { nome: string; cor: CorPt; compacta?: boolean }) {
  return (
    <span
      title={nome}
      className="min-w-0 flex-1 truncate rounded px-1 py-px text-center text-[9px] font-medium leading-tight"
      style={{ background: cor.bg, color: cor.tx }}
    >
      {compacta ? nome.trim().split(/\s+/)[0] : nome}
    </span>
  )
}

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt')

type PropsComuns = {
  dias: string[]
  slots: Record<string, SlotPt[]>
  corPorPt?: Record<string, CorPt>
}

type PropsSoLeitura = PropsComuns & { editavel?: false }

type AtribuicaoSlot = { data: string; hora: number; minuto: number; pt_ids: string[] }
type ResultadoGuardar = { ok: true } | { error: string }

type PropsEditavel = PropsComuns & {
  editavel: true
  pts: Pick<Perfil, 'id' | 'nome'>[]
  estudioSlug: string
  estudioId: number
  semana: string
  guardar: (input: {
    estudioSlug: string
    estudioId: number
    semana: string
    atribuicoes: AtribuicaoSlot[]
  }) => Promise<ResultadoGuardar>
}

export default function GrelhaHorarios(props: PropsSoLeitura | PropsEditavel) {
  return props.editavel ? <GrelhaEditavel {...props} /> : <GrelhaSoLeitura {...props} />
}

function Cabecalho({ dias }: { dias: string[] }) {
  return (
    <>
      <div className="bg-zinc-50 p-0.5 dark:bg-zinc-900" />
      {dias.map((d, i) => (
        <div
          key={d}
          className="bg-zinc-50 p-0.5 text-center text-[10px] font-medium text-foreground dark:bg-zinc-900"
        >
          {DIAS_SEMANA[i].slice(0, 3)}
          <br />
          <span className="font-normal text-zinc-500">{fmt(d)}</span>
        </div>
      ))}
    </>
  )
}

function GrelhaSoLeitura({ dias, slots, corPorPt }: PropsSoLeitura) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[620px] gap-px overflow-hidden rounded-lg border border-border-subtle bg-black/10 text-[10px] dark:bg-white/10"
        style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}
      >
        <Cabecalho dias={dias} />
        {BLOCOS_HORARIO.map((bloco) => (
          <Fragment key={`${bloco.hora}-${bloco.minuto}`}>
            <div className="flex items-center bg-surface px-1 py-0.5 text-[9px] text-zinc-500">
              {bloco.label}
            </div>
            {dias.map((dia) => {
              const atual = slots[chaveSlot(dia, bloco.hora, bloco.minuto)] ?? []
              return (
                <div
                  key={dia}
                  className="flex min-h-[1.25rem] items-center justify-center gap-0.5 bg-surface p-0.5 text-[9px] leading-tight"
                >
                  {atual.length === 0 ? (
                    <span className="text-center text-zinc-300 dark:text-zinc-700">—</span>
                  ) : (
                    [...atual]
                      .sort((a, b) => porNome(a.nome, b.nome))
                      .map((s) => (
                        <Insignia key={s.pt_id} nome={s.nome} cor={corDoPt(corPorPt, s.pt_id)} compacta={atual.length > 1} />
                      ))
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function estadoInicialDeSlots(slots: Record<string, SlotPt[]>): Record<string, string[]> {
  const estado: Record<string, string[]> = {}
  for (const [chave, lista] of Object.entries(slots)) {
    estado[chave] = lista.map((s) => s.pt_id)
  }
  return estado
}

function GrelhaEditavel({
  dias,
  slots,
  corPorPt,
  pts,
  estudioSlug,
  estudioId,
  semana,
  guardar,
}: PropsEditavel) {
  const [atribuicoes, setAtribuicoes] = useState<Record<string, string[]>>(() =>
    estadoInicialDeSlots(slots)
  )
  const [abertaChave, setAbertaChave] = useState<string | null>(null)
  const [alterado, setAlterado] = useState(false)
  const [estadoGuardar, setEstadoGuardar] = useState<'idle' | 'guardado' | 'erro'>('idle')
  const [aGuardar, iniciarGuardar] = useTransition()
  const ptsPorId = new Map(pts.map((p) => [p.id, p.nome]))

  // Modo "pintar": com um instrutor escolhido aqui, arrastar o rato por
  // cima de vários blocos marca-os todos de uma vez (o primeiro bloco
  // tocado decide se a passagem adiciona ou remove esse instrutor,
  // tal como arrastar um marcador — ou apagá-lo — por cima de texto).
  // Sem ninguém escolhido, cada bloco continua a abrir a lista
  // completa para escolhas precisas (vários instrutores no mesmo
  // bloco), exatamente como antes.
  const [ptAtivoId, setPtAtivoId] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<{ adicionar: boolean } | null>(null)

  const aplicarPt = (chave: string, ptId: string, adicionar: boolean) => {
    setAtribuicoes((atual) => {
      const lista = atual[chave] ?? []
      const jaTem = lista.includes(ptId)
      if (adicionar === jaTem) return atual
      const nova = adicionar ? [...lista, ptId] : lista.filter((id) => id !== ptId)
      return { ...atual, [chave]: nova }
    })
    setAlterado(true)
    setEstadoGuardar('idle')
  }

  const alternarPt = (chave: string, ptId: string) => {
    const lista = atribuicoes[chave] ?? []
    aplicarPt(chave, ptId, !lista.includes(ptId))
  }

  // Termina sempre o arrasto ao soltar o rato, mesmo que seja fora de
  // um bloco (ex.: o cursor saiu da grelha antes de soltar).
  useEffect(() => {
    if (!arrastando) return
    function soltar() {
      setArrastando(null)
    }
    window.addEventListener('mouseup', soltar)
    return () => window.removeEventListener('mouseup', soltar)
  }, [arrastando])

  const guardarAlteracoes = () => {
    const atribuicoesParaEnviar: AtribuicaoSlot[] = Object.entries(atribuicoes)
      .filter(([, ptIds]) => ptIds.length > 0)
      .map(([chave, ptIds]) => {
        const [data, horaStr, minutoStr] = chave.split('_')
        return { data, hora: Number(horaStr), minuto: Number(minutoStr), pt_ids: ptIds }
      })

    iniciarGuardar(async () => {
      const resultado = await guardar({
        estudioSlug,
        estudioId,
        semana,
        atribuicoes: atribuicoesParaEnviar,
      })
      setEstadoGuardar('error' in resultado ? 'erro' : 'guardado')
      if (!('error' in resultado)) setAlterado(false)
    })
  }

  return (
    <div>
      {pts.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-500">Pintar com:</span>
          {pts.map((p) => {
            const ativo = ptAtivoId === p.id
            const cor = corDoPt(corPorPt, p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPtAtivoId((atual) => (atual === p.id ? null : p.id))
                  setAbertaChave(null)
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                  ativo ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ background: cor.bg, color: cor.tx, ...(ativo ? { boxShadow: `0 0 0 2px ${cor.tx}` } : {}) }}
              >
                {p.nome}
              </button>
            )
          })}
          {ptAtivoId && (
            <span className="text-[11px] text-zinc-500">
              — arrasta pelos blocos para marcar/desmarcar vários de uma vez
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <div
          className={`grid min-w-[620px] gap-px overflow-hidden rounded-lg border border-border-subtle bg-black/10 text-[10px] dark:bg-white/10 ${ptAtivoId ? 'select-none' : ''}`}
          style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}
        >
          <Cabecalho dias={dias} />
          {BLOCOS_HORARIO.map((bloco) => (
            <Fragment key={`${bloco.hora}-${bloco.minuto}`}>
              <div className="flex items-center bg-surface px-1 py-0.5 text-[9px] text-zinc-500">
                {bloco.label}
              </div>
              {dias.map((dia) => {
                const chave = chaveSlot(dia, bloco.hora, bloco.minuto)
                const ptIdsAtuais = atribuicoes[chave] ?? []
                const aberta = abertaChave === chave && !ptAtivoId

                if (aberta) {
                  return (
                    <div
                      key={dia}
                      className="flex max-h-32 flex-col gap-0.5 overflow-y-auto bg-teal-50 p-1 dark:bg-teal-950"
                    >
                      {pts.map((p) => (
                        <label key={p.id} className="flex items-center gap-1 text-[10px]">
                          <input
                            type="checkbox"
                            checked={ptIdsAtuais.includes(p.id)}
                            onChange={() => alternarPt(chave, p.id)}
                          />
                          <span className="truncate">{p.nome}</span>
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAbertaChave(null)}
                        className="mt-0.5 self-start text-[9px] text-zinc-500 underline"
                      >
                        Fechar
                      </button>
                    </div>
                  )
                }

                const ptAtivoNesteSlot = ptAtivoId ? ptIdsAtuais.includes(ptAtivoId) : false

                return (
                  <button
                    key={dia}
                    type="button"
                    onMouseDown={
                      ptAtivoId
                        ? (e) => {
                            e.preventDefault()
                            const adicionar = !ptAtivoNesteSlot
                            aplicarPt(chave, ptAtivoId, adicionar)
                            setArrastando({ adicionar })
                          }
                        : undefined
                    }
                    onMouseEnter={
                      ptAtivoId && arrastando ? () => aplicarPt(chave, ptAtivoId, arrastando.adicionar) : undefined
                    }
                    onClick={ptAtivoId ? undefined : () => setAbertaChave(chave)}
                    className={`flex min-h-[1.25rem] items-center justify-center gap-0.5 p-0.5 text-[9px] leading-tight ${
                      ptAtivoId
                        ? `cursor-pointer ${ptAtivoNesteSlot ? '' : 'bg-surface hover:bg-foreground/[.05]'}`
                        : 'bg-surface hover:bg-foreground/[.05]'
                    }`}
                    style={ptAtivoId && ptAtivoNesteSlot ? { background: corDoPt(corPorPt, ptAtivoId).bg } : undefined}
                  >
                    {ptIdsAtuais.length === 0 ? (
                      <span className="text-center text-zinc-300 dark:text-zinc-700">+</span>
                    ) : (
                      [...ptIdsAtuais]
                        .sort((a, b) => porNome(ptsPorId.get(a) ?? '', ptsPorId.get(b) ?? ''))
                        .map((id) => (
                          <Insignia
                            key={id}
                            nome={ptsPorId.get(id) ?? '—'}
                            cor={corDoPt(corPorPt, id)}
                            compacta={ptIdsAtuais.length > 1}
                          />
                        ))
                    )}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={guardarAlteracoes}
          disabled={aGuardar}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {aGuardar ? 'A guardar…' : 'Guardar alterações'}
        </button>
        {estadoGuardar === 'guardado' && (
          <span className="text-xs text-teal-700 dark:text-teal-400">Guardado ✓</span>
        )}
        {estadoGuardar === 'erro' && (
          <span className="text-xs text-red-600">Não foi possível guardar — tenta outra vez.</span>
        )}
        {estadoGuardar === 'idle' && alterado && (
          <span className="text-xs text-amber-600">Há alterações por guardar.</span>
        )}
      </div>
    </div>
  )
}
