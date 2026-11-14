import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, Search } from 'lucide-react'
import { MODULOS } from '@/lib/data/constantes'
import { createClient } from '@/lib/supabase/server'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { ehContaFixa, podeAcederEstudio, podeAcederEstudioAprovado } from '@/lib/data/acessos'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { obterEstadosBanner } from '@/lib/data/smsGateway'
import { listarContactosAgendados } from '@/lib/data/contactosAgendados'
import BarraSmsGatewayOffline from '@/components/BarraSmsGatewayOffline'
import AlertaContactosAgendados from '@/components/AlertaContactosAgendados'
import BarraAjustavel from '@/components/BarraAjustavel'
import AvisosFerias from './ferias/AvisosFerias'
import { NavLinkTopBar, NavLinkClientesComSubmenu, NavLinkPastaHorarios, NavLinkPhone, NavLinkBloqueado } from './NavLink'

// Na barra do computador/tablet, Treinos e Avaliações deixam de ter
// pílula própria — passam a aparecer só dentro do submenu de Clientes
// (ver NavLinkClientesComSubmenu). No telemóvel continuam como estavam.
const SUBPASTAS_CLIENTES = new Set(['treinos', 'avaliacoes'])

// Registo de Horas e Férias ficam dentro da pasta "Horários" na barra
// do computador/tablet (ver NavLinkPastaHorarios).
const SUBPASTAS_HORARIOS = new Set(['assiduidade', 'ferias'])

