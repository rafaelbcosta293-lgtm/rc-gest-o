import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { idadeEm, fmtDiaMes, preencherMensagem, proximoAniversario } from '@/lib/data/aniversarios'
import { fmt } from '@/lib/data/presencas'
import { marcarEnviado, desfazerEnvio } from './actions'
import SubmitButton from '@/components/SubmitButton'
import CopiarTexto from '@/components/CopiarTexto'
import type { EnvioAniversario } from '@/lib/supabase/database.types'

type ClienteAniversario = {
  id: string
  nome: string
  nascimento: string
  estado: string
}

export default async function AniversariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { estudio: slug } = await params
  const { error } = await searchParams
  const agora = new Date()
  const anoAtual = agora.getFullYear()

  const supabase = await createClient()
  const estudio = await getEstudioPorSlug(supabase, slug)
  if (!estudio) {
    notFound()
  }

  const [
    { data: clientesData, error: erroClientes },
    { data: configData },
    { data: enviosData, error: erroEnvios },
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nome, nascimento, estado')
      .eq('estudio_id', estudio.id)
      .not('nascimento', 'is', null),
    supabase.from('config').select('*').in('chave', ['msg_aniversario', 'msg_aniversario_ex']),
    supabase
      .from('envios_aniversario')
      .select('*, enviado:perfis!enviado_por(nome)')
      .eq('ano', anoAtual),
  ])

  if (erroClientes || erroEnvios) {
    throw new Error((erroClientes ?? erroEnvios)!.message)
  }

  const clientes = (clientesData ?? []) as ClienteAniversario[]
  const msgAtiva = configData?.find((c) => c.chave === 'msg_aniversario')?.valor ?? ''
  const msgExCliente = configData?.find((c) => c.chave === 'msg_aniversario_ex')?.valor ?? ''
  const envios = (enviosData ?? []) as unknown as (EnvioAniversario & {
    enviado: { nome: string } | null
  })[]
  const enviosPorCliente = new Map(envios.map((e) => [e.cliente_id, e]))

  const lista = clientes
    .map((c) => {
      const { data: dataProximo, dias } = proximoAniversario(c.nascimento, agora)
      const idade = idadeEm(c.nascimento, dataProximo)
      const template = c.estado === 'Ex-cliente' ? msgExCliente : msgAtiva
      return {
        cliente: c,
        dataProximo,
        dias,
        idade,
        mensagem: preencherMensagem(template, c.nome),
        envio: enviosPorCliente.get(c.id) ?? null,
      }
    })
    .sort((a, b) => a.dias - b.dias)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/painel/${slug}`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Voltar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Aniversários
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · a mensagem já vem pronta a copiar — envia por onde costumas falar com
        cada pessoa e marca como enviado.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {lista.map(({ cliente, dataProximo, dias, idade, mensagem, envio }) => (
          <div
            key={cliente.id}
            className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-sm text-black dark:text-zinc-50">
                  {cliente.nome}
                </strong>
                <span className="ml-2 text-xs text-zinc-500">
                  {fmtDiaMes(dataProximo)} · faz {idade} anos
                  {cliente.estado === 'Ex-cliente' && ' · ex-cliente'}
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  dias === 0
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                    : dias <= 7
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                }`}
              >
                {dias === 0 ? 'É hoje!' : dias === 1 ? 'Amanhã' : `em ${dias} dias`}
              </span>
            </div>

            {mensagem && (
              <p className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {mensagem}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {mensagem && (
                <CopiarTexto
                  texto={mensagem}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                />
              )}

              {envio ? (
                <>
                  <span className="text-xs text-teal-700 dark:text-teal-400">
                    ✓ Enviado em {fmt(envio.enviado_em)}
                    {envio.enviado?.nome && ` por ${envio.enviado.nome}`}
                  </span>
                  <form action={desfazerEnvio}>
                    <input type="hidden" name="estudio_slug" value={slug} />
                    <input type="hidden" name="id" value={envio.id} />
                    <SubmitButton
                      pendingText="…"
                      className="text-xs text-zinc-400 underline hover:text-red-600"
                    >
                      desfazer
                    </SubmitButton>
                  </form>
                </>
              ) : (
                <form action={marcarEnviado}>
                  <input type="hidden" name="estudio_slug" value={slug} />
                  <input type="hidden" name="cliente_id" value={cliente.id} />
                  <input type="hidden" name="ano" value={anoAtual} />
                  <SubmitButton
                    pendingText="…"
                    className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                  >
                    Marcar como enviado
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
          Nenhum cliente com data de nascimento registada.
        </div>
      )}
    </div>
  )
}
