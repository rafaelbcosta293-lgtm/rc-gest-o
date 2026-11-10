'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { PhoneCall } from 'lucide-react'
import { marcarContactoFeito } from '@/app/painel/[estudio]/leads/actions'
import { avaliarContactoAgendado } from '@/lib/data/contactosAgendados'

// Contacto que a própria lead pediu a uma hora certa (ex.: "liga-me às
// 15h", guardado em LeadForm.tsx). Fica visível aqui a partir de
// MINUTOS_ANTECEDENCIA_CONTACTO antes da hora marcada (ver
// avaliarContactoAgendado), e passa a emitir um sinal sonoro a partir
// da própria hora, repetido enquanto não for marcado como contactado —
// para nunca se perder este tipo de compromisso.
const INTERVALO_VERIFICACAO_MS = 20_000
const INTERVALO_RELOGIO_MS = 5_000
const INTERVALO_SOM_MS = 30_000

type ContactoAgendado = {
  id: string
  nome: string
  telefone: string | null
  estudioSlug: string
  estudioNome: string
  data: string
  hora: string
}

type AudioCtor = typeof AudioContext

function obterAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null
}

// Dois bips curtos — não depende de nenhum ficheiro de áudio externo.
// Alguns browsers só deixam tocar som depois de uma primeira interação
// da pessoa na página (ver desbloquearAudio); nesse caso falha em
// silêncio, a faixa visual já chega.
function tocarAlerta(ctx: AudioContext) {
  try {
    for (const atraso of [0, 0.3]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.0001
      osc.connect(gain)
      gain.connect(ctx.destination)
      const inicio = ctx.currentTime + atraso
      gain.gain.exponentialRampToValueAtTime(0.3, inicio + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18)
      osc.start(inicio)
      osc.stop(inicio + 0.2)
    }
  } catch {
    // ignora falhas de áudio — o alerta visual já chega nesse caso
  }
}

// Sem "apenasEstudio", mostra qualquer estúdio (usado em
// Administração/Coordenação, que veem os dois) — com "apenasEstudio",
// só mostra esse (usado dentro do painel de cada estúdio).
export default function AlertaContactosAgendados({
  contactosIniciais,
  apenasEstudio,
}: {
  contactosIniciais: ContactoAgendado[]
  apenasEstudio?: string
}) {
  const [contactos, setContactos] = useState(contactosIniciais)
  const [agora, setAgora] = useState(() => Date.now())
  const [concluidos, setConcluidos] = useState<Set<string>>(new Set())
  const [aMarcar, iniciarMarcacao] = useTransition()
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ultimoBipRef = useRef(0)

  useEffect(() => {
    function desbloquearAudio() {
      if (!audioCtxRef.current) {
        const AudioCtor = obterAudioCtor()
        if (AudioCtor) audioCtxRef.current = new AudioCtor()
      }
      audioCtxRef.current?.resume().catch(() => {})
    }
    window.addEventListener('pointerdown', desbloquearAudio, { once: true })
    window.addEventListener('keydown', desbloquearAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', desbloquearAudio)
      window.removeEventListener('keydown', desbloquearAudio)
    }
  }, [])

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), INTERVALO_RELOGIO_MS)
    return () => clearInterval(relogio)
  }, [])

  useEffect(() => {
    const verificar = async () => {
      try {
        const resposta = await fetch('/api/leads/contactos-agendados', { cache: 'no-store' })
        if (!resposta.ok) return
        setContactos(await resposta.json())
      } catch {
        // falha a verificar não é motivo para esconder a faixa a meio
      }
    }
    const intervalo = setInterval(verificar, INTERVALO_VERIFICACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const visiveis = contactos
    .filter((c) => !concluidos.has(c.id))
    .filter((c) => !apenasEstudio || c.estudioSlug === apenasEstudio)
    .map((c) => ({ ...c, ...avaliarContactoAgendado(c, agora) }))
    .filter((c) => c.estado !== 'oculto')
    .sort((a, b) => a.minutosRestantes - b.minutosRestantes)

  const haAtrasados = visiveis.some((c) => c.estado === 'atrasado')

  useEffect(() => {
    if (!haAtrasados) return
    if (agora - ultimoBipRef.current < INTERVALO_SOM_MS) return
    ultimoBipRef.current = agora
    if (audioCtxRef.current) tocarAlerta(audioCtxRef.current)
  }, [haAtrasados, agora])

  function marcarContactado(c: ContactoAgendado) {
    setConcluidos((atual) => new Set(atual).add(c.id))
    iniciarMarcacao(async () => {
      await marcarContactoFeito({ estudioSlug: c.estudioSlug, id: c.id })
    })
  }

  if (visiveis.length === 0) return null

  return (
    <div className="flex flex-col">
      {visiveis.map((c) => {
        const atrasado = c.estado === 'atrasado'
        return (
          <div
            key={c.id}
            className={`flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-xs font-bold text-white sm:text-sm ${
              atrasado ? 'bg-red-600' : 'bg-amber-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full bg-white ${atrasado ? 'animate-ping' : 'animate-pulse'}`}
            />
            <PhoneCall className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {atrasado
              ? `Contacto atrasado: ${c.nome} pediu para ser contactada às ${c.hora.slice(0, 5)} (${c.estudioNome})`
              : `Contacto agendado: ${c.nome} às ${c.hora.slice(0, 5)}, dentro de ${c.minutosRestantes} min (${c.estudioNome})`}
            {c.telefone && (
              <a href={`tel:${c.telefone}`} className="underline underline-offset-2 hover:no-underline">
                {c.telefone}
              </a>
            )}
            <Link
              href={`/painel/${c.estudioSlug}/leads/${c.id}`}
              className="underline underline-offset-2 hover:no-underline"
            >
              Ver lead
            </Link>
            <button
              type="button"
              onClick={() => marcarContactado(c)}
              disabled={aMarcar}
              className="rounded-full bg-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/30 disabled:opacity-60"
            >
              Marcar como contactada
            </button>
          </div>
        )
      })}
    </div>
  )
}
