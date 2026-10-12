import Link from 'next/link'

const ITENS = [
  { href: '/cliente/eventos', label: 'Eventos', descricao: 'Novidades e avisos do ginásio', icone: '📣' },
  { href: '/cliente/regulamento', label: 'Regulamento interno', descricao: 'As regras do ginásio', icone: '📋' },
]

export default function MaisClientePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Mais</h1>

      <div className="flex flex-col gap-2">
        {ITENS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4 transition-colors hover:border-black/20 dark:border-white/10 dark:bg-zinc-950"
          >
            <span className="text-xl" aria-hidden="true">
              {item.icone}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-black dark:text-zinc-50">
                {item.label}
              </span>
              <span className="block text-xs text-zinc-500">{item.descricao}</span>
            </span>
            <span className="text-sm text-zinc-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
