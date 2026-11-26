'use client'

import { useEffect, useState, useTransition } from 'react'
import { useVerificacaoPeriodica } from '@/components/useVerificacaoPeriodica'
import Link from '@/components/LinkRapido'
import { PhoneCall } from 'lucide-react'
import { marcarContactoFeito } from '@/app/painel/[estudio]/leads/actions'
import { avaliarContactoAgendado } from '@/lib/data/contactosAgendados'

// Contacto que a própria lead pediu a uma hora certa (ex.: "liga-me às
// 15h", guardado em LeadForm.tsx). Fica visível aqui a partir de
// MINUTOS_ANTECEDENCIA_CONTACTO antes da hora marcada (ver
// avaliarContactoAgendado); a partir da própria hora a faixa fica
// vermelha e mantém-se enquanto não for marcado como contactado — para
// nunca se perder este tipo de compromisso. Sem som: o aviso é só visual.
//
// A lista vem com a página e a hora de mostrar cada aviso é decidida
// aqui, no browser (relógio abaixo) — ir ao servidor serve só para
// apanhar contactos marcados ou alterados entretanto, por isso basta de
// 2 em 2 minutos e só com o separador à vista (ver
// useVerificacaoPeriodica: de 20 em 20 segundos, em todos os ecrãs
// abertos, eram milhares de pedidos por dia ao servidor).
const INTERVALO_VERIFICACAO_MS = 120_000
const INTERVALO_RELOGIO_MS = 5_000

type ContactoAgendado = {
  id: string
  nome: string
  telefone: string | null
  estudioSlug: string
  estudioNome: string
  data: string
  hora: string
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
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), INTERVALO_RELOGIO_MS)
    return () => clearInterval(relogio)
  }, [])

  useVerificacaoPeriodica(async () => {
    try {
      const resposta = await fetch('/api/leads/contactos-agendados', { cache: 'no-store' })
      if (!resposta.ok) return
      setContactos(await resposta.json())
    } catch {
      // falha a verificar não é motivo para esconder a faixa a meio
    }
  }, INTERVALO_VERIFICACAO_MS)

  const visiveis = contactos
    .filter((c) => !concluidos.has(c.id))
    .filter((c) => !apenasEstudio || c.estudioSlug === apenasEstudio)
    .map((c) => ({ ...c, ...avaliarContactoAgendado(c, agora) }))
    .filter((c) => c.estado !== 'oculto')
    .sort((a, b) => a.minutosRestantes - b.minutosRestantes)

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
