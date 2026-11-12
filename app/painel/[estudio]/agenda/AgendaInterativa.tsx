'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Minus, Plus, HelpCircle, TriangleAlert } from 'lucide-react'
import type { ClienteOpcao } from '@/components/ClienteCombobox'
import type { LeadOpcao } from '@/components/CamposSessaoExperimental'
import { rotuloTipoEvento, type LimiteRepeticao, type Repeticao } from '@/lib/data/agenda'
import { nomeCurto } from '@/lib/data/clientes'
import { PALETA, ALERTAS } from '@/lib/data/constantes'
import { fmt, DIAS_SEMANA } from '@/lib/data/presencas'
import {
  criarEventoRapido,
  atualizarEventoRapido,
  moverEventoRapido,
  redimensionarEventoRapido,
  desmarcarEventoRapido,
  reativarEventoRapido,
  apagarEventoRapido,
  pararSerieRapido,
  type EscopoApagar,
} from './actions'
import type { EventoAgenda, TipoEventoAgenda as TipoEvento } from '@/lib/supabase/database.types'

// Carregado só quando se abre mesmo o modal (criar/editar) — nunca faz
// parte do bundle inicial da Agenda, a página mais visitada da app.
const EventoModalOverlay = dynamic(() => import('./EventoModalOverlay'), { ssr: false })

export type EventoComNomes = EventoAgenda & {
  cliente: {
    id: string
    nome: string
    nome_preferido: string | null
    estudio_id: number
    numero_socio: string | null
    estado: string
    alerta: string
  } | null
  pt: { id: string; nome: string } | null
}

export type PtOpcao = { id: string; nome: string }
export type EstudioOpcao = { id: number; nome: string }

// Treinos em simultâneo guardam uma linha por pessoa (grupo_id
// partilhado) — o rótulo junta os nomes para se ver logo quem treina
// junto, sem abrir o evento.
// Nome do plano/pacote para quem treina acompanhado, pelo nº de
// pessoas no treino em simultâneo — segue a mesma nomenclatura dos
// planos (ex.: "Express 8 - Dual"/"- Trio").
const ROTULO_ACOMPANHADO: Record<number, string> = { 2: 'Dual', 3: 'Trio' }

function rotuloEvento(grupo: EventoComNomes[], estudioId: number) {
  const primeiro = grupo[0]
  if (primeiro.tipo === 'Sessão experimental') return rotuloTipoEvento(primeiro.tipo, primeiro.titulo)
  // Só primeiro + último nome — menos ruído visual do que o nome
  // completo; o nome preferido do cliente (quando existe) sobrepõe-se
  // ao primeiro nome (ver lib/data/clientes.ts: nomeCurto).
  const nomes = grupo
    .filter((e) => e.cliente)
    .map((e) => {
      const curto = nomeCurto(e.cliente!.nome, e.cliente!.nome_preferido)
      return e.cliente!.estudio_id !== estudioId ? `↔ ${curto}` : curto
    })
  if (nomes.length > 0) {
    const sufixo = ROTULO_ACOMPANHADO[nomes.length]
    return sufixo ? `(${sufixo}) ${nomes.join(' + ')}` : nomes.join(' + ')
  }
  return primeiro.titulo ?? primeiro.tipo
}

// Nº de sócio de quem está no treino — pequeno e discreto, numa linha
// à parte por baixo do nome, só para consulta rápida sem abrir o
// evento.
function numerosSocioEvento(grupo: EventoComNomes[]) {
  const numeros = grupo.map((e) => e.cliente?.numero_socio).filter((n): n is string => !!n)
  return numeros.length > 0 ? numeros.join(', ') : null
}

// Pendente/Suspenso/Inativo só acontecem por falta de pagamento em dia
// (ver lib/data/estadoClientes.ts) — por isso o motivo mostrado no
// aviso é já "mensalidade", não o nome técnico do estado.
const MOTIVO_ESTADO: Record<string, string> = {
  Pendente: 'mensalidade em atraso',
  Suspenso: 'mensalidade suspensa',
  Inativo: 'mensalidade inativa',
}

// Texto do aviso (triângulo vermelho) — uma linha por cliente deste
// evento com algo a verificar, já com o motivo específico (mensalidade
// e/ou o alerta da ficha), para se perceber sem sair da agenda. null
// quando não há nada a assinalar.
function avisosEvento(grupo: EventoComNomes[]): string | null {
  const linhas = grupo
    .map((e) => {
      if (!e.cliente) return null
      const motivos: string[] = []
      if (e.cliente.estado !== 'Ativo') {
        motivos.push(MOTIVO_ESTADO[e.cliente.estado] ?? e.cliente.estado)
      }
      const alertaInfo = ALERTAS[e.cliente.alerta as keyof typeof ALERTAS]
      if (e.cliente.alerta !== 'Nenhum' && alertaInfo) motivos.push(alertaInfo.label)
      if (motivos.length === 0) return null
      return `${nomeCurto(e.cliente.nome, e.cliente.nome_preferido)}: ${motivos.join(', ')}`
    })
    .filter((l): l is string => !!l)
  return linhas.length > 0 ? linhas.join('\n') : null
}

