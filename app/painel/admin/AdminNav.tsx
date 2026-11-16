'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from '@/components/LinkRapido'
import { usePathname } from 'next/navigation'
import {
  Home,
  CalendarRange,
  CalendarDays,
  Clock,
  ListTodo,
  Activity,
  FileText,
  Wallet,
  Receipt,
  Calculator,
  Package,
  History,
  KeyRound,
  MessageSquare,
  CreditCard,
  ReceiptText,
  Settings,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import PillNavLink, { estaAtivoPill } from '@/components/PillNavLink'
import BarraAjustavel, { formaPilula, useModoBarra } from '@/components/BarraAjustavel'

// Os ícones têm de ser resolvidos aqui dentro (componente cliente),
// nunca recebidos como prop vindos do layout (componente servidor) —
// um componente de ícone é uma função, e uma função não pode atravessar
// a fronteira servidor→cliente como prop, só dados simples podem.
//
// "filtravel" marca as pastas que mostram dados lado a lado dos dois
// estúdios — só essas ganham os atalhos "Fátima"/"Leiria" no menu.
// Clicar no nome da pasta continua a abrir sempre os dois.
type Pasta = { href: string; label: string; icone: LucideIcon; filtravel: boolean }
type Grupo = { id: string; label: string; icone: LucideIcon; pastas: Pasta[] }

// As 13 pastas não cabiam lado a lado num portátil (a barra passava a
// mostrar só ícones, sem nome). Ficam arrumadas em três grupos, cada um
// com o seu menu — a barra tem sempre só quatro botões, com nome.
const GRUPOS: Grupo[] = [
  {
    id: 'atividade',
    label: 'Atividade',
    icone: Activity,
    pastas: [
      { href: '/painel/admin/este-mes', label: 'Este mês', icone: CalendarRange, filtravel: true },
      { href: '/painel/admin/agora', label: 'Agora', icone: Activity, filtravel: true },
      { href: '/painel/admin/relatorio', label: 'Relatório', icone: FileText, filtravel: true },
      { href: '/painel/admin/horas', label: 'Horas da equipa', icone: Clock, filtravel: false },
    ],
  },
  {
    id: 'financas',
    label: 'Finanças',
    icone: Wallet,
    pastas: [
      { href: '/painel/admin/financeiro', label: 'Financeiro', icone: Wallet, filtravel: true },
      { href: '/painel/admin/pagamentos', label: 'Pagamentos', icone: Receipt, filtravel: true },
      { href: '/painel/admin/despesas', label: 'Despesas', icone: ReceiptText, filtravel: true },
      { href: '/painel/admin/faturas', label: 'Faturas', icone: CreditCard, filtravel: true },
      { href: '/painel/admin/simulador', label: 'Simulador', icone: Calculator, filtravel: false },
    ],
  },
  {
    id: 'definicoes',
    label: 'Definições',
    icone: Settings,
    pastas: [
      { href: '/painel/admin/servicos', label: 'Serviços', icone: Package, filtravel: false },
      { href: '/painel/admin/lembretes-sms', label: 'Lembretes SMS', icone: MessageSquare, filtravel: false },
      { href: '/painel/admin/contas', label: 'Contas', icone: KeyRound, filtravel: true },
      { href: '/painel/admin/auditoria', label: 'Auditoria', icone: History, filtravel: false },
    ],
  },
]

const ESTUDIOS = [
  { slug: 'fatima', nome: 'Fátima' },
  { slug: 'leiria', nome: 'Leiria' },
]

const LARGURA_MENU = 290

// Botão de um grupo: abre o menu ao passar o rato (computador) ou ao
// tocar/clicar (tablet), e fica aceso quando a página aberta é uma das
// pastas lá dentro — nesse caso mostra também o nome dessa pasta.
function GrupoPill({ grupo, avisos }: { grupo: Grupo; avisos: Record<string, number> }) {
  const pathname = usePathname()
  const modo = useModoBarra()
  const ativa = grupo.pastas.find((p) => estaAtivoPill(pathname, p.href))
  const totalAvisos = grupo.pastas.reduce((soma, p) => soma + (avisos[p.href] ?? 0), 0)

  // O menu é desenhado fora da barra, num portal para o body: a barra
  // corta o que sai dela (overflow), por isso um menu lá dentro ficava
  // escondido por baixo.
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function abrir() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
    const rect = botaoRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ left: Math.max(8, Math.min(rect.left, window.innerWidth - LARGURA_MENU - 8)), top: rect.bottom + 6 })
    setAberto(true)
  }
  function agendarFechar() {
    fecharRef.current = setTimeout(() => setAberto(false), 180)
  }
  function manterAberto() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
  }

  // Aberto por toque não há "sair com o rato": fecha ao tocar fora ou
  // com a tecla Escape.
  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      const alvo = e.target as Node
      if (!menuRef.current?.contains(alvo) && !botaoRef.current?.contains(alvo)) setAberto(false)
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const Icone = grupo.icone
  const nomeComAviso = totalAvisos > 0 ? `${grupo.label} (${totalAvisos})` : grupo.label

  return (
    <div className="shrink-0" onMouseEnter={abrir} onMouseLeave={agendarFechar}>
      <button
        ref={botaoRef}
        type="button"
        onClick={abrir}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={modo === 'icones' ? nomeComAviso : undefined}
        className={`flex shrink-0 whitespace-nowrap font-medium tracking-tight transition-colors hover:bg-brand/[.08] ${formaPilula(modo)} ${
          ativa ? 'bg-brand/20 text-brand' : 'text-foreground'
        }`}
      >
        <Icone className={modo === 'empilhado' ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={ativa ? 2.5 : 2.25} />
        {modo !== 'icones' && (
          <span>
            {nomeComAviso}
            {ativa && modo === 'nomes' && <span className="font-normal opacity-80"> · {ativa.label}</span>}
          </span>
        )}
        {modo === 'nomes' && <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.5} />}
      </button>

      {aberto &&
        pos &&
        createPortal(
          // "dark": o portal fica fora da Administração (no body), por
          // isso tem de trazer consigo o tema escuro da área.
          <div
            ref={menuRef}
            onMouseEnter={manterAberto}
            onMouseLeave={agendarFechar}
            className="dark fixed z-50"
            style={{ left: pos.left, top: pos.top, width: LARGURA_MENU }}
          >
            <div role="menu" className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface p-1.5 text-foreground shadow-pop">
              {grupo.pastas.map((p) => {
                const IconePasta = p.icone
                const ativo = estaAtivoPill(pathname, p.href)
                const aviso = avisos[p.href] ?? 0
                return (
                  <div key={p.href} className="flex items-center gap-1">
                    <Link
                      href={p.href}
                      role="menuitem"
                      onClick={() => setAberto(false)}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        ativo ? 'bg-brand/20 text-brand' : 'text-foreground hover:bg-brand/[.08]'
                      }`}
                    >
                      <IconePasta className="h-4 w-4 shrink-0" strokeWidth={ativo ? 2.5 : 2.25} />
                      <span className="truncate">{p.label}</span>
                      {aviso > 0 && (
                        <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-black">{aviso}</span>
                      )}
                    </Link>
                    {p.filtravel &&
                      ESTUDIOS.map((e) => (
                        <Link
                          key={e.slug}
                          href={`${p.href}?estudio=${e.slug}`}
                          onClick={() => setAberto(false)}
                          title={`${p.label} — só ${e.nome}`}
                          className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
                        >
                          {e.nome}
                        </Link>
                      ))}
                  </div>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

// pendentesFaturas: pedidos de fatura por validar; despesasAPagar:
// despesas por pagar com aviso ativo. Aparecem como número no grupo
// ("Finanças (5)") e, lá dentro, na pasta a que dizem respeito.
// lembretesPorTratar: lembretes do calendário em atraso ou para hoje.
// horasPorAprovar: meses de horas submetidos pelos instrutores, à espera.
// tarefasUrgentes: tarefas com o prazo passado ou para hoje.
export default function AdminNav({
  pendentesFaturas = 0,
  despesasAPagar = 0,
  lembretesPorTratar = 0,
  horasPorAprovar = 0,
  tarefasUrgentes = 0,
}: {
  pendentesFaturas?: number
  despesasAPagar?: number
  lembretesPorTratar?: number
  horasPorAprovar?: number
  tarefasUrgentes?: number
}) {
  const avisos: Record<string, number> = {
    '/painel/admin/faturas': pendentesFaturas,
    '/painel/admin/despesas': despesasAPagar,
    '/painel/admin/horas': horasPorAprovar,
  }

  return (
    <BarraAjustavel className="min-w-0 flex-1" navClassName="flex items-center gap-2">
      <PillNavLink href="/painel/admin" label="Resumo" icone={Home} exato />
      <PillNavLink href="/painel/admin/calendario" label="Calendário" icone={CalendarDays} aviso={lembretesPorTratar} />
      <PillNavLink href="/painel/admin/tarefas" label="Tarefas" icone={ListTodo} aviso={tarefasUrgentes} />
      {GRUPOS.map((g) => (
        <GrupoPill key={g.id} grupo={g} avisos={avisos} />
      ))}
    </BarraAjustavel>
  )
}
