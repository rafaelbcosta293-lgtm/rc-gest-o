import Link from '@/components/LinkRapido'
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaBloqueada } from '@/lib/data/gate'
import {
  CHAVE_SERVICO_VIRTUAIS,
  agruparPorCategoria,
  duracaoPorExtenso,
  ligacaoYoutube,
  miniaturaYoutube,
  type AulaVirtual,
} from '@/lib/data/aulasVirtuais'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import ApagarComConfirmacao from '@/components/ApagarComConfirmacao'
import { desbloquearCoordenacao } from '../actions'
import { apagarAulaVirtual, moverAulaVirtual, publicarAulaVirtual } from './actions'
import FormAulaVirtual from './FormAulaVirtual'

const ROTA = '/painel/coordenacao/aulas-virtuais'

const MENSAGENS_OK: Record<string, string> = {
  criada: 'Aula adicionada como rascunho — ainda não aparece na app dos clientes.',
  'criada-publicada': 'Aula adicionada e publicada — chega à app dos clientes dentro de instantes.',
  guardada: 'Alterações guardadas.',
  publicada: 'Aula publicada — chega à app dos clientes dentro de instantes.',
  escondida: 'Aula escondida — deixa de aparecer na app dos clientes.',
  apagada: 'Aula apagada.',
}

const botaoIcone =
  'flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle text-muted hover:bg-brand/[.08] hover:text-foreground disabled:opacity-30 pointer-coarse:h-10 pointer-coarse:w-10'

