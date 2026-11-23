'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { GrelhaInterativa, NIVEIS_ZOOM, ZOOM_INICIAL, type AulaNaAgenda, type EventoComNomes } from '../agenda/AgendaInterativa'
import { criarAulaRapida } from './actions'
import { useEdicaoAulas } from './useEdicaoAulas'

export type ServicoDoMapa = { id: number; nome: string; lotacao: number | null; duracao: number }

const SEM_TREINOS: Record<string, EventoComNomes[]> = {}
const nada = () => {}
const DURACOES = [30, 45, 50, 60, 90]

// O mapa de aulas: a semana numa grelha de horas, igual à da Agenda dos
// treinos — arrastar uma aula muda-a de hora ou de dia, puxar o topo ou
// o fundo estica-a, clicar num espaço vazio cria uma aula. Numa aula que
// se repete, cada mudança pergunta se é só para essa, para essa e as
// seguintes, ou para todas (ver useEdicaoAulas).
export default function MapaAulas({
  slug,
  estudioId,
  dias,
  hoje,
  aulas,
  diasFechados,
  servicos,
  equipa,
  podeEscrever,
  ehGestao,
}: {
  slug: string
  estudioId: number
  dias: string[]
  hoje: string
  aulas: AulaNaAgenda[]
  diasFechados: Record<string, string>
  servicos: ServicoDoMapa[]
  equipa: { id: string; nome: string }[]
  podeEscrever: boolean
  ehGestao: boolean
}) {
  const router = useRouter()
  const [zoomIndice, setZoomIndice] = useState(ZOOM_INICIAL)
  const [nova, setNova] = useState<{ data: string; horaInicio: string; duracaoMin: number } | null>(null)
  const edicao = useEdicaoAulas({ slug, aulas, diasFechados, ehGestao })

  const diaOmissao = hoje >= dias[0] && hoje <= dias[dias.length - 1] ? hoje : dias[0]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {podeEscrever
            ? 'Arrasta uma aula para a mudar de hora ou de dia; clica num espaço vazio para criar uma.'
            : 'A tua conta só pode ver as aulas.'}
        </p>
        <div className="flex items-center gap-1.5">
          {/* A ajuda e o zoom da grelha vêm parar aqui. */}
          <div id="agenda-ferramentas" className="flex items-center gap-1.5" />
          {podeEscrever && servicos.length > 0 && (
            <button
              type="button"
              onClick={() => setNova({ data: diaOmissao, horaInicio: '19:00', duracaoMin: 0 })}
              className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-black hover:bg-brand-strong pointer-coarse:px-4 pointer-coarse:py-2 pointer-coarse:text-sm"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Aula
            </button>
          )}
        </div>
      </div>

      {edicao.erro && (
        <div
          role="alert"
          className="mt-1.5 flex items-start justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          <span>{edicao.erro}</span>
          <button type="button" onClick={edicao.limparErro} className="shrink-0 text-xs font-semibold underline">
            Fechar
          </button>
        </div>
      )}

      <div className={edicao.aGravar ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <GrelhaInterativa
          dias={dias}
          estudioId={estudioId}
          diasFechados={diasFechados}
          aulas={aulas}
          porDia={SEM_TREINOS}
          onMover={nada}
          onRedimensionar={nada}
          onAbrirEvento={nada}
          onClickVazio={(dia, horaInicio, duracaoMin) => {
            if (servicos.length > 0) setNova({ data: dia, horaInicio, duracaoMin })
          }}
          onMoverAula={edicao.moverAula}
          onRedimensionarAula={edicao.redimensionarAula}
          onAbrirAula={(a) => router.push(a.href, { scroll: false })}
          pxPorMinuto={NIVEIS_ZOOM[zoomIndice]}
          zoomIndice={zoomIndice}
          onZoomIndiceChange={setZoomIndice}
          somenteLeitura={!podeEscrever}
          duracaoClique={0}
          mapaDeAulas
          classeAltura="h-[68vh] min-h-[420px]"
        />
      </div>

      {edicao.dialogo}

      {nova && (
        <NovaAula
          key={`${nova.data}-${nova.horaInicio}-${nova.duracaoMin}`}
          slug={slug}
          estudioId={estudioId}
          inicial={nova}
          servicos={servicos}
          equipa={equipa}
          ehGestao={ehGestao}
          onFechar={() => setNova(null)}
          onCriada={() => {
            setNova(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

const campoCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-brand pointer-coarse:py-2.5 pointer-coarse:text-base'
const rotuloCls = 'flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted'

// A janela de criar uma aula a partir do mapa: o dia e a hora vêm do
// sítio onde se clicou; escolhe-se o serviço e se a aula é só desse dia
// ou se repete todas as semanas (entra no horário semanal).
function NovaAula({
  slug,
  estudioId,
  inicial,
  servicos,
  equipa,
  ehGestao,
  onFechar,
  onCriada,
}: {
  slug: string
  estudioId: number
  inicial: { data: string; horaInicio: string; duracaoMin: number }
  servicos: ServicoDoMapa[]
  equipa: { id: string; nome: string }[]
  ehGestao: boolean
  onFechar: () => void
  onCriada: () => void
}) {
  const [aGravar, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [servicoId, setServicoId] = useState(servicos[0].id)
  const servico = servicos.find((s) => s.id === servicoId) ?? servicos[0]
  // Duração: a que se arrastou na grelha; num clique simples (0), a
  // habitual do serviço — e acompanha a troca de serviço enquanto não se
  // mexer nela à mão.
  const [duracao, setDuracao] = useState(inicial.duracaoMin > 0 ? String(inicial.duracaoMin) : '')
  const duracaoEfetiva = duracao === '' ? servico.duracao : Number(duracao)
  const [repete, setRepete] = useState(ehGestao)

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onFechar])

  function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const lotacao = Number(f.get('lotacao'))
    setErro(null)
    iniciar(async () => {
      const r = await criarAulaRapida({
        estudioSlug: slug,
        estudioId,
        servicoId,
        data: f.get('data') as string,
        horaInicio: f.get('hora_inicio') as string,
        duracaoMin: duracaoEfetiva,
        lotacao: Number.isInteger(lotacao) && lotacao > 0 ? lotacao : null,
        instrutorId: (f.get('instrutor_id') as string) || null,
        repete,
        ate: repete ? (f.get('ate') as string) || null : null,
      })
      if ('error' in r) setErro(r.error)
      else onCriada()
    })
  }

  const segmento = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-2.5 pointer-coarse:text-sm ${
      ativo ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nova aula"
        className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-4 shadow-pop pointer-coarse:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">Nova aula</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground pointer-coarse:h-10 pointer-coarse:w-10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {erro && <p role="alert" className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}

        <form onSubmit={submeter} className="mt-3 flex flex-col gap-3">
          <fieldset disabled={aGravar} className={`flex min-w-0 flex-col gap-3 ${aGravar ? 'opacity-60' : ''}`}>
            {servicos.length > 1 ? (
              <div className="grid gap-1 rounded-full bg-border-subtle p-1" style={{ gridTemplateColumns: `repeat(${servicos.length}, minmax(0, 1fr))` }}>
                {servicos.map((s) => (
                  <button key={s.id} type="button" aria-pressed={s.id === servicoId} onClick={() => setServicoId(s.id)} className={segmento(s.id === servicoId)}>
                    {s.nome}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-foreground">{servico.nome}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className={rotuloCls}>
                Dia
                <input name="data" type="date" required defaultValue={inicial.data} className={campoCls} />
              </label>
              <label className={rotuloCls}>
                Hora
                <input name="hora_inicio" type="time" required defaultValue={inicial.horaInicio} className={campoCls} />
              </label>
            </div>

            <label className={rotuloCls}>
              Duração (min)
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={240}
                required
                value={duracao === '' ? servico.duracao : duracao}
                onChange={(e) => setDuracao(e.target.value)}
                className={campoCls}
              />
            </label>
            <div className="-mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Durações mais usadas">
              {DURACOES.map((min) => {
                const ativa = duracaoEfetiva === min
                return (
                  <button
                    key={min}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => setDuracao(String(min))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors pointer-coarse:px-3.5 pointer-coarse:py-2 pointer-coarse:text-sm ${
                      ativa ? 'border-brand bg-brand text-black' : 'border-border-subtle text-muted hover:border-border-strong hover:text-foreground'
                    }`}
                  >
                    {min === 60 ? '1 h' : `${min} min`}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className={rotuloCls}>
                Lotação
                <input
                  name="lotacao"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  placeholder={servico.lotacao ? `${servico.lotacao} (a do serviço)` : 'lugares'}
                  required={!servico.lotacao}
                  className={campoCls}
                />
              </label>
              <label className={rotuloCls}>
                Instrutor
                <select name="instrutor_id" defaultValue="" className={campoCls}>
                  <option value="">—</option>
                  {equipa.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Repetição</span>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-border-subtle p-1">
                <button type="button" aria-pressed={!repete} onClick={() => setRepete(false)} className={segmento(!repete)}>
                  Só neste dia
                </button>
                <button type="button" aria-pressed={repete} disabled={!ehGestao} onClick={() => setRepete(true)} className={segmento(repete)}>
                  Todas as semanas
                </button>
              </div>
              {!ehGestao && <p className="text-xs text-muted">Só a gestão pode pôr aulas a repetir todas as semanas.</p>}
            </div>

            {repete && (
              <label className={rotuloCls}>
                Repetir até (vazio = sem fim)
                <input name="ate" type="date" className={campoCls} />
              </label>
            )}
          </fieldset>

          <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-full border border-border-strong px-4 py-2 text-xs font-semibold hover:bg-brand/[.08] pointer-coarse:py-2.5 pointer-coarse:text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={aGravar}
              className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-strong disabled:opacity-60 pointer-coarse:py-2.5 pointer-coarse:text-sm"
            >
              {aGravar ? 'A criar…' : 'Criar aula'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
