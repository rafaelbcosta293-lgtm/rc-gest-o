'use client'

import { useEffect, useState } from 'react'

// Verifica a cada minuto se já recuperou (a faixa desaparece sozinha,
// sem precisar de navegar) — e recalcula o "há quanto tempo" a cada 30s
// para o texto não ficar estático enquanto a faixa está visível.
const INTERVALO_VERIFICACAO_MS = 60_000
const INTERVALO_RELOGIO_MS = 30_000

type EstadoEstudio = { estudioSlug: string; estudioNome: string; offline: boolean; desde: string | null }

function formatarDuracao(desdeISO: string, agora: number): string {
  const minutos = Math.max(0, Math.round((agora - new Date(desdeISO).getTime()) / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
}

// Sem "apenasEstudio", mostra qualquer estúdio que esteja offline (usado
// em Administração/Coordenação, que veem os dois) — com "apenasEstudio",
// só mostra esse (usado dentro do painel de cada estúdio).
export default function BarraSmsGatewayOffline({
  estadosIniciais,
  apenasEstudio,
}: {
  estadosIniciais: EstadoEstudio[]
  apenasEstudio?: string
}) {
  const [estados, setEstados] = useState(estadosIniciais)
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
        setEstados(await resposta.json())
      } catch {
        // falha a verificar não é motivo para esconder a faixa a meio
      }
    }
    const intervalo = setInterval(verificar, INTERVALO_VERIFICACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const visiveis = estados.filter((e) => e.offline && e.desde && (!apenasEstudio || e.estudioSlug === apenasEstudio))
  if (visiveis.length === 0) return null

  return (
    <div className="flex flex-col">
      {visiveis.map((e) => (
        <div
          key={e.estudioSlug}
          className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-xs font-bold text-white sm:text-sm"
        >
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />
          Telemóvel do SMS Gateway ({e.estudioNome}) offline há {formatarDuracao(e.desde!, agora)} — os
          lembretes de treino não estão a ser enviados.
        </div>
      ))}
    </div>
  )
}
