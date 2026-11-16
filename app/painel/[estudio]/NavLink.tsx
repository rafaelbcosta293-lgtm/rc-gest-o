'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from '@/components/LinkRapido'
import { usePathname } from 'next/navigation'
import { ChevronDown, BriefcaseBusiness, Home } from 'lucide-react'
import { MODULOS, PALETA } from '@/lib/data/constantes'
import { formaPilula, useModoBarra } from '@/components/BarraAjustavel'

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
// "aviso": número a mostrar junto ao nome (ex.: tarefas em atraso).
// O botão "Início": volta ao menu inicial deste estúdio (não à página
// de escolha do estúdio). Fica sempre à vista — ao lado do logótipo no
// computador, na faixa de cima no telemóvel.
export function NavLinkInicio({ slug, comTexto = false }: { slug: string; comTexto?: boolean }) {
  const href = `/painel/${slug}`
  const ativo = usePathname() === href
  return (
    <Link
      href={href}
      title="Início — menu inicial do estúdio"
      aria-label="Início"
      aria-current={ativo ? 'page' : undefined}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${comTexto ? 'px-3 py-1.5' : 'p-2'} ${
        ativo ? 'bg-brand text-black' : 'border border-border-subtle text-foreground hover:border-border-strong hover:bg-foreground/[.05]'
      }`}
    >
      <Home className="h-[18px] w-[18px]" strokeWidth={2.25} />
      {comTexto && 'Início'}
    </Link>
  )
}

export function NavLinkTopBar({ href, id, aviso = 0 }: { href: string; id: string; aviso?: number }) {
  const { icone: Icone, cor, nome } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  const modo = useModoBarra()
  const soIcone = modo === 'icones'
  return (
    <Link
      href={href}
      title={soIcone ? (aviso > 0 ? `${nome} (${aviso})` : nome) : undefined}
      className={`flex shrink-0 whitespace-nowrap font-medium tracking-tight text-foreground transition-colors ${formaPilula(modo)} ${ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.05]'}`}
      style={{
        background: ativo ? PALETA[cor].bg : undefined,
        color: ativo ? PALETA[cor].tx : undefined,
      }}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
      {!soIcone && nome}
      {aviso > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-black">{aviso}</span>}
    </Link>
  )
}

// Uma pasta com subpastas: a pílula abre a pasta principal e, ao passar
// o rato, mostra as subpastas (Clientes → Treinos, Avaliações,
// Presenças e Pagamentos; Leads → Objetivos) — tal como o submenu "só Fátima/só
// Leiria" da Administração. No telemóvel ficam todas seguidas
// (NavLinkPhone, mais abaixo) — não há "hover" num ecrã tátil.
export function NavLinkComSubpastas({
  slug,
  id,
  subpastas,
  ehAdmin,
  ehGestao,
  avisos = {},
}: {
  slug: string
  // A pasta principal e as que ficam lá dentro (ids dos módulos).
  id: string
  subpastas: string[]
  ehAdmin: boolean
  ehGestao: boolean
  // O que há para tratar em cada módulo (id → número). A pílula mostra a
  // soma; cada subpasta, o seu.
  avisos?: Record<string, number>
}) {
  const pathname = usePathname()
  const clientesHref = `/painel/${slug}/${id}`
  const { icone: Icone, cor, nome } = moduloPorId(id)
  const subModulos = subpastas.map((sub) => moduloPorId(sub))
  const modo = useModoBarra()
  const soIcone = modo === 'icones'

  function podeAceder(m: ReturnType<typeof moduloPorId>) {
    return m.pronto && (!m.restrito || (m.restrito === 'admin' ? ehAdmin : ehGestao))
  }

  // A pílula acende-se tanto na pasta principal como em qualquer uma das
  // subpastas — todas partilham a mesma "casa" na navegação.
  const ativo = estaAtivo(pathname, clientesHref) || subModulos.some((m) => estaAtivo(pathname, `/painel/${slug}/${m.id}`))

  const totalAvisos = Object.values(avisos).reduce((a, b) => a + b, 0)

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
        title={soIcone ? nome : undefined}
        className={`flex shrink-0 whitespace-nowrap font-medium tracking-tight text-foreground transition-colors ${formaPilula(modo)} ${ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.05]'}`}
        style={{
          background: ativo ? PALETA[cor].bg : undefined,
          color: ativo ? PALETA[cor].tx : undefined,
        }}
      >
        <Icone className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
        {!soIcone && nome}
        {totalAvisos > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-black">{totalAvisos}</span>}
        {modo === 'nomes' && <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.5} />}
      </Link>

      {aberto &&
        pos &&
        createPortal(
          <div onMouseEnter={manterAberto} onMouseLeave={agendarFechar} className="fixed z-50" style={{ left: pos.left, top: pos.top }}>
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
                    <m.icone className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} style={{ color: subAtivo ? undefined : PALETA[m.cor].tx }} />
                    {m.nome}
                    {(avisos[m.id] ?? 0) > 0 && (
                      <span className="ml-auto rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-black">{avisos[m.id]}</span>
                    )}
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
          document.body,
        )}
    </div>
  )
}

