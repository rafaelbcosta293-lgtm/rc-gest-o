import Link from '@/components/LinkRapido'
import { Check, Lock, Repeat, Star } from 'lucide-react'
import { descricaoRepeticao, DIAS_TAREFA_PARADA, emFoco, haQuantoTempo, idadeEmDias, type Tarefa } from '@/lib/data/tarefas'
import { alternarFocoTarefa, mudarEstadoTarefa } from '@/app/painel/tarefasActions'

// Peças partilhadas pelas várias vistas das Tarefas (lista, quadro,
// calendário…). Só cores do tema e variantes "dark:", para servirem nas
// áreas claras e na escura.

export const campoCls =
  'w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-brand'
export const rotuloCls = 'flex flex-col gap-1 text-xs font-medium text-muted'
export const pastilhaCls = 'inline-flex items-center gap-1 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-muted'
export const botaoPequenoCls =
  'rounded-full border border-border-subtle px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-brand/[.08]'

export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export type Contexto = {
  hoje: string
  voltar: string
  nomePessoa: Map<string, string>
  nomeEstudio: Map<number, string>
  linkEditar: (id: string) => string
}

export function EstadoForm({ id, estado, voltar, children, className }: { id: string; estado: string; voltar: string; children: React.ReactNode; className?: string }) {
  return (
    <form action={mudarEstadoTarefa} className={className}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <input type="hidden" name="voltar" value={voltar} />
      {children}
    </form>
  )
}

export function Pastilhas({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  const atrasada = t.estado !== 'feito' && !!t.prazo && t.prazo < ctx.hoje
  const paraHoje = t.estado !== 'feito' && t.prazo === ctx.hoje
  const idade = idadeEmDias(t.criado_em, ctx.hoje)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {t.prazo && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
            atrasada
              ? 'bg-red-500/15 text-red-700 dark:text-red-300'
              : paraHoje
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                : 'bg-foreground/[.06] text-muted'
          }`}
        >
          {atrasada ? 'Atrasada · ' : paraHoje ? 'Hoje · ' : ''}
          {dataCurta(t.prazo)}
        </span>
      )}
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
      {descricaoRepeticao(t) && (
        <span className={pastilhaCls} title="Ao concluir, volta a aparecer no dia seguinte em que se faz">
          <Repeat className="h-3 w-3" /> {descricaoRepeticao(t)}
        </span>
      )}
      <span className={pastilhaCls}>{t.responsavel_id ? (ctx.nomePessoa.get(t.responsavel_id) ?? 'Sem responsável') : 'Sem responsável'}</span>
      {t.lista && <span className={pastilhaCls}>{t.lista}</span>}
      {t.estudio_id != null && ctx.nomeEstudio.get(t.estudio_id) && <span className={pastilhaCls}>{ctx.nomeEstudio.get(t.estudio_id)}</span>}
      {t.reservada && (
        <span className={pastilhaCls} title="Só a administração vê esta tarefa">
          <Lock className="h-3 w-3" /> Só administração
        </span>
      )}
    </div>
  )
}

export function LinhaTarefa({ t, ctx }: { t: Tarefa; ctx: Contexto }) {
  const feita = t.estado === 'feito'
  const foco = emFoco(t, ctx.hoje)
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <EstadoForm id={t.id} estado={feita ? 'por_fazer' : 'feito'} voltar={ctx.voltar} className="mt-0.5 shrink-0">
        <button
          type="submit"
          title={feita ? 'Voltar a abrir' : 'Concluir'}
          aria-label={feita ? `Voltar a abrir: ${t.titulo}` : `Concluir: ${t.titulo}`}
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
            feita ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border-strong text-transparent hover:border-emerald-600 hover:text-emerald-600'
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      </EstadoForm>
      <div className="min-w-0 flex-1">
        <Link href={ctx.linkEditar(t.id)} className={`text-sm font-semibold text-foreground hover:underline ${feita ? 'line-through opacity-60' : ''}`}>
          {t.titulo}
        </Link>
        {t.descricao && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted">{t.descricao}</p>}
        <Pastilhas t={t} ctx={ctx} />
      </div>
      {!feita && (
        <div className="flex shrink-0 items-center gap-1.5">
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
        </div>
      )}
    </li>
  )
}

