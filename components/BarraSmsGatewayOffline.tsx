'use client'

import { useEffect, useState } from 'react'

// Verifica a cada minuto se já recuperou (a faixa desaparece sozinha,
// sem precisar de navegar) — e recalcula o "há quanto tempo" a cada 30s
// para o texto não ficar estático enquanto a faixa está visível.
const INTERVALO_VERIFICACAO_MS = 60_000
const INTERVALO_RELOGIO_MS = 30_000

function formatarDuracao(desdeISO: string, agora: number): string {
  const minutos = Math.max(0, Math.round((agora - new Date(desdeISO).getTime()) / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
}

export default function BarraSmsGatewayOffline({
  offlineInicial,
  desdeInicial,
}: {
  offlineInicial: boolean
  desdeInicial: string | null
}) {
  const [estado, setEstado] = useState({ offline: offlineInicial, desde: desdeInicial })
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), INTERVALO_RELOGIO_MS)
    return () => clearInterval(relogio)
  }, [])

  useEffect(() => {
    const verificar = async () => {
      try {
        const resposta = await fetch('/api/estado-sms-gateway', { cache: 'no-store' })
        if (!resposta.ok) return
        setEstado(await resposta.json())
      } catch {
        // falha a verificar não é motivo para esconder a faixa a meio
      }
    }
    const intervalo = setInterval(verificar, INTERVALO_VERIFICACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  if (!estado.offline || !estado.desde) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-xs font-bold text-white sm:text-sm">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />
      Telemóvel do SMS Gateway offline há {formatarDuracao(estado.desde, agora)} — os lembretes de
      treino não estão a ser enviados.
    </div>
  )
}