function minutosParaHora(minutos: number) {
  const h = Math.floor(minutos / 60) % 24
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function minutosDoDia(horaInicio: string) {
  const [h, m] = horaInicio.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function horaFim(horaInicio: string, duracaoMin: number) {
  return minutosParaHora(minutosDoDia(horaInicio) + duracaoMin)
}

export type EstadoModal =
  | { aberto: false }
  | { aberto: true; modo: 'criar'; data: string; horaInicio: string; duracaoMin: number }
  // grupo inclui sempre o próprio evento — tem 1 elemento quando é só
  // uma pessoa, vários quando é um treino em simultâneo.
  | { aberto: true; modo: 'editar'; evento: EventoComNomes; grupo: EventoComNomes[] }

// Níveis de zoom (pixels por minuto) — cada passo sobe/desce 50
// pontos percentuais (50%, 100%, 150%, ..., 500%), sempre relativo a
// NIVEIS_ZOOM[ZOOM_OMISSAO] = "100%". O zoom com que a agenda abre é
// outro nível (ZOOM_INICIAL, 250%) — aproximado o suficiente para ver
// bem os eventos sem precisar de dar zoom manualmente, pedido pelo
// dono.
const NIVEIS_ZOOM = [0.225, 0.45, 0.675, 0.9, 1.125, 1.35, 1.575, 1.8, 2.025, 2.25]
const ZOOM_OMISSAO = 1
const ZOOM_INICIAL = 4

// Paleta pedida para os blocos de evento da grelha (dia/semana): fundo
// bege suave, borda esquerda a ouro fosco (identidade da marca) e
// texto em carvão — em vez da cor sólida por tipo de evento. Essa cor
// por tipo continua a usar-se noutros sítios (pontos da vista de Mês,
// ficha do evento), onde o objetivo é distinguir tipos, não aqui, onde
// o objetivo é um aspeto leve e uniforme.
const EVENTO_FUNDO = '#EFECE6'
const EVENTO_BORDA = '#C5A059'
const EVENTO_TEXTO = '#1A1A1A'

export default function AgendaInterativa({
  slug,
  estudioId,
  dias,
  eventos,
  clientes,
  outroEstudio,
  clientesOutroEstudio,
  leads,
  pts,
  somenteLeitura,
}: {
  slug: string
  estudioId: number
  dias: string[]
  eventos: EventoComNomes[]
  clientes: ClienteOpcao[]
  outroEstudio: EstudioOpcao | null
  clientesOutroEstudio: ClienteOpcao[]
  leads: LeadOpcao[]
  pts: PtOpcao[]
  somenteLeitura: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<EstadoModal>({ aberto: false })
  const [zoomIndice, setZoomIndice] = useState(ZOOM_INICIAL)
  const [aPendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const pxPorMinuto = NIVEIS_ZOOM[zoomIndice]

  function fechar() {
    setModal({ aberto: false })
    setErro(null)
  }

  function aposSucesso() {
    fechar()
    router.refresh()
  }

  function mover(id: string, novaData: string, novaHoraInicio: string) {
    const grupoId = eventos.find((e) => e.id === id)?.grupo_id ?? null
    iniciarTransicao(async () => {
      const resultado = await moverEventoRapido({
        estudioSlug: slug,
        id,
        grupoId,
        data: novaData,
        horaInicio: novaHoraInicio,
      })
      if ('error' in resultado) setErro(resultado.error)
      else router.refresh()
    })
  }

  function redimensionar(id: string, horaInicio: string, duracaoMin: number) {
    const grupoId = eventos.find((e) => e.id === id)?.grupo_id ?? null
    iniciarTransicao(async () => {
      const resultado = await redimensionarEventoRapido({ estudioSlug: slug, id, grupoId, horaInicio, duracaoMin })
      if ('error' in resultado) setErro(resultado.error)
      else router.refresh()
    })
  }

  function aoSubmeter(formData: FormData, clienteIds: string[]) {
    const campos = {
      estudioSlug: slug,
      tipo: formData.get('tipo') as TipoEvento,
      clienteIds,
      ptId: (formData.get('pt_id') as string) || null,
      titulo: (formData.get('titulo') as string)?.trim() || null,
      leadId: (formData.get('lead_id') as string) || null,
      telefone: (formData.get('telefone') as string)?.trim() || null,
      data: formData.get('data') as string,
      horaInicio: formData.get('hora_inicio') as string,
      duracaoMin: Number(formData.get('duracao_min')) || 40,
      nota: (formData.get('nota') as string)?.trim() || null,
    }

    iniciarTransicao(async () => {
      let resultado
      if (modal.aberto && modal.modo === 'editar') {
        resultado = await atualizarEventoRapido({
          ...campos,
          id: modal.evento.id,
          grupoId: modal.evento.grupo_id,
          estudioId,
        })
      } else {
        const repeticao = (formData.get('repeticao') as Repeticao) || 'nao'
        const limiteModo = (formData.get('limite_modo') as string) || 'vezes'
        const repeteAte = (formData.get('repete_ate') as string) || null
        const repeteVezes = (formData.get('repete_vezes') as string) || null
        const limite: LimiteRepeticao =
          limiteModo === 'indefinido'
            ? { modo: 'indefinido' }
            : limiteModo === 'ate' && repeteAte
              ? { modo: 'ate', ate: repeteAte }
              : { modo: 'vezes', vezes: repeteVezes ? Number(repeteVezes) : 8 }
        resultado = await criarEventoRapido({ ...campos, estudioId, repeticao, limite })
      }
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function pararSerie() {
    if (!(modal.aberto && modal.modo === 'editar' && modal.evento.serie_id)) return
    if (
      !window.confirm(
        'Parar esta série de vez? As próximas ocorrências já agendadas ficam desmarcadas (o histórico mantém-se); a série deixa de gerar mais.'
      )
    ) {
      return
    }
    const serieId = modal.evento.serie_id
    iniciarTransicao(async () => {
      const resultado = await pararSerieRapido({ estudioSlug: slug, serieId })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function desmarcar(contarComoRealizado: boolean, foiRemarcado: boolean) {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const { id, grupo_id } = modal.evento
    iniciarTransicao(async () => {
      const resultado = await desmarcarEventoRapido({
        estudioSlug: slug,
        id,
        grupoId: grupo_id,
        motivo: null,
        contarComoRealizado,
        foiRemarcado,
      })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function reativar() {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const { id, grupo_id } = modal.evento
    iniciarTransicao(async () => {
      const resultado = await reativarEventoRapido({ estudioSlug: slug, id, grupoId: grupo_id })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  function apagar(escopo: EscopoApagar) {
    if (!(modal.aberto && modal.modo === 'editar')) return
    const { id, grupo_id, serie_id, data } = modal.evento
    iniciarTransicao(async () => {
      const resultado = await apagarEventoRapido({
        estudioSlug: slug,
        id,
        grupoId: grupo_id,
        serieId: serie_id,
        data,
        escopo,
      })
      if ('error' in resultado) setErro(resultado.error)
      else aposSucesso()
    })
  }

  const porDia: Record<string, EventoComNomes[]> = {}
  for (const e of eventos) {
    const lista = porDia[e.data] ?? []
    lista.push(e)
    porDia[e.data] = lista
  }

  function abrirParaEditar(evento: EventoComNomes) {
    const grupo = evento.grupo_id ? eventos.filter((e) => e.grupo_id === evento.grupo_id) : [evento]
    setModal({ aberto: true, modo: 'editar', evento, grupo })
  }

  return (
    <>
      <GrelhaInterativa
        dias={dias}
        estudioId={estudioId}
        porDia={porDia}
        onMover={mover}
        onRedimensionar={redimensionar}
        onClickVazio={(dia, horaInicio, duracaoMin) =>
          setModal({ aberto: true, modo: 'criar', data: dia, horaInicio, duracaoMin })
        }
        onAbrirEvento={abrirParaEditar}
        pxPorMinuto={pxPorMinuto}
        zoomIndice={zoomIndice}
        onZoomIndiceChange={setZoomIndice}
        somenteLeitura={somenteLeitura}
      />

      {modal.aberto && (
        <EventoModalOverlay
          modal={modal}
          clientes={clientes}
          outroEstudio={outroEstudio}
          clientesOutroEstudio={clientesOutroEstudio}
          leads={leads}
          pts={pts}
          estudioId={estudioId}
          erro={erro}
          aPendente={aPendente}
          slug={slug}
          onFechar={fechar}
          onSubmeter={aoSubmeter}
          onDesmarcar={desmarcar}
          onReativar={reativar}
          onApagar={apagar}
          onPararSerie={pararSerie}
          somenteLeitura={somenteLeitura}
        />
      )}
    </>
  )
}

// A grelha mostra o dia inteiro, das 00h00 às 24h00 — cada evento fica
// posicionado exatamente à sua hora e minuto (não há blocos fixos de
// meia hora a condicionar onde um evento pode ficar).
const GRADE_HORA_INICIO = 0
const GRADE_HORA_FIM = 24
const HORAS_GRADE = Array.from(
  { length: GRADE_HORA_FIM - GRADE_HORA_INICIO + 1 },
  (_, i) => GRADE_HORA_INICIO + i
)
const DURACAO_MIN_MINIMA = 5

// A grelha abre sempre a mostrar a partir desta hora (em vez do topo,
// meia-noite) — ninguém treina de madrugada, por isso não faz sentido
// começar a ver aí por omissão.
const HORA_INICIAL_VISIVEL = 6

type EventoPosicionado = { evento: EventoComNomes; grupo: EventoComNomes[]; coluna: number; colunas: number }

// Um treino em simultâneo tem uma linha por pessoa — todas com o mesmo
// grupo_id — mas só deve ocupar UM bloco na grelha (com todos os nomes),
// em vez de aparecerem lado a lado como se fossem eventos diferentes.
function representantesDoDia(eventosDia: EventoComNomes[]): { evento: EventoComNomes; grupo: EventoComNomes[] }[] {
  const vistos = new Set<string>()
  const resultado: { evento: EventoComNomes; grupo: EventoComNomes[] }[] = []
  for (const e of eventosDia) {
    if (vistos.has(e.id)) continue
    if (e.grupo_id) {
      const grupo = eventosDia.filter((x) => x.grupo_id === e.grupo_id)
      grupo.forEach((x) => vistos.add(x.id))
      resultado.push({ evento: e, grupo })
    } else {
      vistos.add(e.id)
      resultado.push({ evento: e, grupo: [e] })
    }
  }
  return resultado
}

// Dispõe os eventos do dia numa grelha contínua: eventos que se
// sobrepõem no tempo ficam lado a lado (como no Google Calendar), em
// vez de empilhados uns sobre os outros.
function disporEventosDoDia(eventosDia: EventoComNomes[]): EventoPosicionado[] {
  const ordenados = [...representantesDoDia(eventosDia)].sort(
    (a, b) => minutosDoDia(a.evento.hora_inicio) - minutosDoDia(b.evento.hora_inicio)
  )
  const fimPorColuna: number[] = []
  const base = ordenados.map((r) => {
    const inicio = minutosDoDia(r.evento.hora_inicio)
    const fim = inicio + r.evento.duracao_min
    let coluna = fimPorColuna.findIndex((f) => f <= inicio)
    if (coluna === -1) {
      coluna = fimPorColuna.length
      fimPorColuna.push(fim)
    } else {
      fimPorColuna[coluna] = fim
    }
    return { ...r, coluna, inicio, fim }
  })
  return base.map((p) => {
    const simultaneos = base.filter((q) => q.inicio < p.fim && q.fim > p.inicio)
    const colunas = Math.max(...simultaneos.map((q) => q.coluna + 1))
    return { evento: p.evento, grupo: p.grupo, coluna: p.coluna, colunas }
  })
}

// Arredondado aos 10 minutos aqui, na origem — para a caixa que
// acompanha o rato, a pré-visualização e a hora final gravada serem
// sempre exatamente o mesmo valor (nunca a pré-visualização encostar a
// uma hora redonda e a marcação ficar gravada uns minutos ao lado).
function minutoNoClique(clienteY: number, rectTop: number, pxPorMinuto: number) {
  const minutosExatos = (clienteY - rectTop) / pxPorMinuto
  const minutos = Math.round(minutosExatos / 10) * 10
  return Math.max(0, Math.min(GRADE_HORA_FIM * 60 - 10, minutos))
}

// Ao mover um evento, o início nunca pode sair da grelha nem empurrar o
// fim para fora dela.
function limitarInicio(inicioMin: number, duracaoMin: number) {
  return Math.max(0, Math.min(GRADE_HORA_FIM * 60 - duracaoMin, inicioMin))
}

// Um só arrasto de cada vez — a criar um evento novo (a partir de um
// espaço vazio), a redimensionar um existente (a partir de uma pega) ou
// a mover um existente (a partir do meio) — pode atravessar colunas
// (dias) diferentes, por isso vive aqui, não em cada coluna. Em ref
// (não state): o mousemove no window tem de ler sempre o valor mais
// recente sem obrigar a re-subscrever os listeners a cada pixel.
type Arrasto =
  | { tipo: 'criar'; dia: string; inicioMin: number }
  | { tipo: 'redimensionar'; evento: EventoComNomes; pega: 'topo' | 'fundo' }
  // "offsetMin" guarda a quantos minutos do início do evento é que o
  // rato agarrou (ex.: evento às 17h00, clicado a meio, às 17h20 → 20)
  // para o bloco se deslocar mantendo esse ponto fixo sob o rato, em
  // vez de "saltar" para o início do evento ficar sempre sob o rato.
  | { tipo: 'mover'; evento: EventoComNomes; offsetMin: number }

function GrelhaInterativa({
  dias,
  estudioId,
  porDia,
  onMover,
  onRedimensionar,
  onClickVazio,
  onAbrirEvento,
  pxPorMinuto,
  zoomIndice,
  onZoomIndiceChange,
  somenteLeitura,
}: {
  dias: string[]
  estudioId: number
  porDia: Record<string, EventoComNomes[]>
  onMover: (id: string, dia: string, horaInicio: string) => void
  onRedimensionar: (id: string, horaInicio: string, duracaoMin: number) => void
  onClickVazio: (dia: string, horaInicio: string, duracaoMin: number) => void
  onAbrirEvento: (evento: EventoComNomes) => void
  pxPorMinuto: number
  zoomIndice: number
  onZoomIndiceChange: (indice: number) => void
  somenteLeitura: boolean
}) {
  // Um só dia (vista Dia) ocupa a largura toda; a semana continua a
  // precisar de largura mínima para as 7 colunas não ficarem espremidas.
  const colunas = `repeat(${dias.length}, 1fr)`
  const largura = dias.length > 1 ? 'min-w-[760px]' : 'min-w-[260px]'
  const alturaGrade = GRADE_HORA_FIM * 60 * pxPorMinuto

  const colRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const arrastoRef = useRef<Arrasto | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Ao abrir (ou mudar de dia/semana), a grelha começa logo a partir
  // das HORA_INICIAL_VISIVEL — nunca à meia-noite, onde não há nada.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = HORA_INICIAL_VISIVEL * 60 * pxPorMinuto
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias.join(',')])

  const [previa, setPrevia] = useState<{ dia: string; inicioMin: number; fimMin: number } | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  // Um evento só fica com as pegas de redimensionar ativas depois de um
  // clique a selecioná-lo — sem isto, a pega (que é maior do que a
  // risca visível, de propósito) ficava sempre pronta a agarrar, e
  // tentar criar um evento novo logo a seguir a outro (ex.: às 7h40,
  // encostado a um das 7h-7h40) acabava sempre por redimensionar o
  // anterior em vez de criar um novo.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  // Hora sob o rato — acompanha sempre o cursor (ao contrário da régua
  // antiga, fixa na coluna da esquerda), tanto em repouso como durante
  // qualquer arrasto, arredondada aos 10 minutos.
  const [cursor, setCursor] = useState<{ x: number; y: number; minuto: number } | null>(null)

  function registarRef(dia: string) {
    return (el: HTMLDivElement | null) => {
      colRefs.current[dia] = el
    }
  }

  const localizar = useCallback(
    (clientX: number, clientY: number): { dia: string; minuto: number } | null => {
      for (const dia of dias) {
        const el = colRefs.current[dia]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return { dia, minuto: minutoNoClique(clientY, rect.top, pxPorMinuto) }
        }
      }
      return null
    },
    [dias, pxPorMinuto]
  )

  useEffect(() => {
    function mover(e: MouseEvent) {
      const loc = localizar(e.clientX, e.clientY)
      const arrasto = arrastoRef.current
      if (loc) {
        setCursor({ x: e.clientX, y: e.clientY, minuto: loc.minuto })
      } else if (!arrasto) {
        // Fora da grelha e sem nenhum arrasto em curso — a hora some,
        // em vez de ficar presa no sítio onde o rato saiu (ex.: por
        // cima da barra de filtros, ou depois de rolar a grelha).
        setCursor(null)
      }

      if (!arrasto || !loc) return

      if (arrasto.tipo === 'criar') {
        setPrevia({
          dia: arrasto.dia,
          inicioMin: Math.min(arrasto.inicioMin, loc.minuto),
          fimMin: Math.max(arrasto.inicioMin, loc.minuto),
        })
      } else if (arrasto.tipo === 'redimensionar') {
        const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
        const fimOriginal = inicioOriginal + arrasto.evento.duracao_min
        if (arrasto.pega === 'topo') {
          setPrevia({
            dia: arrasto.evento.data,
            inicioMin: Math.min(loc.minuto, fimOriginal - DURACAO_MIN_MINIMA),
            fimMin: fimOriginal,
          })
        } else {
          setPrevia({
            dia: arrasto.evento.data,
            inicioMin: inicioOriginal,
            fimMin: Math.max(loc.minuto, inicioOriginal + DURACAO_MIN_MINIMA),
          })
        }
      } else {
        const novoInicio = limitarInicio(loc.minuto - arrasto.offsetMin, arrasto.evento.duracao_min)
        setPrevia({ dia: loc.dia, inicioMin: novoInicio, fimMin: novoInicio + arrasto.evento.duracao_min })
      }
    }

    function cancelarArrasto() {
      arrastoRef.current = null
      setPrevia(null)
      setArrastandoId(null)
    }

    function soltar(e: MouseEvent) {
      const arrasto = arrastoRef.current
      if (!arrasto) return
      arrastoRef.current = null
      setPrevia(null)
      setArrastandoId(null)
      const loc = localizar(e.clientX, e.clientY)
      if (!loc) return

      if (arrasto.tipo === 'criar') {
        const inicio = Math.min(arrasto.inicioMin, loc.minuto)
        const fim = Math.max(arrasto.inicioMin, loc.minuto)
        const duracaoArrastada = fim - inicio
        onClickVazio(arrasto.dia, minutosParaHora(inicio), duracaoArrastada >= 15 ? duracaoArrastada : 40)
        return
      }

      if (arrasto.tipo === 'redimensionar') {
        const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
        const fimOriginal = inicioOriginal + arrasto.evento.duracao_min
        const novoInicio = arrasto.pega === 'topo' ? Math.min(loc.minuto, fimOriginal - DURACAO_MIN_MINIMA) : inicioOriginal
        const novoFim = arrasto.pega === 'fundo' ? Math.max(loc.minuto, inicioOriginal + DURACAO_MIN_MINIMA) : fimOriginal
        if (novoInicio !== inicioOriginal || novoFim !== fimOriginal) {
          onRedimensionar(arrasto.evento.id, minutosParaHora(novoInicio), novoFim - novoInicio)
        }
        return
      }

      const inicioOriginal = minutosDoDia(arrasto.evento.hora_inicio)
      const novoInicioMover = limitarInicio(loc.minuto - arrasto.offsetMin, arrasto.evento.duracao_min)
      if (loc.dia !== arrasto.evento.data || novoInicioMover !== inicioOriginal) {
        onMover(arrasto.evento.id, loc.dia, minutosParaHora(novoInicioMover))
      }
    }

    // Esc cancela um arrasto em curso (criar, mover ou redimensionar) sem
    // gravar nada — tal como no Google Calendar.
    function aoPressionarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape' && arrastoRef.current) cancelarArrasto()
    }

    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
    window.addEventListener('keydown', aoPressionarTecla)
    return () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
      window.removeEventListener('keydown', aoPressionarTecla)
    }
  }, [localizar, onClickVazio, onRedimensionar, onMover])

  function aoMoverRatoEmRepouso(e: React.MouseEvent) {
    if (arrastoRef.current) return
    const loc = localizar(e.clientX, e.clientY)
    if (loc) setCursor({ x: e.clientX, y: e.clientY, minuto: loc.minuto })
  }

  // Deslizar a grelha (roda do rato ou gesto) nunca dispara "mousemove"
  // — sem isto, a hora ficava presa no sítio onde o rato estava antes
  // de rolar, já sem corresponder a nenhuma linha visível. Recalcula-se
  // para o mesmo ponto do ecrã (o rato não se moveu, só o conteúdo por
  // baixo), ou esconde-se se esse ponto deixou de estar em cima da
  // grelha.
  function aoRolarGrelha() {
    if (arrastoRef.current) return
    setCursor((atual) => {
      if (!atual) return atual
      const loc = localizar(atual.x, atual.y)
      return loc ? { ...atual, minuto: loc.minuto } : null
    })
  }

  function iniciarCriacao(dia: string) {
    return (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setSelecionadoId(null)
      const loc = localizar(e.clientX, e.clientY)
      const inicioMin = loc?.minuto ?? 0
      arrastoRef.current = { tipo: 'criar', dia, inicioMin }
      setPrevia({ dia, inicioMin, fimMin: inicioMin })
    }
  }

  function iniciarRedimensionamento(evento: EventoComNomes, pega: 'topo' | 'fundo') {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      arrastoRef.current = { tipo: 'redimensionar', evento, pega }
      setPrevia({
        dia: evento.data,
        inicioMin: minutosDoDia(evento.hora_inicio),
        fimMin: minutosDoDia(evento.hora_inicio) + evento.duracao_min,
      })
    }
  }

  function iniciarMovimento(evento: EventoComNomes) {
    return (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      setSelecionadoId(evento.id)
      const inicioOriginal = minutosDoDia(evento.hora_inicio)
      const loc = localizar(e.clientX, e.clientY)
      // Quantos minutos do início do evento é que o rato agarrou — para
      // o bloco se deslocar mantendo esse ponto fixo sob o rato, em vez
      // de "saltar" com o início do evento sempre colado ao cursor.
      const offsetMin = loc ? loc.minuto - inicioOriginal : 0
      arrastoRef.current = { tipo: 'mover', evento, offsetMin }
      setArrastandoId(evento.id)
      setPrevia({
        dia: evento.data,
        inicioMin: minutosDoDia(evento.hora_inicio),
        fimMin: minutosDoDia(evento.hora_inicio) + evento.duracao_min,
      })
    }
  }

  // A ordem para editar passa a ser dada com o botão direito — o
  // esquerdo fica livre só para arrastar/mover, sem abrir nada ao
  // simplesmente clicar.
  function aoAbrirContexto(evento: EventoComNomes) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onAbrirEvento(evento)
    }
  }

  return (
    <div
      className="mt-1 overflow-x-auto"
      onMouseLeave={() => {
        if (!arrastoRef.current) setCursor(null)
      }}
      onScroll={aoRolarGrelha}
    >
      <div className="mb-1 flex items-center justify-end gap-1.5">
        {/* Instruções de uso — texto igual ao de antes, só que agora
            num ícone com dica ao passar o rato, em vez de um parágrafo
            sempre visível, para a grelha começar mais perto do topo. */}
        <span
          title={
            somenteLeitura
              ? 'A tua conta só pode ver a Agenda — botão direito num evento para ver os detalhes.'
              : 'A hora acompanha sempre o rato (de 10 em 10 min); clica e arrasta num espaço vazio para criar com essa duração (um clique simples usa 40 min); arrasta o meio de um evento para o mover; clica uma vez num evento para depois poder encurtar/alongar pelo topo ou fundo; botão direito num evento para o editar; Esc cancela um arrasto a meio.'
          }
          className="flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full text-muted hover:bg-brand/[.08] hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border-subtle bg-surface px-0.5 py-0.5 shadow-pop">
          <button
            type="button"
            onClick={() => onZoomIndiceChange(Math.max(0, zoomIndice - 1))}
            disabled={zoomIndice === 0}
            title="Diminuir zoom"
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-brand/[.08] hover:text-foreground disabled:opacity-30"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-[10px] font-semibold text-muted">
            {Math.round((pxPorMinuto / NIVEIS_ZOOM[ZOOM_OMISSAO]) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomIndiceChange(Math.min(NIVEIS_ZOOM.length - 1, zoomIndice + 1))}
            disabled={zoomIndice === NIVEIS_ZOOM.length - 1}
            title="Aumentar zoom"
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-brand/[.08] hover:text-foreground disabled:opacity-30"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className={largura}>
        <div className="grid" style={{ gridTemplateColumns: `48px ${colunas}` }}>
          <div />
          {dias.map((d, i) => (
            <div
              key={d}
              className="whitespace-nowrap rounded-t-lg bg-brand/[.05] px-1 py-1 text-center text-[11px] font-semibold text-foreground"
            >
              {dias.length > 1 ? DIAS_SEMANA[i] : DIAS_SEMANA[(new Date(`${d}T00:00:00`).getDay() + 6) % 7]}
              <span className="ml-1 font-normal text-muted">{fmt(d)}</span>
            </div>
          ))}
        </div>
        <div
          ref={scrollRef}
          onMouseMove={aoMoverRatoEmRepouso}
          onScroll={aoRolarGrelha}
          className="h-[calc(100vh-200px)] min-h-[360px] overflow-y-auto rounded-b-xl border border-border-subtle"
        >
          <div className="grid" style={{ gridTemplateColumns: `48px ${colunas}`, height: alturaGrade }}>
            <div className="relative text-[10px] text-muted">
              {HORAS_GRADE.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2"
                  style={{ top: h * 60 * pxPorMinuto }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {dias.map((dia) => (
              <ColunaDia
                key={dia}
                dia={dia}
                estudioId={estudioId}
                eventos={porDia[dia] ?? []}
                registarRef={registarRef(dia)}
                onIniciarCriacao={iniciarCriacao(dia)}
                onIniciarRedimensionamento={iniciarRedimensionamento}
                onIniciarMovimento={iniciarMovimento}
                onAbrirContexto={aoAbrirContexto}
                arrastandoId={arrastandoId}
                selecionadoId={selecionadoId}
                previa={previa?.dia === dia ? previa : null}
                pxPorMinuto={pxPorMinuto}
                somenteLeitura={somenteLeitura}
              />
            ))}
          </div>
        </div>
      </div>

      {/* A hora segue o cursor em qualquer sítio da grelha — posição
          fixa ao ecrã, por isso não é afetada pelo scroll interno. */}
      {cursor && (
        <div
          className="pointer-events-none fixed z-30 text-[11px] font-semibold whitespace-nowrap text-black"
          style={{ left: cursor.x + 14, top: cursor.y - 10 }}
        >
          {minutosParaHora(cursor.minuto)}
        </div>
      )}
    </div>
  )
}

function ColunaDia({
  dia,
  eventos,
  estudioId,
  registarRef,
  onIniciarCriacao,
  onIniciarRedimensionamento,
  onIniciarMovimento,
  onAbrirContexto,
  arrastandoId,
  selecionadoId,
  previa,
  pxPorMinuto,
  somenteLeitura,
}: {
  dia: string
  eventos: EventoComNomes[]
  estudioId: number
  registarRef: (el: HTMLDivElement | null) => void
  onIniciarCriacao: (e: React.MouseEvent) => void
  onIniciarRedimensionamento: (evento: EventoComNomes, pega: 'topo' | 'fundo') => (e: React.MouseEvent) => void
  onIniciarMovimento: (evento: EventoComNomes) => (e: React.MouseEvent) => void
  onAbrirContexto: (evento: EventoComNomes) => (e: React.MouseEvent) => void
  arrastandoId: string | null
  selecionadoId: string | null
  previa: { inicioMin: number; fimMin: number } | null
  pxPorMinuto: number
  somenteLeitura: boolean
}) {
  // Também usada para a linha da hora atual (só na coluna de hoje) —
  // por isso atualiza-se ao minuto, não só devagar.
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(intervalo)
  }, [])
  const dataAgora = new Date(agora)
  const ehHoje = dia === dataAgora.toISOString().slice(0, 10)
  const minutoAgora = dataAgora.getHours() * 60 + dataAgora.getMinutes()
  return (
    <div
      ref={registarRef}
      onMouseDown={somenteLeitura ? undefined : onIniciarCriacao}
      className={`relative border-l border-border-subtle bg-surface transition-colors select-none ${somenteLeitura ? '' : 'cursor-crosshair'}`}
    >
      {HORAS_GRADE.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border-subtle/60"
          style={{ top: h * 60 * pxPorMinuto }}
        />
      ))}
      {previa && (
        <div
          className="pointer-events-none absolute inset-x-1 overflow-hidden rounded border-2 border-dashed border-brand bg-brand/20 px-1 py-0.5"
          style={{
            top: previa.inicioMin * pxPorMinuto,
            height: Math.max((previa.fimMin - previa.inicioMin) * pxPorMinuto, 4),
          }}
        >
          <span className="block truncate text-[12px] font-bold text-brand">
            {minutosParaHora(previa.inicioMin)}–{minutosParaHora(previa.fimMin)}
          </span>
        </div>
      )}
      {disporEventosDoDia(eventos).map(({ evento, grupo, coluna, colunas }) => {
        const inicioMin = minutosDoDia(evento.hora_inicio)
        const emArrasto = arrastandoId === evento.id
        const emSelecionado = selecionadoId === evento.id
        const numerosSocio = numerosSocioEvento(grupo)
        const avisos = avisosEvento(grupo)
        const cancelado = evento.estado === 'Cancelado'
        // "Terminado" só desvanece o aspeto — nunca line-through, que
        // fica só para "Cancelado" (um já aconteceu, o outro não).
        const terminado =
          !cancelado && new Date(`${evento.data}T${horaFim(evento.hora_inicio, evento.duracao_min)}`).getTime() < agora
        return (
          <button
            key={evento.id}
            type="button"
            draggable={false}
            title={
              somenteLeitura
                ? 'Botão direito para ver — a tua conta só pode ver a Agenda'
                : emSelecionado
                  ? 'Arrasta para mover · puxa o topo/fundo para encurtar/alongar · botão direito para editar'
                  : 'Arrasta para mover · clica uma vez para poder encurtar/alongar · botão direito para editar'
            }
            onMouseDown={somenteLeitura ? undefined : onIniciarMovimento(evento)}
            onContextMenu={onAbrirContexto(evento)}
            className={`group absolute rounded-md text-left leading-tight shadow-sm transition-opacity select-none ${
              somenteLeitura ? 'cursor-pointer' : emArrasto ? 'cursor-grabbing opacity-30' : 'cursor-grab'
            } ${emSelecionado ? 'ring-2 ring-brand ring-offset-1' : ''} ${
              cancelado ? 'opacity-50 line-through' : terminado ? 'opacity-55' : ''
            }`}
            style={{
              // Pequeno espaço (calc) entre blocos vizinhos — horizontal
              // (colunas lado a lado) e vertical (altura 2px mais curta
              // do que o espaço disponível) — para nunca ficarem
              // encostados uns aos outros, ao estilo Google Calendar.
              top: inicioMin * pxPorMinuto,
              height: Math.max(evento.duracao_min * pxPorMinuto, 24) - 2,
              left: `calc(${(coluna * 100) / colunas}% + 1px)`,
              width: `calc(${100 / colunas}% - 2px)`,
              background: EVENTO_FUNDO,
              color: EVENTO_TEXTO,
              // Linha fina à volta de toda a caixa, para se ver sempre o
              // evento delimitado (mesmo encostado a outro) — a borda
              // esquerda, mais grossa, por cima, é o destaque de
              // identidade (ouro) ou de aviso (vermelho, desmarcado).
              border: '1px solid #000',
              borderLeft: `4px solid ${cancelado ? PALETA.vermelho.tx : EVENTO_BORDA}`,
            }}
          >
            {/* Conteúdo num wrapper à parte, só este com overflow-hidden
                (para o texto truncar) — o botão em si fica sem isso, para
                as pegas de redimensionar poderem crescer um pouco para
                fora da borda sem ficarem cortadas. Reserva-se espaço à
                direita (pr-6) para o nº de sócio (canto inferior
                direito) nunca ficar por cima do texto truncado. */}
            <span className="block h-full overflow-hidden px-1.5 py-1 pr-6 leading-snug">
              <span className="block truncate text-[13px] font-medium">{rotuloEvento(grupo, estudioId)}</span>
              <span className="block truncate text-[12px] font-normal">
                {evento.hora_inicio.slice(0, 5)}–{horaFim(evento.hora_inicio, evento.duracao_min)}
              </span>
            </span>
            {/* Nº de sócio — nunca como texto (ficava a sobrepor-se ao
                nome/hora em colunas estreitas, com vários eventos ao
                mesmo tempo) — só uma bolinha discreta, sempre do
                mesmo tamanho, que nunca colide com mais nada; passa o
                rato por cima para ver o número (title = tooltip
                nativa do browser). */}
            {numerosSocio && (
              <span
                title={`Nº de sócio: ${numerosSocio}`}
                className="absolute right-1.5 bottom-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-40"
              />
            )}
            {/* Aviso discreto (canto superior direito) quando algum dos
                clientes deste evento tem algo a verificar — mensalidade
                não ativa, suspenso/inativo, ou um alerta (lesão, doença,
                limitação, prova a chegar). Só avisa que há algo; os
                detalhes ficam na ficha do cliente. */}
            {avisos && (
              <span title={avisos} className="absolute top-1 right-1">
                <TriangleAlert className="h-3 w-3 text-red-600" strokeWidth={2.5} />
              </span>
            )}
            {/* Pegas de redimensionar, ao estilo Google Calendar — zona de
                clique bem maior do que a risca visível (que só aparece ao
                passar o rato), para não ser preciso acertar em poucos
                pixéis exatos. Só ficam clicáveis depois de o evento estar
                selecionado (um clique antes): como esta zona ultrapassa a
                própria caixa do evento, sem isto intercetava sempre o
                clique de quem estava só a tentar criar um evento novo logo
                a seguir a este (ex.: às 7h40, encostado a um das 7h-7h40) —
                com "pointer-events-none" enquanto não selecionado, esse
                clique passa à coluna por baixo e cria o evento novo em vez
                de redimensionar este. */}
            <span
              onMouseDown={
                emSelecionado && !somenteLeitura ? onIniciarRedimensionamento(evento, 'topo') : undefined
              }
              className={`absolute inset-x-0 -top-1.5 flex h-3.5 items-start justify-center ${
                emSelecionado && !somenteLeitura ? 'cursor-ns-resize' : 'pointer-events-none'
              }`}
            >
              <span className="mt-1 h-0.5 w-5 rounded-full bg-current opacity-0 group-hover:opacity-70" />
            </span>
            <span
              onMouseDown={
                emSelecionado && !somenteLeitura ? onIniciarRedimensionamento(evento, 'fundo') : undefined
              }
              className={`absolute inset-x-0 -bottom-1.5 flex h-3.5 items-end justify-center ${
                emSelecionado && !somenteLeitura ? 'cursor-ns-resize' : 'pointer-events-none'
              }`}
            >
              <span className="mb-1 h-0.5 w-5 rounded-full bg-current opacity-0 group-hover:opacity-70" />
            </span>
          </button>
        )
      })}
      {/* Linha da hora atual, ao estilo Google Calendar — só na coluna
          de hoje, por cima dos eventos, a acompanhar "agora" (atualiza
          ao minuto, tal como o desvanecer de eventos terminados acima). */}
      {ehHoje && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex -translate-y-1/2 items-center"
          style={{ top: minutoAgora * pxPorMinuto }}
        >
          <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-red-600" />
          <span className="h-px flex-1 bg-red-600" />
        </div>
      )}
    </div>
  )
}
