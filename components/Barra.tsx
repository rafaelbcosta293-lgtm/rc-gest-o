import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from '@/components/LinkRapido'

// A barra de ferramentas de um ecrã: todos os comandos (vistas, andar
// no tempo, filtros, pesquisa, criar) numa só faixa, com o mesmo
// formato. As classes ("barra", "barra-item"…) estão em app/globals.css
// — quem precisar de um botão ou campo próprio dentro da barra usa-as
// diretamente.
export function Barra({ children, className = '', rotulo }: { children: ReactNode; className?: string; rotulo?: string }) {
  return (
    <div role="toolbar" aria-label={rotulo} className={`barra ${className}`}>
      {children}
    </div>
  )
}

// Risco fino entre grupos de comandos.
export function BarraSeparador({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`barra-sep ${className}`} />
}

// Empurra o que vem a seguir para a ponta direita da barra.
export function BarraEspaco({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`min-w-0 flex-1 ${className}`} />
}

// Andar no tempo: ‹ período › e, se fizer sentido, "Hoje" (que só se
// destaca quando se está a ver outro período).
export function BarraPeriodo({
  anterior,
  seguinte,
  titulo,
  hoje,
  noPeriodoDeHoje = false,
  rotuloHoje = 'Hoje',
  className = '',
}: {
  // Sem "anterior" ou "seguinte" (não há mais para mostrar), a seta fica apagada.
  anterior?: string | null
  seguinte?: string | null
  titulo: ReactNode
  hoje?: string
  noPeriodoDeHoje?: boolean
  rotuloHoje?: string
  className?: string
}) {
  return (
    <div className={`flex min-w-0 items-center gap-0.5 ${className}`}>
      {anterior ? (
        <Link href={anterior} scroll={false} aria-label="Anterior" className="barra-item barra-icone">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-hidden className="barra-item barra-icone pointer-events-none opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      <span className="barra-rotulo min-w-0 truncate text-center max-sm:flex-1">{titulo}</span>
      {seguinte ? (
        <Link href={seguinte} scroll={false} aria-label="Seguinte" className="barra-item barra-icone">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-hidden className="barra-item barra-icone pointer-events-none opacity-30">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
      {hoje && (
        <Link
          href={hoje}
          scroll={false}
          aria-current={noPeriodoDeHoje ? 'date' : undefined}
          title={noPeriodoDeHoje ? 'Já estás no período de hoje' : 'Voltar a hoje'}
          className={`barra-item ${noPeriodoDeHoje ? '' : 'realce'}`}
        >
          {rotuloHoje}
        </Link>
      )}
    </div>
  )
}

// Escolha entre vistas ou filtros (uma opção de cada vez), como ligações.
export function BarraOpcoes({
  opcoes,
  etiqueta,
  className = '',
}: {
  opcoes: { href: string; rotulo: ReactNode; ativo: boolean; titulo?: string }[]
  // Nome do grupo, à esquerda ("Ordenar", "Estúdio").
  etiqueta?: string
  className?: string
}) {
  return (
    <div className={`flex min-w-0 items-center gap-0.5 ${className}`}>
      {etiqueta && <span className="barra-etiqueta">{etiqueta}</span>}
      {opcoes.map((o) => (
        <Link key={o.href} href={o.href} scroll={false} title={o.titulo} aria-current={o.ativo ? 'page' : undefined} className="barra-item">
          {o.rotulo}
        </Link>
      ))}
    </div>
  )
}