// Aulas virtuais: a biblioteca de aulas em vídeo que os clientes com o
// serviço "Aulas Virtuais" veem na app do cliente. Aqui a Coordenação
// acrescenta vídeos (ligação do YouTube), organiza-os por categoria,
// publica-os ou esconde-os.
export default async function AulasVirtuaisPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; ok?: string; error?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  if (await areaBloqueada(supabase, 'coordenacao')) {
    return <PortaSenha titulo="Coordenação — Aulas virtuais" destino={ROTA} action={desbloquearCoordenacao} erro={sp.erroSenha} />
  }

  const [{ data: aulasData, error }, { data: servico }] = await Promise.all([
    supabase.from('aulas_virtuais').select('*').order('ordem').order('criado_em'),
    supabase.from('servicos').select('id, nome, ativo').eq('chave', CHAVE_SERVICO_VIRTUAIS).maybeSingle(),
  ])
  if (error) throw new Error(error.message)
  const aulas = (aulasData ?? []) as AulaVirtual[]
  const grupos = agruparPorCategoria(aulas)
  const categorias = grupos.map((g) => g.categoria)
  const publicadas = aulas.filter((a) => a.publicada).length

  // Quem tem o serviço, e destes quantos já usam a app do cliente.
  const [{ data: inscritos }, { count: planos }] = servico
    ? await Promise.all([
        supabase.from('clientes_servicos').select('cliente_id, estado').eq('servico_id', servico.id).neq('estado', 'Inativo'),
        supabase.from('planos').select('id', { count: 'exact', head: true }).eq('servico_id', servico.id).eq('ativo', true),
      ])
    : [{ data: [] }, { count: 0 }]
  const ativos = (inscritos ?? []).filter((i) => i.estado === 'Ativo').map((i) => i.cliente_id as string)
  const pendentes = (inscritos ?? []).filter((i) => i.estado !== 'Ativo').length
  const { count: comApp } = ativos.length
    ? await supabase.from('app_clientes_contas').select('cliente_id', { count: 'exact', head: true }).in('cliente_id', ativos).eq('ativa', true)
    : { count: 0 }

  const cartoes = [
    { valor: publicadas, rotulo: 'Aulas publicadas' },
    { valor: aulas.length - publicadas, rotulo: 'Rascunhos (escondidas)' },
    { valor: ativos.length, rotulo: 'Clientes com o serviço em dia' },
    { valor: comApp ?? 0, rotulo: 'Destes, com a app ativa' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/painel/coordenacao" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Resumo
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Aulas virtuais</h1>
      <p className="mt-1 text-sm text-muted">
        Aulas em vídeo que os clientes com o serviço «{servico?.nome ?? 'Aulas Virtuais'}» veem na app do cliente, quando quiserem.
      </p>

      {sp.error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p>}
      {sp.ok && MENSAGENS_OK[sp.ok] && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{MENSAGENS_OK[sp.ok]}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-xl border border-border-subtle bg-surface p-3 shadow-card">
            <strong className="block text-2xl text-foreground">{c.valor}</strong>
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">{c.rotulo}</span>
          </div>
        ))}
      </div>
      {pendentes > 0 && (
        <p className="mt-2 text-xs text-muted">
          Há mais {pendentes} cliente(s) com o serviço à espera de pagamento — só veem as aulas depois de o pagamento estar em dia.
        </p>
      )}
      {servico && !planos && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Ainda não há nenhum plano de preço para as Aulas Virtuais. Crie pelo menos um em Administração → Serviços / Produtos → Planos
          (escolhendo o serviço «{servico.nome}»), para se poderem registar os pagamentos.
        </p>
      )}

      <details className="mt-4 rounded-xl border border-border-subtle bg-surface p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">Como funciona</summary>
        <div className="mt-2 grid gap-4 text-muted sm:grid-cols-2">
          <div>
            <p className="font-semibold text-foreground">Pôr uma aula</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Carregue o vídeo no YouTube com a visibilidade «Não listado».</li>
              <li>No vídeo, carregue em «Partilhar» e copie a ligação.</li>
              <li>Cole-a aqui em «Nova aula», dê-lhe um título e uma categoria.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-foreground">Dar acesso a um cliente</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Na ficha do cliente, em Editar, assinale o serviço «{servico?.nome ?? 'Aulas Virtuais'}».</li>
              <li>Registe o pagamento de um plano desse serviço.</li>
              <li>Convide-o para a app do cliente (na ficha), se ainda não a tiver.</li>
            </ol>
          </div>
        </div>
      </details>

      <details open={aulas.length === 0} className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">+ Nova aula</summary>
        <div className="mt-3">
          <FormAulaVirtual categorias={categorias} />
        </div>
      </details>

      {aulas.length === 0 && <p className="mt-6 text-sm text-muted">Ainda não há aulas. Acrescente a primeira em cima.</p>}

      {grupos.map((g) => (
        <section key={g.categoria} className="mt-8">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
            {g.categoria} · {g.aulas.length}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {g.aulas.map((a, i) => (
              <li key={a.id} className={`rounded-xl border border-border-subtle bg-surface p-3 shadow-card ${a.publicada ? '' : 'opacity-80'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={ligacaoYoutube(a.youtube_id)} target="_blank" rel="noreferrer" title="Abrir no YouTube" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- capa servida pelo YouTube */}
                    <img src={miniaturaYoutube(a.youtube_id)} alt="" loading="lazy" className="aspect-video w-32 rounded-lg border border-border-subtle object-cover" />
                  </a>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold text-foreground">{a.titulo}</p>
                    <p className="text-xs text-muted">
                      {[a.nivel ?? 'Para todos', duracaoPorExtenso(a.duracao_min)].filter(Boolean).join(' · ')}
                    </p>
                    {a.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted">{a.descricao}</p>}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      a.publicada ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {a.publicada ? 'Publicada' : 'Rascunho'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <form action={moverAulaVirtual}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="sentido" value="cima" />
                      <SubmitButton pendingText="" disabled={i === 0} className={botaoIcone} aria-label={`Subir «${a.titulo}»`} title="Subir">
                        <ArrowUp className="h-4 w-4" />
                      </SubmitButton>
                    </form>
                    <form action={moverAulaVirtual}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="sentido" value="baixo" />
                      <SubmitButton pendingText="" disabled={i === g.aulas.length - 1} className={botaoIcone} aria-label={`Descer «${a.titulo}»`} title="Descer">
                        <ArrowDown className="h-4 w-4" />
                      </SubmitButton>
                    </form>
                    <form action={publicarAulaVirtual}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="publicar" value={a.publicada ? '0' : '1'} />
                      <SubmitButton
                        pendingText="…"
                        className="gap-1 rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold hover:bg-brand/[.08] pointer-coarse:py-2.5 pointer-coarse:text-sm"
                      >
                        {a.publicada ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {a.publicada ? 'Esconder' : 'Publicar'}
                      </SubmitButton>
                    </form>
                    <ApagarComConfirmacao
                      action={apagarAulaVirtual}
                      confirmacao={`Apagar a aula «${a.titulo}»? Deixa de aparecer na app dos clientes. (O vídeo continua no YouTube.)`}
                      campos={{ id: a.id }}
                      ariaLabel={`Apagar «${a.titulo}»`}
                      className={`${botaoIcone} hover:!bg-red-50 hover:!text-red-700 dark:hover:!bg-red-950`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </ApagarComConfirmacao>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">Editar</summary>
                  <div className="mt-3">
                    <FormAulaVirtual aula={a} categorias={categorias} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