export default async function EstudioLayout({ children, params }: LayoutProps<'/painel/[estudio]'>) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const [sessao, estadosBanner, contactosAgendados, estudio] = await Promise.all([
    getSessaoAtual(),
    obterEstadosBanner(supabase),
    listarContactosAgendados(supabase),
    getEstudioPorSlug(supabase, slug),
  ])

  // Entra-se num estúdio de duas formas: a conta partilhada fixa desse
  // estúdio (lib/data/acessos.ts), ou uma conta pessoal registada em
  // /registo e já aprovada pelo dono em Equipa ("Dar acesso" — grava em
  // perfis_estudios). O "papel" da ficha em "perfis" nunca decide isto
  // por si só, só o que a conta pode FAZER depois de já ter entrado.
  const aprovado = estudio ? await podeAcederEstudioAprovado(supabase, sessao.userId, estudio.id) : false
  if (!podeAcederEstudio(sessao.email, slug) && !aprovado) {
    redirect('/painel?erro=sem-acesso')
  }

  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)
  const contaIndividual = !ehContaFixa(sessao.email)

  const podeAceder = (m: (typeof MODULOS)[number]) => {
    if (!m.pronto) return false
    // Conta pessoal: só os módulos que a Administração lhe deu
    // (Administração → Contas); por omissão Treinos, Agenda, Horários,
    // Registo de Horas e Férias.
    if (contaIndividual) return sessao.modulos.includes(m.id)
    return !m.restrito || (m.restrito === 'admin' ? ehAdmin : ehGestao)
  }
  const tituloBloqueado = (m: (typeof MODULOS)[number]) => {
    if (!m.pronto) return `${m.nome} — brevemente`
    if (contaIndividual) return `${m.nome} — sem acesso para esta conta`
    return `${m.nome} — só para ${m.restrito === 'admin' ? 'administradores' : 'gestão'}`
  }
  // Treinos (e Avaliações, que fica bloqueado) ganham pílula própria em
  // vez de ficarem escondidos dentro do submenu de Clientes — senão uma
  // conta individual, sem acesso a Clientes, nem via teria como chegar
  // a Treinos no computador/tablet.
  const subpastasClientesParaFiltrar = contaIndividual ? new Set<string>() : SUBPASTAS_CLIENTES

  return (
    <div className="flex min-h-full flex-col">
      {/* A faixa e as barras de topo partilham um único wrapper
          "sticky" — cada uma sticky à parte faria a barra tapar a
          faixa ao fazer scroll (duas sticky top-0 ocupam o mesmo
          lugar; só uma, com ambas dentro, as mantém empilhadas). */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline estadosIniciais={estadosBanner} apenasEstudio={slug} />
        <AlertaContactosAgendados contactosIniciais={contactosAgendados} apenasEstudio={slug} />
        {estudio && (
          <AvisosFerias
            supabase={supabase}
            slug={slug}
            estudioId={estudio.id}
            userId={sessao.userId}
            ehInstrutor={contaIndividual && !!sessao.userId}
            ehGestao={ehGestao}
          />
        )}

        {/* Telemóvel (<768px): mini-barra no topo, só para trocar de
            estúdio — os módulos ficam na barra de separadores do fundo,
            sempre ao alcance do polegar, ao estilo iOS. */}
        <div className="shadow-deep flex items-center justify-end gap-1 border-b border-border-subtle bg-background/90 px-4 py-2 backdrop-blur-xl md:hidden">
          {!contaIndividual && (
            <Link
              href={`/painel/${slug}/pesquisa`}
              title="Pesquisar"
              aria-label="Pesquisar"
              className="flex items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </Link>
          )}
          <Link
            href="/painel"
            title="Mudar estúdio"
            aria-label="Mudar estúdio"
            className="flex items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
          >
            <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
        </div>

        {/* Computador/tablet (≥768px): barra superior fixa, com o
            logótipo, os módulos (pílulas, numa linha com scroll
            horizontal se não couberem) e as ações à direita. Só esta
            faixa fica com o tema escuro ("dark tema-proprio") — o resto
            da página continua no modelo claro, ao contrário da
            Administração, onde o escuro é a área toda. */}
        <header className="dark tema-proprio shadow-deep hidden items-center gap-3 border-b border-border-subtle bg-surface/80 px-4 py-2.5 backdrop-blur-xl md:flex">
          <Link href="/painel" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-8 w-auto" priority />
          </Link>
          <BarraAjustavel className="min-w-0 flex-1" navClassName="flex items-center gap-2">
            {MODULOS.filter((m) => !subpastasClientesParaFiltrar.has(m.id) && !SUBPASTAS_HORARIOS.has(m.id)).map((m) =>
              m.id === 'horarios' ? (
                <NavLinkPastaHorarios
                  key={m.id}
                  slug={slug}
                  bloqueados={Object.fromEntries(
                    MODULOS.filter((x) => (x.id === 'horarios' || SUBPASTAS_HORARIOS.has(x.id)) && !podeAceder(x)).map((x) => [
                      x.id,
                      tituloBloqueado(x),
                    ])
                  )}
                />
              ) : m.id === 'clientes' && !contaIndividual ? (
                <NavLinkClientesComSubmenu key={m.id} slug={slug} ehAdmin={ehAdmin} ehGestao={ehGestao} />
              ) : podeAceder(m) ? (
                <NavLinkTopBar key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} />
              ) : (
                <NavLinkBloqueado key={m.id} id={m.id} titulo={tituloBloqueado(m)} />
              )
            )}
          </BarraAjustavel>
          {!contaIndividual && (
            <Link
              href={`/painel/${slug}/pesquisa`}
              title="Pesquisar"
              aria-label="Pesquisar"
              className="flex shrink-0 items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </Link>
          )}
          <Link
            href="/painel"
            title="Mudar estúdio"
            aria-label="Mudar estúdio"
            className="flex shrink-0 items-center justify-center rounded-full p-2 text-muted hover:bg-brand/[.07] hover:text-foreground"
          >
            <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
        </header>
      </div>

      {/* O conteúdo ganha espaço extra no fundo, no telemóvel, para a
          barra de separadores fixa não tapar o fim da página. */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

      {/* Telemóvel: barra de separadores fixa no fundo, ao estilo iOS. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around overflow-x-auto border-t border-border-subtle bg-background/90 px-1 py-1 shadow-[0_-2px_2px_rgba(24,24,27,0.05),0_-16px_32px_-8px_rgba(24,24,27,0.16)] backdrop-blur-xl md:hidden">
        {MODULOS.map((m) =>
          podeAceder(m) ? (
            <NavLinkPhone key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} />
          ) : (
            <span
              key={m.id}
              title={tituloBloqueado(m)}
              className="flex min-w-14 shrink-0 cursor-not-allowed flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-muted opacity-40"
            >
              <m.icone className="h-[22px] w-[22px]" strokeWidth={2} />
              <span className="text-[10px] font-medium">{m.curto ?? m.nome}</span>
            </span>
          )
        )}
      </nav>
    </div>
  )
}
