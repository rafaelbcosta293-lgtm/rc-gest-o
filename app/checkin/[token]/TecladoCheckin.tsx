'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Delete, AlertTriangle, HeartHandshake, Smartphone, Landmark } from 'lucide-react'
import QRCode from 'qrcode'
import { registarPresenca } from './actions'
import { formatarEuros, limparNumero, mensagemCheckin, temDadosPagamento, type DadosPagamento, type ResultadoCheckin } from '@/lib/data/checkin'

const SEGUNDOS_RESULTADO = 4
// Mensalidade por regularizar: o aviso e os meios de pagamento ficam no
// ecrã mais tempo (dá para pagar ali mesmo, pelo QR code ou MB Way).
const SEGUNDOS_PAGAMENTO = 30

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
      const segundos = r.estado === 'sem_mensalidade' ? (temDadosPagamento(r.pagamento) ? SEGUNDOS_PAGAMENTO : SEGUNDOS_RESULTADO * 2) : SEGUNDOS_RESULTADO
      temporizador.current = setTimeout(limpar, segundos * 1000)
    })
  }

  function limpar() {
    if (temporizador.current) clearTimeout(temporizador.current)
    setResultado(null)
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

      {resultado?.estado === 'sem_mensalidade' ? (
        <MensalidadeEmFalta resultado={resultado} onFechar={limpar} />
      ) : msg ? (
        <div
          role="status"
          aria-live="polite"
          onClick={limpar}
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

// Presença não registada por falta de mensalidade em dia: aviso simpático
// e, no mesmo ecrã, como pagar já (QR code do link de pagamento, MB Way,
// IBAN). Desaparece sozinho ao fim de 30 s.
function MensalidadeEmFalta({
  resultado,
  onFechar,
}: {
  resultado: Extract<ResultadoCheckin, { estado: 'sem_mensalidade' }>
  onFechar: () => void
}) {
  const msg = mensagemCheckin(resultado)
  const dados = temDadosPagamento(resultado.pagamento) ? resultado.pagamento : null
  return (
    <div role="status" aria-live="polite" className="mt-6 w-full max-w-lg rounded-3xl bg-white px-6 py-7 text-center shadow-lg ring-1 ring-sky-200">
      <HeartHandshake className="mx-auto h-12 w-12 text-sky-600" />
      <p className="mt-3 text-2xl font-bold">{msg.titulo}</p>
      <p className="mt-2 text-lg text-zinc-700">{msg.texto}</p>
      {resultado.valor != null && (
        <p className="mt-4 text-base text-zinc-600">
          Valor da mensalidade: <span className="text-2xl font-bold text-zinc-900">{formatarEuros(resultado.valor)}</span>
        </p>
      )}
      {dados && <MeiosPagamento dados={dados} />}
      <button type="button" onClick={onFechar} className="mt-6 h-14 w-full rounded-2xl bg-zinc-900 text-lg font-bold text-white active:scale-[.98]">
        Concluir
      </button>
    </div>
  )
}

function MeiosPagamento({ dados }: { dados: DadosPagamento }) {
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    if (!dados.link) return
    let ativo = true
    QRCode.toDataURL(dados.link, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then((url) => ativo && setQr(url))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [dados.link])
  return (
    <div className="mt-5 space-y-3 text-left">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-zinc-500">Formas de pagamento</p>
      {dados.link && qr && (
        <div className="flex flex-col items-center rounded-2xl bg-zinc-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code para pagar a mensalidade" className="h-48 w-48" />
          <p className="mt-2 text-base font-semibold">Aponte a câmara do telemóvel para pagar já</p>
        </div>
      )}
      {dados.mbway && (
        <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-4">
          <Smartphone className="h-8 w-8 shrink-0 text-zinc-700" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">MB Way</p>
            <p className="text-3xl font-bold tabular-nums">{dados.mbway}</p>
          </div>
        </div>
      )}
      {dados.iban && (
        <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-4">
          <Landmark className="h-8 w-8 shrink-0 text-zinc-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Transferência bancária</p>
            <p className="break-all text-xl font-bold tabular-nums">{dados.iban}</p>
            {dados.titular && <p className="text-sm text-zinc-600">Titular: {dados.titular}</p>}
          </div>
        </div>
      )}
      {(dados.mbway || dados.iban) && <p className="text-center text-sm text-zinc-600">Na descrição do pagamento, indique o seu nº de cliente.</p>}
      {dados.nota && <p className="whitespace-pre-line text-center text-base text-zinc-700">{dados.nota}</p>}
    </div>
  )
}
