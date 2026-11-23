import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from '@/components/LinkRapido'
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
import AvisosHorario from '@/components/AvisosHorario'
import AvisoAcessos from '@/components/AvisoAcessos'
import AvisoCheckinSemMensalidade from '@/components/AvisoCheckinSemMensalidade'
import AvisoPedidosApp from '@/components/AvisoPedidosApp'
import { contarTarefasUrgentes } from '@/lib/data/tarefas'
import { contarAlertasAbertos } from '@/lib/data/alertasAbertos'
import { contarLeadsParaHoje, contarPagamentosEmAtraso } from '@/lib/data/contagensMenu'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { NavLinkTopBar, NavLinkComSubpastas, NavLinkPastaHorarios, NavLinkBloqueado, NavLinkInicio, NavTelemovel } from './NavLink'

// Na barra do computador/tablet, Treinos, Avaliações, Presenças e
// Pagamentos não têm pílula própria — aparecem dentro de Clientes; e Objetivos dentro de
// Leads (ver NavLinkComSubpastas). No telemóvel aparecem todas seguidas.
const SUBPASTAS: Record<string, string[]> = {
  clientes: ['treinos', 'avaliacoes', 'presencas', 'pagamentos'],
  leads: ['objetivos'],
  aulas: ['acompanhado', 'pilates'],
}
const TODAS_AS_SUBPASTAS = new Set(Object.values(SUBPASTAS).flat())

// Registo de Horas e Férias ficam dentro da pasta "Instrutores" na barra
// do computador/tablet (ver NavLinkPastaHorarios).
const SUBPASTAS_HORARIOS = new Set(['assiduidade', 'ferias'])

// A cor de cada estúdio — na etiqueta com o nome e no fio por baixo da
// barra de cima — para se perceber num relance onde se está (quem anda
// entre os dois, como a Coordenação, não tinha como distinguir).
// (O fio vai em "style": a cor das bordas é fixada pelo tema, por cima
// das classes.)
const COR_ESTUDIO: Record<string, { etiqueta: string; fio: string }> = {
  fatima: { etiqueta: 'bg-brand text-black', fio: 'var(--brand)' },
  leiria: { etiqueta: 'bg-blue-600 text-white', fio: '#2563eb' },
}
const COR_OUTRO_ESTUDIO = { etiqueta: 'bg-zinc-600 text-white', fio: '#71717a' }

// O nome do estúdio no separador do browser ("Fátima · RC Gestão"), para
// se distinguirem dois separadores abertos lado a lado.
export async function generateMetadata({ params }: LayoutProps<'/painel/[estudio]'>): Promise<Metadata> {
  const { estudio: slug } = await params
  const estudio = await getEstudioPorSlug(await createClient(), slug)
  return estudio ? { title: `${estudio.nome} · RC Gestão` } : {}
}

