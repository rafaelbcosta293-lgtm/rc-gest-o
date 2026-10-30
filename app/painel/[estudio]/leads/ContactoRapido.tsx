'use client'

import { useState } from 'react'
import { Phone, MessageCircle } from 'lucide-react'
import { TELEFONE_ESTUDIO } from '@/lib/data/constantes'

function numeroWhatsapp(telefone: string) {
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 9 && digitos.startsWith('9')) return `351${digitos}`
  return digitos
}

export default function ContactoRapido({
  nome,
  telefone,
  estudioSlug,
}: {
  nome: string
  telefone: string | null
  estudioSlug: string
}) {
  const [mensagem, setMensagem] = useState(
    `Olá ${nome.split(' ')[0]}! Aqui é da RC Private Fitness Studio. Podemos falar?`
  )

  if (!telefone) return null

  const linkWhatsapp = `https://wa.me/${numeroWhatsapp(telefone)}?text=${encodeURIComponent(mensagem)}`
  const telefoneEstudio = TELEFONE_ESTUDIO[estudioSlug]

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`tel:${telefone.replace(/\s/g, '')}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-foreground/[.06]"
        >
          <Phone className="h-4 w-4" /> Ligar
        </a>

        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-[#25D366] px-4 py-2 text-sm font-medium text-[#1C8A4B] transition-colors hover:bg-[#25D366]/10">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </summary>
          <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border-subtle p-3">
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={2}
              className="rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30"
            />
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1C8A4B]"
            >
              Abrir conversa
            </a>
          </div>
        </details>
      </div>

      {telefoneEstudio && (
        <p className="text-xs text-muted">
          Para ligar a partir do telemóvel do estúdio: <strong>{telefoneEstudio}</strong>
        </p>
      )}
    </div>
  )
}
