import type { LucideIcon } from 'lucide-react'

// Peças visuais partilhadas por todos os ecrãs (um só sistema: títulos,
// secções, cartões, etiquetas e blocos de data).

export function TituloPagina({ titulo, subtitulo }: { titulo: string; subtitulo?: React.ReactNode }) {
  return (
    <header className="pt-3 pb-1">
      <h1 className="text-[1.7rem] leading-tight font-bold tracking-tight">{titulo}</h1>
      {subtitulo && <p className="mt-1 text-[0.95rem] leading-snug text-muted">{subtitulo}</p>}
    </header>
  )
}

export function Seccao({ titulo, acao, children, id }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-7 scroll-mt-32">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[0.8rem] font-semibold tracking-[0.08em] text-muted uppercase">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  )
}

export function Cartao({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface shadow-card ring-1 ring-border ${className}`}>{children}</div>
}

const TONS = {
  neutro: 'bg-soft text-zinc-700',
  ok: 'bg-emerald-100 text-emerald-800',
  aviso: 'bg-amber-100 text-amber-900',
  erro: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  espera: 'bg-violet-100 text-violet-800',
} as const
export type Tom = keyof typeof TONS

export function Etiqueta({ tom = 'neutro', children }: { tom?: Tom; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONS[tom]}`}>{children}</span>
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Quadrado com o dia da semana e o dia do mês ("seg" / "23").
export function BlocoData({ dia, destaque = false }: { dia: string; destaque?: boolean }) {
  const d = new Date(`${dia}T12:00:00Z`)
  return (
    <div
      className={`flex h-[3.25rem] w-12 shrink-0 flex-col items-center justify-center rounded-xl ${destaque ? 'bg-zinc-900 text-white' : 'bg-soft text-foreground'}`}
      aria-hidden
    >
      <span className={`text-[0.65rem] leading-none font-semibold tracking-wide uppercase ${destaque ? 'text-brand' : 'text-muted'}`}>{DIAS_CURTOS[d.getUTCDay()]}</span>
      <span className="mt-1 text-lg leading-none font-bold tabular-nums">{d.getUTCDate()}</span>
    </div>
  )
}

export function Vazio({ Icone, titulo, children }: { Icone: LucideIcon; titulo: string; children?: React.ReactNode }) {
  return (
    <Cartao className="flex flex-col items-center px-6 py-9 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft text-muted">
        <Icone className="h-6 w-6" strokeWidth={1.8} />
      </span>
      <p className="mt-3 font-semibold">{titulo}</p>
      {children && <div className="mt-1 text-sm leading-snug text-muted">{children}</div>}
    </Cartao>
  )
}
