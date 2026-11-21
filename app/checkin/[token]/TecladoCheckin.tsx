'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Delete, AlertTriangle, HeartHandshake } from 'lucide-react'
import { registarPresenca } from './actions'
import { limparNumero, mensagemCheckin, type ResultadoCheckin } from '@/lib/data/checkin'

const SEGUNDOS_RESULTADO = 4

export default function TecladoCheckin({ token }: { token: string }) {
  const [numero, setNumero] = useState('')
  const [resultado, setResultado] = useState<ResultadoCheckin | null>(null)
  const [pendente, iniciar] = useTransition()
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Manter o ecrã ligado enquanto a página está aberta (se o browser deixar).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const pedir = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        // sem suporte ou recusado — não faz mal
      }
    }
    void pedir()
    const aoVoltar = () => document.visibilityState === 'visible' && void pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      void lock?.release().catch(() => {})
    }
  }, [])

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  const carregar = (d: string) => {
    if (resultado || pendente) return
    setNumero((n) => limparNumero(n + d))
  }
  const apagar = () => !resultado && !pendente && setNumero((n) => n.slice(0, -1))

  const registar = () => {
    if (!numero || pendente) return
    const enviado = numero
    iniciar(async () => {
      let r: ResultadoCheckin
      try {
        r = await registarPresenca(token, enviado)
      } catch {
        r = { estado: 'erro' }
      }
      // Limpa logo o número (privacidade: não fica à vista do seguinte).
      setNumero('')
      setResultado(r)
      if (temporizador.current) clearTimeout(temporizador.current)
      // A mensagem da mensalidade é mais longa: fica mais tempo no ecrã.
      const segundos = r.estado === 'sem_mensalidade' ? SEGUNDOS_RESULTADO * 2 : SEGUNDOS_RESULTADO
      temporizador.current = setTimeout(() => setResultado(null), segundos * 1000)
    })
  }

  // Teclado físico (se o tablet tiver um).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) carregar(e.key)
      else if (e.key === 'Backspace') apagar()
      else if (e.key === 'Enter') registar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  const msg = resultado ? mensagemCheckin(resultado) : null

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f5f3ef] px-4 py-6 text-zinc-900 select-none">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">RC Private Fitness Studio</p>
      <h1 className="mt-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">Registar presença</h1>

      {msg ? (
        <div
          role="status"
          aria-live="polite"
          onClick={() => setResultado(null)}
          className={`mt-10 flex w-full max-w-md flex-col items-center rounded-3xl px-6 py-12 text-center shadow-lg ${
            msg.tom === 'ok'
              ? 'bg-emerald-600 text-white'
              : msg.tom === 'info'
                ? 'bg-sky-50 text-sky-950 ring-1 ring-sky-200'
                : msg.tom === 'aviso'
                  ? 'bg-amber-100 text-amber-950'
                  : 'bg-red-100 text-red-950'
          }`}
        >
          {msg.tom === 'ok' ? (
            <CheckCircle2 className="h-20 w-20" />
          ) : msg.tom === 'info' ? (
            <HeartHandshake className="h-16 w-16 text-sky-600" />
          ) : (
            <AlertTriangle className="h-16 w-16" />
          )}
          <p className="mt-4 text-2xl font-bold">{msg.titulo}</p>
          <p className="mt-2 text-lg">{msg.texto}</p>
        </div>
      ) : (
        <div className="mt-6 w-full max-w-sm">
          <p className="text-center text-base text-zinc-600">Escreva o seu nº de cliente (só os números)</p>
          <div
            className="mt-3 flex h-16 items-center justify-center rounded-2xl border-2 border-zinc-300 bg-white text-4xl font-bold tracking-[0.3em] tabular-nums"
            aria-label="Nº de cliente"
          >
            {numero || <span className="text-2xl font-normal tracking-normal text-zinc-300">nº de cliente</span>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <Tecla key={d} onClick={() => carregar(d)}>
                {d}
              </Tecla>
            ))}
            <Tecla onClick={apagar} aria-label="Apagar">
              <Delete className="h-8 w-8" />
            </Tecla>
            <Tecla onClick={() => carregar('0')}>0</Tecla>
            <Tecla onClick={() => setNumero('')} aria-label="Limpar">
              <span className="text-lg font-semibold">Limpar</span>
            </Tecla>
          </div>
          <button
            type="button"
            onClick={registar}
            disabled={!numero || pendente}
            className="mt-4 h-16 w-full rounded-2xl bg-zinc-900 text-xl font-bold text-white shadow-md transition active:scale-[.98] disabled:opacity-40"
          >
            {pendente ? 'A registar…' : 'Registar presença'}
          </button>
        </div>
      )}
    </main>
  )
}

function Tecla({ children, onClick, ...resto }: { children: React.ReactNode; onClick: () => void; 'aria-label'?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...resto}
      className="flex h-[4.5rem] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-3xl font-semibold shadow-sm transition active:scale-95 active:bg-zinc-100"
    >
      {children}
    </button>
  )
}