// A pasta "Instrutores": Escalas, Registo de Horas e Férias vivem na mesma "pasta"
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
  const modo = useModoBarra()
  const soIcone = modo === 'icones'
  const itens = PASTA_HORARIOS.map((p) => ({ ...p, modulo: moduloPorId(p.id), href: `/painel/${slug}/${p.id}` }))
  const disponiveis = itens.filter((i) => !bloqueados[i.id])
  const principal = disponiveis[0] ?? itens[0]
  // Mala de trabalho: lê-se bem em tamanho pequeno e identifica a pasta com a equipa (o
  // despertador das Escalas não dizia "Instrutores").
  const Icone = BriefcaseBusiness
  const { cor } = moduloPorId('horarios')
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
        title={soIcone ? 'Instrutores' : undefined}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={`flex shrink-0 whitespace-nowrap font-medium tracking-tight text-foreground transition-colors ${formaPilula(modo)} ${ativo ? '' : 'border border-border-subtle hover:border-border-strong hover:bg-foreground/[.05]'}`}
        style={{
          background: ativo ? PALETA[cor].bg : undefined,
          color: ativo ? PALETA[cor].tx : undefined,
        }}
      >
        <Icone className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: ativo ? undefined : PALETA[cor].tx }} />
        {!soIcone && 'Instrutores'}
        {modo === 'nomes' && <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.5} />}
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
          document.body,
        )}
    </div>
  )
}

// Módulo ainda não acessível a este papel — mesma pílula visual dos
// outros, mas desativada, e também reage ao modo só-ícone.
export function NavLinkBloqueado({ id, titulo }: { id: string; titulo: string }) {
  const { icone: Icone, nome } = moduloPorId(id)
  const modo = useModoBarra()
  const soIcone = modo === 'icones'
  return (
    <span
      title={titulo}
      className={`flex shrink-0 cursor-not-allowed whitespace-nowrap border border-border-subtle font-medium tracking-tight text-muted opacity-40 ${formaPilula(modo)}`}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={2.5} />
      {!soIcone && nome}
    </span>
  )
}

// Telemóvel (<768px): barra fixa no fundo, ao estilo iOS — ícone +
// legenda pequena, sempre ao alcance do polegar.
export function NavLinkPhone({ href, id, aviso = 0 }: { href: string; id: string; aviso?: number }) {
  const { icone: Icone, cor, nome, curto } = moduloPorId(id)
  const ativo = estaAtivo(usePathname(), href)
  return (
    <Link
      href={href}
      aria-label={nome}
      className="relative flex min-w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5"
      style={{ color: ativo ? PALETA[cor].tx : 'var(--muted)' }}
    >
      <Icone className="h-[22px] w-[22px]" strokeWidth={ativo ? 2.75 : 2.25} />
      {aviso > 0 && <span className="absolute right-1.5 top-0 rounded-full bg-brand px-1.5 text-[10px] font-bold leading-4 text-black">{aviso}</span>}
      <span className={`text-[10px] ${ativo ? 'font-semibold' : 'font-medium'}`}>{curto ?? nome}</span>
    </Link>
  )
}
