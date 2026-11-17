'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from '@/components/LinkRapido'
import { X } from 'lucide-react'
import { corTipoEvento, rotuloTipoEvento } from '@/lib/data/agenda'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { historicoAgendaCliente, type HistoricoAgendaCliente } from './actions'

// A janela com tudo o que um cliente tem e teve na agenda — treinos,
// avaliações, sessões —, do primeiro ao último, mês a mês. Abre a
// partir da pesquisa da Agenda. Cada linha leva ao dia desse evento.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]

export default function HistoricoCliente({ clienteId, basePath, onFechar }: { clienteId: string; basePath: string; onFechar: () => void }) {
  const [dados, setDados] = useState<HistoricoAgendaCliente | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = hojeEmLisboa()
  const proximoRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    let ativo = true
    historicoAgendaCliente(clienteId).then((r) => {
      if (!ativo) return
      if ('erro' in r) setErro(r.erro)
      else setDados(r)
    })
    return () => {
      ativo = false
    }
  }, [clienteId])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onFechar])

  // Abre já no próximo agendamento (o que está "agora" na lista).
  useEffect(() => {
    proximoRef.current?.scrollIntoView({ block: 'center' })
  }, [dados])

  const resumo = useMemo(() => {
    const eventos = dados?.eventos ?? []
    const contar = (f: (e: (typeof eventos)[number]) => boolean) => eventos.filter(f).length
    const porTipo = new Map<string, number>()
    for (const e of eventos) if (e.estado !== 'Cancelado') porTipo.set(rotuloTipoEvento(e.tipo, null), (porTipo.get(rotuloTipoEvento(e.tipo, null)) ?? 0) + 1)
    return {
      total: eventos.length,
      realizados: contar((e) => e.estado === 'Concluído'),
      futuros: contar((e) => e.estado === 'Agendado' && e.data >= hoje),
      desmarcados: contar((e) => e.estado === 'Cancelado'),
      porTipo: [...porTipo.entries()].sort((a, b) => b[1] - a[1]),
      primeiro: eventos[0]?.data ?? null,
      ultimo: eventos[eventos.length - 1]?.data ?? null,
    }
  }, [dados, hoje])

  const porMes = useMemo(() => {
    const grupos = new Map<string, NonNullable<typeof dados>['eventos']>()
    for (const e of dados?.eventos ?? []) {
      const m = e.data.slice(0, 7)
      grupos.set(m, [...(grupos.get(m) ?? []), e])
    }
    return [...grupos.entries()]
  }, [dados])
  const idProximo = dados?.eventos.find((e) => e.data >= hoje && e.estado !== 'Cancelado')?.id

  const dataPt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Agendamentos do cliente"
        className="flex w-full max-w-2xl flex-col rounded-2xl border border-border-subtle bg-surface shadow-pop sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">{dados?.cliente.nome ?? 'A carregar…'}</h2>
            {dados && (
              <p className="text-xs text-muted">
                {dados.cliente.numeroSocio ? `Sócio ${dados.cliente.numeroSocio} · ` : ''}
                {dados.cliente.estado}
                {resumo.primeiro ? ` · na agenda desde ${dataPt(resumo.primeiro)}` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dados?.cliente.estudioSlug && (
              <Link
                href={`/painel/${dados.cliente.estudioSlug}/clientes/${dados.cliente.id}`}
                className="rounded-full border border-border-subtle px-3 py-1 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
              >
                Ficha
              </Link>
            )}
            <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {erro && <p className="m-4 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}

        {dados && (
          <>
            <div className="grid grid-cols-2 gap-2 border-b border-border-subtle p-4 sm:grid-cols-4">
              {[
                ['Agendamentos', resumo.total],
                ['Realizados', resumo.realizados],
                ['Por vir', resumo.futuros],
                ['Desmarcados', resumo.desmarcados],
              ].map(([rotulo, n]) => (
                <div key={rotulo} className="rounded-xl bg-foreground/[.04] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{rotulo}</p>
                  <p className="text-xl font-bold text-foreground">{n}</p>
                </div>
              ))}
              {resumo.porTipo.length > 1 && (
                <p className="col-span-2 text-xs text-muted sm:col-span-4">
                  {resumo.porTipo.map(([tipo, n]) => `${n} ${tipo.toLowerCase()}`).join(' · ')} (sem os desmarcados)
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {porMes.length === 0 ? (
                <p className="text-sm text-muted">Ainda não há nada na agenda para este cliente.</p>
              ) : (
                porMes.map(([mes, eventos]) => (
                  <section key={mes} className="mb-4 last:mb-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      {MESES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)} <span className="font-normal normal-case">· {eventos.length}</span>
                    </h3>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {eventos.map((e) => {
                        const cancelado = e.estado === 'Cancelado'
                        const futuro = e.data > hoje || (e.data === hoje && e.estado === 'Agendado')
                        const destino = e.estudioSlug ? `/painel/${e.estudioSlug}/agenda` : basePath
                        return (
                          <li key={e.id} ref={e.id === idProximo ? proximoRef : undefined}>
                            <Link
                              href={`${destino}?vista=dia&data=${e.data}`}
                              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand/[.08] ${e.id === idProximo ? 'ring-1 ring-brand' : ''} ${cancelado ? 'opacity-55' : ''}`}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corTipoEvento(e.tipo).tx }} />
                              <span className="w-24 shrink-0 font-mono text-xs text-muted">
                                {diaSemana(e.data)} {e.data.slice(8, 10)}/{e.data.slice(5, 7)}
                              </span>
                              <span className="w-12 shrink-0 font-mono text-xs text-foreground">{e.horaInicio.slice(0, 5)}</span>
                              <span className={`min-w-0 flex-1 truncate text-foreground ${cancelado ? 'line-through' : ''}`}>
                                {rotuloTipoEvento(e.tipo, e.titulo)}
                                {e.nomePt && <span className="text-muted"> · {e.nomePt.split(' ')[0]}</span>}
                                {e.nota && <span className="text-muted" title={e.nota}> · {e.nota}</span>}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  cancelado
                                    ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                    : e.estado === 'Concluído'
                                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                      : futuro
                                        ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200'
                                        : 'bg-foreground/[.06] text-muted'
                                }`}
                              >
                                {cancelado ? 'Desmarcado' : e.estado === 'Concluído' ? 'Realizado' : futuro ? 'Agendado' : 'Por fechar'}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
