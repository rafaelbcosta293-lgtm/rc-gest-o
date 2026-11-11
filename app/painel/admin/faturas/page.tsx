import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEstudios, filtrarPorEstudio } from '@/lib/data/estudios'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { fmt } from '@/lib/data/presencas'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { listarProdutos, listarMetodosPagamento, type ProdutoZsgo, type MetodoPagamentoZsgo } from '@/lib/zsgo'
import { totalRascunho, type EstadoPedidoFatura, type RascunhoFatura } from '@/lib/data/faturas'
import FaturaEditor from './FaturaEditor'
import {
  guardarRascunhoFatura,
  emitirPedidoFatura,
  rejeitarPedidoFatura,
  desbloquearPedidoFatura,
} from './actions'

// A emissão (ação desta página) fala com o ZS Go: dá-lhe margem.
export const maxDuration = 60

type PedidoRow = {
  id: string
  estado: EstadoPedidoFatura
  rascunho: RascunhoFatura
  nota_pedido: string | null
  pedido_em: string
  resolvido_em: string | null
  motivo_rejeicao: string | null
  ultimo_erro: string | null
  zsgo_numero: string | null
  zsgo_pdf_url: string | null
  estudio_id: number
  cliente_id: string
  pagamento: { valor: number; data_pagamento: string; metodo: string | null; anulado_em: string | null } | null
  pedido: { nome: string } | null
}

const SEPARADORES = [
  { chave: 'pendentes', label: 'Por validar', estados: ['pendente', 'erro', 'a_emitir'] },
  { chave: 'emitidas', label: 'Emitidas', estados: ['emitida'] },
  { chave: 'rejeitadas', label: 'Rejeitadas', estados: ['rejeitada'] },
] as const

