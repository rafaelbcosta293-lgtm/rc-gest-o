'use client'

import { Fragment, useState, useTransition } from 'react'
import { BLOCOS_HORARIO, DIAS_SEMANA, chaveSlot } from '@/lib/data/horarios'
import { fmt } from '@/lib/data/presencas'
import type { Perfil } from '@/lib/supabase/database.types'

export type SlotPt = { pt_id: string; nome: string }
export type CorPt = { bg: string; tx: string }

const CINZA_OMISSAO: CorPt = { bg: '#F2F5FA', tx: '#6B7688' }

function corDoPt(corPorPt: Record<string, CorPt> | undefined, ptId: string): CorPt {
  return corPorPt?.[ptId] ?? CINZA_OMISSAO
}

function Insignia({ nome, cor }: { nome: string; cor: CorPt }) {
  return (
    <span
      className="truncate rounded px-1 py-0.5 text-[10px] font-medium"
      style={{ background: cor.bg, color: cor.tx }}
    >
      {nome}
    </span>
  )
}

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
      <div className="bg-zinc-50 p-1.5 dark:bg-zinc-900" />
      {dias.map((d, i) => (
        <div
          key={d}
          className="bg-zinc-50 p-1.5 text-center font-medium text-black dark:bg-zinc-900 dark:text-zinc-50"
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
        className="grid min-w-[760px] gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 text-xs dark:border-white/10 dark:bg-white/10"
        style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
      >
        <Cabecalho dias={dias} />
        {BLOCOS_HORARIO.map((bloco) => (
          <Fragment key={`${bloco.hora}-${bloco.minuto}`}>
            <div className="flex items-center bg-white p-1.5 text-zinc-500 dark:bg-zinc-950">
              {bloco.label}
            </div>
            {dias.map((dia) => {
              const atual = slots[chaveSlot(dia, bloco.hora, bloco.minuto)] ?? []
              return (
                <div
                  key={dia}
                  className="flex min-h-[2.25rem] flex-col justify-center gap-0.5 bg-white p-1 text-[11px] leading-tight dark:bg-zinc-950"
                >
                  {atual.length === 0 ? (
                    <span className="text-center text-zinc-300 dark:text-zinc-700">—</span>
                  ) : (
                    atual.map((s) => (
                      <Insignia key={s.pt_id} nome={s.nome} cor={corDoPt(corPorPt, s.pt_id)} />
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

  const alternarPt = (chave: string, ptId: string) => {
    setAtribuicoes((atual) => {
      const lista = atual[chave] ?? []
      const nova = lista.includes(ptId) ? lista.filter((id) => id !== ptId) : [...lista, ptId]
      return { ...atual, [chave]: nova }
    })
    setAlterado(true)
    setEstadoGuardar('idle')
  }

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
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[760px] gap-px overflow-hidden rounded-lg border border-black/10 bg-black/10 text-xs dark:border-white/10 dark:bg-white/10"
          style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
        >
          <Cabecalho dias={dias} />
          {BLOCOS_HORARIO.map((bloco) => (
            <Fragment key={`${bloco.hora}-${bloco.minuto}`}>
              <div className="flex items-center bg-white p-1.5 text-zinc-500 dark:bg-zinc-950">
                {bloco.label}
              </div>
              {dias.map((dia) => {
                const chave = chaveSlot(dia, bloco.hora, bloco.minuto)
                const ptIdsAtuais = atribuicoes[chave] ?? []
                const aberta = abertaChave === chave

                if (aberta) {
                  return (
                    <div
                      key={dia}
                      className="flex max-h-32 flex-col gap-0.5 overflow-y-auto bg-teal-50 p-1 dark:bg-teal-950"
                    >
                      {pts.map((p) => (
                        <label key={p.id} className="flex items-center gap-1 text-[11px]">
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
                        className="mt-0.5 self-start text-[10px] text-zinc-500 underline"
                      >
                        Fechar
                      </button>
                    </div>
                  )
                }

                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setAbertaChave(chave)}
                    className="flex min-h-[2.25rem] flex-col justify-center gap-0.5 bg-white p-1 text-[11px] leading-tight hover:bg-black/[.03] dark:bg-zinc-950 dark:hover:bg-white/[.06]"
                  >
                    {ptIdsAtuais.length === 0 ? (
                      <span className="text-center text-zinc-300 dark:text-zinc-700">+</span>
                    ) : (
                      ptIdsAtuais.map((id) => (
                        <Insignia key={id} nome={ptsPorId.get(id) ?? '—'} cor={corDoPt(corPorPt, id)} />
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
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
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
