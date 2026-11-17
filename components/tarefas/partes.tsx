import { Check, Flag, ListChecks, Lock, Repeat, Star } from 'lucide-react'
import { descricaoRepeticao, DIAS_TAREFA_PARADA, emFoco, haQuantoTempo, idadeEmDias, type Prioridade, type Tarefa } from '@/lib/data/tarefas'
import { alternarFocoTarefa, mudarEstadoTarefa } from '@/app/painel/tarefasActions'
import ConcluirTarefa from './ConcluirTarefa'
import { AbrirTarefa, EditarComBotaoDireito } from './JanelaTarefas'

// Peças partilhadas pelas várias vistas das Tarefas (lista, quadro,
// calendário…). Só cores do tema e variantes "dark:", para servirem nas
// áreas claras e na escura.

export const campoCls = 'w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-brand'
export const rotuloCls = 'flex flex-col gap-1 text-xs font-medium text-muted'
export const pastilhaCls = 'inline-flex items-center gap-1 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-muted'
export const botaoPequenoCls =
  'rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-brand/[.08]'

export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const horaCurta = (hora: string | null) => (hora ? hora.slice(0, 5) : '')

export type Contexto = {
  hoje: string
  voltar: string
  nomePessoa: Map<string, string>
  nomeEstudio: Map<number, string>
  // A equipa (para escolher quem fez) e, numa conta pessoal, quem é.
  pessoas: { id: string; nome: string }[]
  euId: string | null
  // Passos de cada tarefa: quantos há e quantos estão feitos.
  passos: Map<string, { total: number; feitos: number }>
  // Fora dos estúdios (na Coordenação) mostra-se de que
  // estúdio é cada tarefa.
  mostrarEstudio: boolean
}

const COR_PRIORIDADE: Record<Prioridade, string> = {
  alta: 'text-red-600 dark:text-red-400',
  media: 'text-amber-600 dark:text-amber-400',
  baixa: 'text-muted',
}
const NOME_PRIORIDADE: Record<Prioridade, string> = {
  alta: 'Prioridade alta',
  media: 'Prioridade média',
  baixa: 'Prioridade baixa',
}

export function EstadoForm({
  id,
  estado,
  voltar,
  children,
  className,
}: {
  id: string
  estado: string
  voltar: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <form action={mudarEstadoTarefa} className={className}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <input type="hidden" name="voltar" value={voltar} />
      {children}
    </form>
  )
}

