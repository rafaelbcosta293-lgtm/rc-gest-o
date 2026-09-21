import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { idadeEm, fmtDiaMes, preencherMensagem, proximoAniversario } from '@/lib/data/aniversarios'
import { fmt, MESES } from '@/lib/data/presencas'
import { marcarEnviado, desfazerEnvio, guardarConfigAniversario } from './actions'
import SubmitButton from '@/components/SubmitButton'
import CopiarTexto from '@/components/CopiarTexto'
import type { EnvioAniversario } from '@/lib/supabase/database.types'

type ClienteAniversario = {
  id: string
  nome: string
  nascimento: string
  estado: string
}

const DIAS_SEMANA_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Segunda = 0 … Domingo = 6, para alinhar com o resto da app (Horários).
function diaSemanaSegundaPrimeiro(data: Date) {
  return (data.getDay() + 6) % 7
}

function Calendario({
  slug,
  ano,
  mes,
  porDia,
  hoje,
}: {
  slug: string
  ano: number
  mes: number
  porDia: Map<number, { nome: string; idade: number }[]>
  hoje: Date
}) {
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const offset = diaSemanaSegundaPrimeiro(new Date(ano, mes - 1, 1))
  const celulas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  const ehHoje = (dia: number) =>
    hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes && hoje.getDate() === dia

  const anoAnterior = mes === 1 ? ano - 1 : ano
  const mesAnteriorNum = mes === 1 ? 12 : mes - 1
  const anoSeguinte = mes === 12 ? ano + 1 : ano
  const mesSeguinteNum = mes === 12 ? 1 : mes + 1

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/painel/${slug}/clientes/aniversarios?mes=${anoAnterior}-${String(mesAnteriorNum).padStart(2, '0')}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          ← {MESES[mesAnteriorNum - 1].slice(0, 3)}
        </Link>
        <strong className="text-sm text-black dark:text-zinc-50">
          {MESES[mes - 1]} {ano}
        </strong>
        <Link
          href={`/painel/${slug}/clientes/aniversarios?mes=${anoSeguinte}-${String(mesSeguinteNum).padStart(2, '0')}`}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          {MESES[mesSeguinteNum - 1].slice(0, 3)} →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-500">
        {DIAS_SEMANA_CURTOS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celulas.map((dia, i) => (
          <div
            key={i}
            className={`min-h-[72px] rounded-md border p-1 text-left align-top ${
              dia === null
                ? 'border-transparent'
                : ehHoje(dia)
                  ? 'border-teal-400 bg-teal-50 dark:bg-teal-950'
                  : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950'
            }`}
          >
            {dia !== null && (
              <>
                <span className="text-[11px] text-zinc-400">{dia}</span>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {(porDia.get(dia) ?? []).map((c) => (
                    <span
                      key={c.nome}
                      className="truncate rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      title={`${c.nome} · faz ${c.idade} anos`}
                    >
                      🎂 {c.nome}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function AniversariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ estudio: string }>
  searchParams: Promise<{ error?: string; vista?: string; mes?: string }>
}) {
  const { estudio: slug } = await params
  const { error, vista, mes: mesParam } = await searchParams
  const agora = new Date()
  const anoAtual = agora.getFullYear()
  // Calendário é a vista principal — só passa a lista se pedirem
  // explicitamente "?vista=lista".
  const vistaCalendario = vista !== 'lista'
  const anoCal = mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear()
  const mesCal = mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1

  const supabase = await createClient()
  const [estudio, sessao] = await Promise.all([getEstudioPorSlug(supabase, slug), getSessaoAtual()])
  if (!estudio) {
    notFound()
  }
  const { ehGestao } = papeisDaSessao(sessao)

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

  const porDia = new Map<number, { nome: string; idade: number }[]>()
  for (const c of clientes) {
    const [anoNasc, mesNasc, diaNasc] = c.nascimento.split('-').map(Number)
    if (mesNasc !== mesCal) continue
    const idade = anoCal - anoNasc
    const lista = porDia.get(diaNasc) ?? []
    lista.push({ nome: c.nome, idade })
    porDia.set(diaNasc, lista)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/painel/${slug}/clientes`}
        className="text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        ← Clientes
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-black dark:text-zinc-50">
        Aniversários
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {estudio.nome} · a mensagem já vem pronta a copiar — envia por onde costumas falar com
        cada pessoa e marca como enviado.
      </p>

      <div className="mt-4 flex gap-1.5">
        <Link
          href={`/painel/${slug}/clientes/aniversarios`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            vistaCalendario
              ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
              : 'border-black/10 text-zinc-600 dark:border-white/10 dark:text-zinc-400'
          }`}
        >
          Calendário
        </Link>
        <Link
          href={`/painel/${slug}/clientes/aniversarios?vista=lista`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            !vistaCalendario
              ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
              : 'border-black/10 text-zinc-600 dark:border-white/10 dark:text-zinc-400'
          }`}
        >
          Lista
        </Link>
      </div>

      {vistaCalendario && (
        <Calendario slug={slug} ano={anoCal} mes={mesCal} porDia={porDia} hoje={agora} />
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!vistaCalendario && (
      <>
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
      </>
      )}

      {ehGestao && (
        <details className="mt-10 rounded-xl border border-black/10 dark:border-white/10">
          <summary className="flex cursor-pointer items-center gap-1.5 p-4 text-xs font-semibold uppercase tracking-wider text-[#5B3FA0]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3FA0]" />
            Editar mensagens
          </summary>
          <div className="flex flex-col gap-4 border-t border-black/10 p-4 dark:border-white/10">
            <p className="text-xs text-zinc-500">
              Usa <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{'{nome}'}</code> onde
              quiseres que apareça o nome da pessoa.
            </p>
            <form action={guardarConfigAniversario} className="flex flex-col gap-1.5">
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="chave" value="msg_aniversario" />
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Mensagem para clientes ativos
              </label>
              <textarea
                name="valor"
                defaultValue={msgAtiva}
                rows={3}
                className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
              />
              <SubmitButton
                pendingText="…"
                className="self-start rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Guardar
              </SubmitButton>
            </form>
            <form action={guardarConfigAniversario} className="flex flex-col gap-1.5">
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="chave" value="msg_aniversario_ex" />
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Mensagem para ex-clientes
              </label>
              <textarea
                name="valor"
                defaultValue={msgExCliente}
                rows={3}
                className="rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/10 dark:bg-zinc-900"
              />
              <SubmitButton
                pendingText="…"
                className="self-start rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Guardar
              </SubmitButton>
            </form>
          </div>
        </details>
      )}
    </div>
  )
}