const fmtEuro = (n: number) =>
  n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export default async function AdminFaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; estudio?: string; ver?: string; ok?: string; error?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Faturas"
        destino="/painel/admin/faturas"
        action={desbloquearAdmin}
        erro={sp.erroSenha}
      />
    )
  }

  const separador = SEPARADORES.find((s) => s.chave === sp.ver) ?? SEPARADORES[0]
  const estudios = filtrarPorEstudio(await getEstudios(supabase), sp.estudio)
  const nomeEstudio = new Map(estudios.map((e) => [e.id, e.nome]))
  const idsEstudios = estudios.map((e) => e.id)

  const [{ data, error }, { data: contagens }] = await Promise.all([
    idsEstudios.length
      ? supabase
          .from('pedidos_fatura')
          .select(
            'id, estado, rascunho, nota_pedido, pedido_em, resolvido_em, motivo_rejeicao, ultimo_erro, zsgo_numero, zsgo_pdf_url, estudio_id, cliente_id, pagamento:pagamentos(valor, data_pagamento, metodo, anulado_em), pedido:perfis!pedido_por(nome)'
          )
          .in('estudio_id', idsEstudios)
          .in('estado', [...separador.estados])
          .order('pedido_em', { ascending: separador.chave === 'pendentes' })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('pedidos_fatura').select('estado').in('estado', ['pendente', 'erro', 'a_emitir']),
  ])
  if (error) throw new Error(error.message)
  const pedidos = (data ?? []) as unknown as PedidoRow[]
  const nPendentes = contagens?.length ?? 0

  // Artigos e métodos de pagamento vêm do ZS Go — só são precisos para
  // editar pedidos por validar. Se a ligação falhar, o editor continua a
  // funcionar com campos de texto e mostra-se o erro.
  let produtos: ProdutoZsgo[] | null = null
  let metodos: MetodoPagamentoZsgo[] | null = null
  let erroLigacao: string | null = null
  if (separador.chave === 'pendentes' && pedidos.length > 0) {
    try {
      ;[produtos, metodos] = await Promise.all([listarProdutos(), listarMetodosPagamento()])
    } catch (e) {
      erroLigacao = e instanceof Error ? e.message : 'Erro desconhecido.'
    }
  }

  const qsEstudio = sp.estudio ? `&estudio=${sp.estudio}` : ''

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Faturas</h1>
      <p className="mt-1 text-sm text-muted">
        Pedidos feitos pela equipa no registo do pagamento. Nada é emitido sem validares aqui — revê e
        corrige o rascunho, depois emite no ZS Go (série API-20262) ou rejeita.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {SEPARADORES.map((s) => (
          <Link
            key={s.chave}
            href={`/painel/admin/faturas?ver=${s.chave}${qsEstudio}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              s.chave === separador.chave
                ? 'bg-brand text-black'
                : 'border border-border-subtle text-muted hover:text-foreground'
            }`}
          >
            {s.label}
            {s.chave === 'pendentes' && nPendentes > 0 ? ` (${nPendentes})` : ''}
          </Link>
        ))}
      </div>

      {sp.ok && (
        <p className="mt-4 rounded-md bg-teal-950 px-3 py-2 text-sm text-teal-300">{sp.ok}</p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{sp.error}</p>
      )}
      {erroLigacao && (
        <p className="mt-4 rounded-md bg-amber-950 px-3 py-2 text-sm text-amber-300">
          Não foi possível ler os artigos/métodos do ZS Go: {erroLigacao}
        </p>
      )}

      {pedidos.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          {separador.chave === 'pendentes' ? 'Não há pedidos de fatura por validar.' : 'Nada para mostrar.'}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {pedidos.map((p) => {
          const r = p.rascunho
          const valorPago = Number(p.pagamento?.valor ?? 0)
          const cabecalho = (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Link
                href={`/painel/${estudios.find((e) => e.id === p.estudio_id)?.slug ?? ''}/pagamentos/${p.cliente_id}`}
                className="text-base font-semibold text-foreground hover:underline"
              >
                {r.cliente.nome}
              </Link>
              <span className="text-xs text-muted">{nomeEstudio.get(p.estudio_id)}</span>
              <span className="text-xs text-muted">
                pago {p.pagamento ? fmt(p.pagamento.data_pagamento) : '—'} · {fmtEuro(valorPago)}
                {p.pagamento?.metodo ? ` · ${p.pagamento.metodo}` : ''}
              </span>
              <span className="text-xs text-muted">
                pedido por {p.pedido?.nome ?? '—'} em {fmt(p.pedido_em.slice(0, 10))}
              </span>
            </div>
          )

          if (separador.chave !== 'pendentes') {
            return (
              <div key={p.id} id={`pedido-${p.id}`} className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
                {cabecalho}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono">{fmtEuro(totalRascunho(r))}</span>
                  {p.estado === 'emitida' ? (
                    <>
                      <span className="font-semibold text-teal-400">{p.zsgo_numero ?? 'Emitida'}</span>
                      {p.zsgo_pdf_url && (
                        <a
                          href={p.zsgo_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted underline hover:text-foreground"
                        >
                          PDF <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {p.ultimo_erro && <span className="text-xs text-amber-400">Aviso: {p.ultimo_erro}</span>}
                    </>
                  ) : (
                    <span className="text-xs text-red-400">
                      Rejeitado{p.motivo_rejeicao ? `: ${p.motivo_rejeicao}` : ''}
                    </span>
                  )}
                  {p.resolvido_em && <span className="text-xs text-muted">em {fmt(p.resolvido_em.slice(0, 10))}</span>}
                </div>
              </div>
            )
          }

          return (
            <div key={p.id} id={`pedido-${p.id}`} className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
              {cabecalho}
              {p.nota_pedido && <p className="mt-1 text-xs text-amber-300">Nota da equipa: {p.nota_pedido}</p>}
              {p.pagamento?.anulado_em && (
                <p className="mt-2 rounded-md bg-red-950 px-3 py-2 text-xs text-red-300">
                  Atenção: este pagamento foi anulado depois do pedido.
                </p>
              )}
              {p.estado === 'erro' && p.ultimo_erro && (
                <p className="mt-2 rounded-md bg-red-950 px-3 py-2 text-xs text-red-300">Última tentativa falhou: {p.ultimo_erro}</p>
              )}

              {p.estado === 'a_emitir' ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-300">
                  A emitir no ZS Go… Se ficar preso aqui, confirma no ZS Go se a fatura foi criada.
                  <form action={desbloquearPedidoFatura}>
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton className="rounded-full border border-border-strong px-3 py-1 text-xs font-semibold">
                      Desbloquear
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <FaturaEditor
                      id={p.id}
                      rascunho={r}
                      valorPago={valorPago}
                      produtos={produtos}
                      metodos={metodos}
                      guardarAction={guardarRascunhoFatura}
                      emitirAction={emitirPedidoFatura}
                    />
                  </div>
                  <ConfirmarAcao
                    action={rejeitarPedidoFatura}
                    confirmacao={`Rejeitar o pedido de fatura de ${r.cliente.nome}? Não é emitida nenhuma fatura.`}
                    className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="motivo"
                      placeholder="Motivo (opcional, a equipa vê)"
                      className="w-64 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs dark:bg-zinc-900"
                    />
                    <SubmitButton
                      pendingText="…"
                      className="rounded-full border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950"
                    >
                      Rejeitar pedido
                    </SubmitButton>
                  </ConfirmarAcao>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
