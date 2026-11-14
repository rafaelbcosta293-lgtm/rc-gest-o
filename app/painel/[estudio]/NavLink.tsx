'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { MODULOS, PALETA } from '@/lib/data/constantes'
import { useModoIcone } from '@/components/BarraAjustavel'

// Destaca o módulo atual no menu — sem isto, a navegação não dava
// nenhuma pista de "estás aqui".
function estaAtivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Recebe só o id (uma string) e procura o ícone/cor aqui dentro — um
// componente de ícone (função) não pode atravessar a fronteira
// servidor→cliente como prop, só dados simples podem.
function moduloPorId(id: string) {
  return MODULOS.find((m) => m.id === id)!
}

// Computador/tablet (≥768px): ícone e nome lado a lado, numa pílula —
// a largura toda é gerida pelo BarraAjustavel (espalha quando há
// espaço, encolhe sem esconder nada quando não há).
export function NavLinkTopBar({ href, id }: { href: string; id: string }) {
  const { icone: Icone, cor, nome } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  const soIcone = useModoIcone()
  return (
    <Link
      href={href}
      title={soIcone ? nome : undefined}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-medium tracking-tight text-foreground transition-colors ${
        soIcone ? 'p-2' : 'px-3 py-1.5'
      } ${ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.05]'}`}
      style={{
        background: ativo ? PALETA[cor].bg : undefined,
        color: ativo ? PALETA[cor].tx : undefined,
      }}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
      {!soIcone && nome}
    </Link>
  )
}

// Treinos e Avaliações deixam de ter pílula própria na barra do
// computador/tablet — passam a aparecer como subpastas de Clientes, só
// ao passar o rato por cima (tal como o submenu "só Fátima/só Leiria"
// já existente na Administração). No telemóvel ficam tal como estavam
// (NavLinkPhone, mais abaixo) — não há "hover" num ecrã tátil.
const SUBPASTAS_CLIENTES = ['treinos', 'avaliacoes']