// O prazo de uma tarefa, com a cor da urgência: vermelho se já passou,
// âmbar se é hoje.
export function Prazo({ t, hoje, completo = false }: { t: Tarefa; hoje: string; completo?: boolean }) {
  if (!t.prazo) return null
  const feita = t.estado === 'feito'
  const atrasada = !feita && t.prazo < hoje
  const paraHoje = !feita && t.prazo === hoje
  const texto = `${t.inicio && t.inicio !== t.prazo ? `${dataCurta(t.inicio)} → ` : ''}${dataCurta(t.prazo)}${t.hora ? ` ${horaCurta(t.hora)}` : ''}`
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
        atrasada
          ? 'bg-red-500/15 text-red-700 dark:text-red-300'
          : paraHoje
            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
            : 'bg-foreground/[.06] text-muted'
      }`}
    >
      {completo && atrasada ? 'Atrasada · ' : ''}
      {paraHoje ? `Hoje${t.hora ? ` ${horaCurta(t.hora)}` : ''}` : texto}
    </span>
  )
}

// As etiquetas pequenas de uma tarefa (cartões do quadro, calendário).
export function Pastilhas({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  const idade = idadeEmDias(t.criado_em, ctx.hoje)
  const repete = descricaoRepeticao(t)
  const passos = ctx.passos.get(t.id)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <Prazo t={t} hoje={ctx.hoje} completo />
      {!t.prazo && t.estado !== 'feito' && (
        // Parada há muito tempo: fica assinalada a âmbar.
        <span
          className={
            idade > DIAS_TAREFA_PARADA
              ? 'inline-flex items-center rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200'
              : pastilhaCls
          }
        >
          criada {haQuantoTempo(idade)}
        </span>
      )}
      {t.estado === 'em_curso' && (
        <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">Em curso</span>
      )}
      {t.prioridade && (
        <span className={pastilhaCls}>
          <Flag className={`h-3 w-3 ${COR_PRIORIDADE[t.prioridade]}`} fill="currentColor" /> {NOME_PRIORIDADE[t.prioridade].replace('Prioridade ', '')}
        </span>
      )}
      {repete && (
        <span className={pastilhaCls} title="Ao concluir, volta a aparecer com o prazo seguinte">
          <Repeat className="h-3 w-3" /> {repete}
        </span>
      )}
      {passos && (
        <span className={pastilhaCls}>
          <ListChecks className="h-3 w-3" /> {passos.feitos}/{passos.total}
        </span>
      )}
      {t.estado === 'feito' && t.feita_por && <span className={pastilhaCls}>feita por {ctx.nomePessoa.get(t.feita_por)?.split(' ')[0] ?? '—'}</span>}
      {t.estado !== 'feito' && t.responsavel_id && <span className={pastilhaCls}>{ctx.nomePessoa.get(t.responsavel_id) ?? '—'}</span>}
      {t.lista && <span className={pastilhaCls}>{t.lista}</span>}
      {ctx.mostrarEstudio && t.estudio_id != null && ctx.nomeEstudio.get(t.estudio_id) && (
        <span className={pastilhaCls}>{ctx.nomeEstudio.get(t.estudio_id)}</span>
      )}
      {t.etiquetas.map((e) => (
        <span key={e} className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-foreground">
          {e}
        </span>
      ))}
      {t.reservada && (
        <span className={pastilhaCls} title="Só a administração vê esta tarefa">
          <Lock className="h-3 w-3" /> Só administração
        </span>
      )}
    </div>
  )
}

// As colunas da lista (computador): ✓ | tarefa | prazo | repete | lista |
// quem | ações. No telemóvel cada tarefa fica em duas linhas.
export const COLUNAS_LISTA = 'lg:grid lg:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_9rem_7rem_6rem_6.5rem] lg:items-center lg:gap-3'

export function CabecalhoLista() {
  return (
    <div className={`hidden px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted ${COLUNAS_LISTA}`}>
      <span />
      <span>Tarefa</span>
      <span>Prazo</span>
      <span>Repete</span>
      <span>Lista</span>
      <span>Quem</span>
      <span />
    </div>
  )
}

export function LinhaTarefa({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  const feita = t.estado === 'feito'
  const foco = emFoco(t, ctx.hoje)
  const idade = idadeEmDias(t.criado_em, ctx.hoje)
  const repete = descricaoRepeticao(t)
  const passos = ctx.passos.get(t.id)
  const quem = feita ? (t.feita_por ? (ctx.nomePessoa.get(t.feita_por) ?? '—') : null) : t.responsavel_id ? (ctx.nomePessoa.get(t.responsavel_id) ?? '—') : null
  const estudio = ctx.mostrarEstudio && t.estudio_id != null ? ctx.nomeEstudio.get(t.estudio_id) : null
  const parada = !t.prazo && !feita && idade > DIAS_TAREFA_PARADA

  return (
    <EditarComBotaoDireito id={t.id} className={`flex items-start gap-3 px-3 py-2.5 ${COLUNAS_LISTA}`}>
      <ConcluirTarefa id={t.id} titulo={t.titulo} voltar={ctx.voltar} feita={feita} pessoas={ctx.pessoas} euId={ctx.euId} />

      {/* Tarefa */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AbrirTarefa id={t.id} className={`text-sm font-semibold text-foreground hover:underline ${feita ? 'line-through opacity-60' : ''}`}>
            {t.prioridade && (
              <Flag
                className={`mr-1.5 inline h-3.5 w-3.5 -translate-y-px ${COR_PRIORIDADE[t.prioridade]}`}
                fill="currentColor"
                aria-label={NOME_PRIORIDADE[t.prioridade]}
              />
            )}
            {t.titulo}
          </AbrirTarefa>
          {t.estado === 'em_curso' && (
            <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">
              Em curso
            </span>
          )}
          {passos && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted" title="Passos feitos">
              <ListChecks className="h-3 w-3" /> {passos.feitos}/{passos.total}
            </span>
          )}
          {t.etiquetas.map((e) => (
            <span key={e} className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-foreground">
              {e}
            </span>
          ))}
          {t.reservada && (
            <span title="Só a administração vê esta tarefa">
              <Lock className="h-3 w-3 text-muted" aria-label="Só administração" />
            </span>
          )}
        </div>
        {t.descricao && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{t.descricao}</p>}
        {/* Telemóvel: o resto da informação numa linha por baixo. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted lg:hidden">
          <Prazo t={t} hoje={ctx.hoje} completo />
          {parada && <span className="font-semibold text-amber-700 dark:text-amber-300">parada {haQuantoTempo(idade)}</span>}
          {repete && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" /> {repete}
            </span>
          )}
          {t.lista && <span>{t.lista}</span>}
          {estudio && <span>{estudio}</span>}
          {quem && <span>{feita ? `feita por ${quem.split(' ')[0]}` : quem.split(' ')[0]}</span>}
        </div>
      </div>

      {/* Colunas (computador) */}
      <div className="hidden lg:block">
        {t.prazo ? (
          <Prazo t={t} hoje={ctx.hoje} completo />
        ) : (
          <span className={`text-[11px] ${parada ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted'}`}>
            {feita ? '—' : parada ? `parada ${haQuantoTempo(idade)}` : `criada ${haQuantoTempo(idade)}`}
          </span>
        )}
      </div>
      <div className="hidden min-w-0 text-xs text-muted lg:block">
        {repete ? (
          <span className="flex items-center gap-1" title={repete}>
            <Repeat className="h-3 w-3 shrink-0" /> <span className="truncate">{repete}</span>
          </span>
        ) : (
          '—'
        )}
      </div>
      <div className="hidden min-w-0 text-xs text-muted lg:block">
        <span className="block truncate text-foreground">{t.lista ?? '—'}</span>
        {estudio && <span className="block truncate">{estudio}</span>}
      </div>
      <div className="hidden min-w-0 text-xs lg:block">
        {quem ? (
          <span className="block truncate text-foreground" title={feita ? `Feita por ${quem}` : `Responsável: ${quem}`}>
            {feita && <Check className="mr-1 inline h-3 w-3 text-emerald-600" strokeWidth={3} />}
            {quem.split(' ')[0]}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {!feita && (
          <>
            <EstadoForm id={t.id} estado={t.estado === 'em_curso' ? 'por_fazer' : 'em_curso'} voltar={ctx.voltar}>
              <button type="submit" className={botaoPequenoCls} title={t.estado === 'em_curso' ? 'Voltar a "por fazer"' : 'Marcar como em curso'}>
                {t.estado === 'em_curso' ? 'Parar' : 'Começar'}
              </button>
            </EstadoForm>
            <form action={alternarFocoTarefa}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="voltar" value={ctx.voltar} />
              <button
                type="submit"
                title={foco ? 'Tirar do foco da semana' : 'Pôr no foco desta semana'}
                aria-label={foco ? `Tirar do foco: ${t.titulo}` : `Pôr no foco da semana: ${t.titulo}`}
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  foco ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted hover:border-brand hover:text-foreground'
                }`}
              >
                <Star className="h-3.5 w-3.5" fill={foco ? 'currentColor' : 'none'} />
              </button>
            </form>
          </>
        )}
      </div>
    </EditarComBotaoDireito>
  )
}