function EtiquetaEstudio({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span
      title={`Estás no estúdio de ${nome}`}
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-extrabold tracking-wide uppercase ${cor}`}
    >
      {nome}
    </span>
  )
}

export default async function EstudioLayout({ children, params }: LayoutProps<'/painel/[estudio]'>) {
  const { estudio: slug } = await params

  const supabase = await createClient()
  const [sessao, estadosBanner, contactosAgendados, estudio, tarefasUrgentes, alertasAbertos, leadsParaHoje, pagamentosEmAtraso] = await Promise.all([
    getSessaoAtual(),
    obterEstadosBanner(supabase),
    listarContactosAgendados(supabase),
    getEstudioPorSlug(supabase, slug),
    // Tarefas com o prazo passado ou para hoje — o número no menu.
    // (só as deste estúdio e as da empresa toda).
    getEstudioPorSlug(supabase, slug).then((e) => contarTarefasUrgentes(supabase, hojeEmLisboa(), e?.id)),
    // Alertas por resolver deste estúdio — o número no menu.
    Promise.all([getSessaoAtual(), getEstudioPorSlug(supabase, slug)]).then(([s, e]) =>
      e ? contarAlertasAbertos(supabase, e.id, s.perfil?.papel ?? null) : 0
    ),
    // Leads para contactar hoje e clientes com a mensalidade em atraso —
    // os números no menu.
    getEstudioPorSlug(supabase, slug).then((e) => (e ? contarLeadsParaHoje(supabase, e.id, hojeEmLisboa()) : 0)),
    getEstudioPorSlug(supabase, slug).then((e) => (e ? contarPagamentosEmAtraso(supabase, e.id) : 0)),
  ])

  // Entra-se num estúdio de duas formas: a conta partilhada fixa desse
  // estúdio (lib/data/acessos.ts), ou uma conta pessoal criada pela
  // Administração e já aprovada pelo dono em Equipa ("Dar acesso" — grava em
  // perfis_estudios). O "papel" da ficha em "perfis" nunca decide isto
  // por si só, só o que a conta pode FAZER depois de já ter entrado.
  // As contas fixas entram só pelo email — a consulta a perfis_estudios
  // só é precisa para as contas pessoais (poupa uma ida à base de dados
  // em cada página para o dono, a Coordenação e as contas dos estúdios).
  if (!podeAcederEstudio(sessao.email, slug)) {
    const aprovado = estudio ? await podeAcederEstudioAprovado(supabase, sessao.userId, estudio.id) : false
    if (!aprovado) redirect('/painel?erro=sem-acesso')
  }

  const { ehAdmin, ehGestao } = papeisDaSessao(sessao)
  const contaIndividual = !ehContaFixa(sessao.email)
  const corEstudio = COR_ESTUDIO[slug] ?? COR_OUTRO_ESTUDIO

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
  // Numa conta individual não há pastas com subpastas: cada módulo a que
  // tem acesso ganha pílula própria — senão, sem acesso a Clientes, nem
  // via teria como chegar a Treinos no computador/tablet.
  const subpastasParaFiltrar = contaIndividual ? new Set<string>() : TODAS_AS_SUBPASTAS
  const avisos: Record<string, number> = { tarefas: tarefasUrgentes, alertas: alertasAbertos, leads: leadsParaHoje, pagamentos: pagamentosEmAtraso }
  // Só há número nos módulos a que a conta tem acesso.
  const avisoDe = (id: string) => {
    const m = MODULOS.find((x) => x.id === id)
    return m && podeAceder(m) ? (avisos[id] ?? 0) : 0
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* A faixa e as barras de topo partilham um único wrapper
          "sticky" — cada uma sticky à parte faria a barra tapar a
          faixa ao fazer scroll (duas sticky top-0 ocupam o mesmo
          lugar; só uma, com ambas dentro, as mantém empilhadas). */}
      <div className="sticky top-0 z-10 flex flex-col">
        <BarraSmsGatewayOffline estadosIniciais={estadosBanner} apenasEstudio={slug} />
        <AlertaContactosAgendados contactosIniciais={contactosAgendados} apenasEstudio={slug} />
        {/* Em Suspense: o aviso tem a sua própria consulta e, sem isto, a
            página inteira só era enviada depois de ela responder. Assim a
            página sai logo e o aviso entra quando chegar. */}
        <Suspense fallback={null}>
          <AvisoAcessos supabase={supabase} />
          {estudio && <AvisoCheckinSemMensalidade supabase={supabase} estudioId={estudio.id} slug={slug} />}
          {estudio && <AvisoPedidosApp supabase={supabase} estudioId={estudio.id} slug={slug} />}
          <AvisosHorario supabase={supabase} userId={sessao.userId} email={sessao.email} />
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
        </Suspense>

        {/* Telemóvel e tablet ao alto (<1024px): mini-barra no topo, só para trocar de
            estúdio — os módulos ficam na barra de separadores do fundo,
            sempre ao alcance do polegar, ao estilo iOS. */}
        <div
          className="shadow-deep flex items-center justify-end gap-1 border-b-[3px] bg-background/90 px-4 py-2 backdrop-blur-xl lg:hidden"
          style={{ borderBottomColor: corEstudio.fio }}
        >
          {/* Sempre à vista: volta ao menu inicial deste estúdio, e o
              nome do estúdio onde se está. */}
          <span className="mr-auto flex min-w-0 items-center gap-2">
            <NavLinkInicio slug={slug} comTexto />
            {estudio && <EtiquetaEstudio nome={estudio.nome} cor={corEstudio.etiqueta} />}
          </span>
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

        {/* Computador e tablet deitado (≥1024px): barra superior fixa, com o
            logótipo, os módulos (pílulas, numa linha com scroll
            horizontal se não couberem) e as ações à direita. Só esta
            faixa fica com o tema escuro ("dark tema-proprio") — o resto
            da página continua no modelo claro, ao contrário da
            Administração, onde o escuro é a área toda. */}
        <header
          className="dark tema-proprio shadow-deep hidden items-center gap-3 border-b-[3px] bg-surface/80 px-4 py-2.5 backdrop-blur-xl lg:flex"
          style={{ borderBottomColor: corEstudio.fio }}
        >
          {/* O logótipo volta ao quadro inicial (estúdios, Coordenação,
              Administração); o botão "Início" volta ao início deste estúdio. */}
          <Link href="/painel" title="Quadro inicial — estúdios, Coordenação e Administração" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="RC Private Fitness Studio" width={638} height={257} className="h-8 w-auto" priority />
          </Link>
          {estudio && <EtiquetaEstudio nome={estudio.nome} cor={corEstudio.etiqueta} />}
          <NavLinkInicio slug={slug} comTexto />
          <BarraAjustavel className="min-w-0 flex-1" navClassName="flex items-center gap-2">
            {MODULOS.filter((m) => !subpastasParaFiltrar.has(m.id) && !SUBPASTAS_HORARIOS.has(m.id)).map((m) =>
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
              ) : SUBPASTAS[m.id] && !contaIndividual && podeAceder(m) ? (
                <NavLinkComSubpastas
                  key={m.id}
                  slug={slug}
                  id={m.id}
                  subpastas={SUBPASTAS[m.id]}
                  ehAdmin={ehAdmin}
                  ehGestao={ehGestao}
                  avisos={Object.fromEntries([m.id, ...SUBPASTAS[m.id]].map((x) => [x, avisoDe(x)]))}
                />
              ) : podeAceder(m) ? (
                <NavLinkTopBar key={m.id} href={`/painel/${slug}/${m.id}`} id={m.id} aviso={avisoDe(m.id)} />
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
      <div className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>

      {/* Telemóvel: barra de separadores fixa no fundo (os módulos mais
          usados + "Mais", que abre a lista completa). */}
      <NavTelemovel
        slug={slug}
        itens={MODULOS.map((m) => ({ id: m.id, acessivel: podeAceder(m), aviso: avisoDe(m.id), motivo: podeAceder(m) ? undefined : tituloBloqueado(m) }))}
      />
    </div>
  )
}