export function NavLinkClientesComSubmenu({
  slug,
  ehAdmin,
  ehGestao,
}: {
  slug: string
  ehAdmin: boolean
  ehGestao: boolean
}) {
  const pathname = usePathname()
  const clientesHref = `/painel/${slug}/clientes`
  const { icone: Icone, cor } = moduloPorId('clientes')
  const subModulos = SUBPASTAS_CLIENTES.map((id) => moduloPorId(id))
  const soIcone = useModoIcone()

  function podeAceder(m: ReturnType<typeof moduloPorId>) {
    return m.pronto && (!m.restrito || (m.restrito === 'admin' ? ehAdmin : ehGestao))
  }

  // A pílula "Clientes" acende-se tanto em Clientes como em qualquer uma
  // das subpastas — todas partilham a mesma "casa" na navegação.
  const ativo =
    estaAtivo(pathname, clientesHref) ||
    subModulos.some((m) => estaAtivo(pathname, `/painel/${slug}/${m.id}`))

  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pillRef = useRef<HTMLAnchorElement>(null)

  function abrir() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
    const rect = pillRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ left: rect.left, top: rect.bottom + 4 })
    setAberto(true)
  }

  function agendarFechar() {
    fecharRef.current = setTimeout(() => setAberto(false), 150)
  }

  function manterAberto() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
  }

  return (
    <div className="shrink-0" onMouseEnter={abrir} onMouseLeave={agendarFechar}>
      <Link
        ref={pillRef}
        href={clientesHref}
        title={soIcone ? 'Clientes' : undefined}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-medium tracking-tight text-foreground transition-colors ${
          soIcone ? 'p-2' : 'px-3 py-1.5'
        } ${ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.05]'}`}
        style={{
          background: ativo ? PALETA[cor].bg : undefined,
          color: ativo ? PALETA[cor].tx : undefined,
        }}
      >
        <Icone className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
        {!soIcone && 'Clientes'}
        {!soIcone && <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.5} />}
      </Link>

      {aberto &&
        pos &&
        createPortal(
          <div
            onMouseEnter={manterAberto}
            onMouseLeave={agendarFechar}
            className="fixed z-50"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface p-1 shadow-pop">
              {subModulos.map((m) => {
                const href = `/painel/${slug}/${m.id}`
                const subAtivo = estaAtivo(pathname, href)
                const acessivel = podeAceder(m)
                return acessivel ? (
                  <Link
                    key={m.id}
                    href={href}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-brand/[.08]"
                    style={{
                      background: subAtivo ? PALETA[m.cor].bg : undefined,
                      color: subAtivo ? PALETA[m.cor].tx : undefined,
                    }}
                  >
                    <m.icone
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={2.5}
                      style={{ color: subAtivo ? undefined : PALETA[m.cor].tx }}
                    />
                    {m.nome}
                  </Link>
                ) : (
                  <span
                    key={m.id}
                    title={`${m.nome} — só para ${m.restrito === 'admin' ? 'administradores' : 'gestão'}`}
                    className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-muted opacity-50"
                  >
                    <m.icone className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                    {m.nome}
                  </span>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

// A pasta "Recursos Humanos": Escalas, Registo de Horas e Férias vivem na mesma "pasta"
// da barra do computador/tablet: uma pílula só, que ao passar o rato
// mostra as três. No telemóvel continuam separadas (não há "hover").
const PASTA_HORARIOS: { id: string; rotulo: string }[] = [
  { id: 'horarios', rotulo: 'Escalas' },
  { id: 'assiduidade', rotulo: 'Registo de Horas' },
  { id: 'ferias', rotulo: 'Férias' },
]

export function NavLinkPastaHorarios({
  slug,
  bloqueados,
}: {
  slug: string
  // id do módulo → motivo por que não está disponível para esta conta
  bloqueados: Record<string, string>
}) {
  const pathname = usePathname()
  const soIcone = useModoIcone()
  const itens = PASTA_HORARIOS.map((p) => ({ ...p, modulo: moduloPorId(p.id), href: `/painel/${slug}/${p.id}` }))
  const disponiveis = itens.filter((i) => !bloqueados[i.id])
  const principal = disponiveis[0] ?? itens[0]
  const { icone: Icone, cor } = moduloPorId('horarios')
  const ativo = itens.some((i) => estaAtivo(pathname, i.href))

  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pillRef = useRef<HTMLAnchorElement>(null)

  function abrir() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
    const rect = pillRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ left: rect.left, top: rect.bottom + 4 })
    setAberto(true)
  }
  function agendarFechar() {
    fecharRef.current = setTimeout(() => setAberto(false), 150)
  }
  function manterAberto() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
  }

  return (
    <div className="shrink-0" onMouseEnter={abrir} onMouseLeave={agendarFechar} onFocus={abrir} onBlur={agendarFechar}>
      <Link
        ref={pillRef}
        href={principal.href}
        title={soIcone ? 'Recursos Humanos' : undefined}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-medium tracking-tight text-foreground transition-colors ${
          soIcone ? 'p-2' : 'px-3 py-1.5'
        } ${ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.05]'}`}
        style={{
          background: ativo ? PALETA[cor].bg : undefined,
          color: ativo ? PALETA[cor].tx : undefined,
        }}
      >
        <Icone className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
        {!soIcone && 'Recursos Humanos'}
        {!soIcone && <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.5} />}
      </Link>

      {aberto &&
        pos &&
        createPortal(
          <div onMouseEnter={manterAberto} onMouseLeave={agendarFechar} className="fixed z-50" style={{ left: pos.left, top: pos.top }}>
            <div role="menu" className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface p-1 shadow-pop">
              {itens.map(({ id, rotulo, modulo: m, href }) => {
                const subAtivo = estaAtivo(pathname, href)
                const motivo = bloqueados[id]
                return motivo ? (
                  <span
                    key={id}
                    title={motivo}
                    className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-muted opacity-50"
                  >
                    <m.icone className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                    {rotulo}
                  </span>
                ) : (
                  <Link
                    key={id}
                    role="menuitem"
                    href={href}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-brand/[.08]"
                    style={{
                      background: subAtivo ? PALETA[m.cor].bg : undefined,
                      color: subAtivo ? PALETA[m.cor].tx : undefined,
                    }}
                  >
                    <m.icone className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} style={{ color: subAtivo ? undefined : PALETA[m.cor].tx }} />
                    {rotulo}
                  </Link>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

// Módulo ainda não acessível a este papel — mesma pílula visual dos
// outros, mas desativada, e também reage ao modo só-ícone.
export function NavLinkBloqueado({ id, titulo }: { id: string; titulo: string }) {
  const { icone: Icone, nome } = moduloPorId(id)
  const soIcone = useModoIcone()
  return (
    <span
      title={titulo}
      className={`flex shrink-0 cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-full border border-border-subtle text-[13px] font-medium tracking-tight text-muted opacity-40 ${
        soIcone ? 'p-2' : 'px-3 py-1.5'
      }`}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={2.5} />
      {!soIcone && nome}
    </span>
  )
}

// Telemóvel (<768px): barra fixa no fundo, ao estilo iOS — ícone +
// legenda pequena, sempre ao alcance do polegar.
export function NavLinkPhone({ href, id }: { href: string; id: string }) {
  const { icone: Icone, cor, nome, curto } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      aria-label={nome}
      className="flex min-w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5"
      style={{ color: ativo ? PALETA[cor].tx : 'var(--muted)' }}
    >
      <Icone className="h-[22px] w-[22px]" strokeWidth={ativo ? 2.75 : 2.25} />
      <span className={`text-[10px] ${ativo ? 'font-semibold' : 'font-medium'}`}>{curto ?? nome}</span>
    </Link>
  )
}
