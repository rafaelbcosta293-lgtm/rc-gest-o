import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEstudioPorSlug } from '@/lib/data/estudios'
import { getSessaoAtual, papeisDaSessao } from '@/lib/data/sessao'
import { idadeEm, fmtDiaMes, preencherMensagem, proximoAniversario } from '@/lib/data/aniversarios'
import { fmt, MESES } from '@/lib/data/presencas'
import { marcarEnviado, desfazerEnvio, guardarConfigAniversario, reenviarAniversariosPendentes } from './actions'
import SubmitButton from '@/components/SubmitButton'
import CopiarTexto from '@/components/CopiarTexto'
import ConfigAniversarioForm from './ConfigAniversarioForm'
import type { EnvioAniversario, EstadoSmsGateway } from '@/lib/supabase/database.types'

type ClienteAniversario = {
  id: string
  nome: string
  nascimento: string
  estado: string
  genero: 'Masculino' | 'Feminino' | null
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
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
        >
          ← {MESES[mesAnteriorNum - 1].slice(0, 3)}
        </Link>
        <strong className="text-sm text-foreground">
          {MESES[mes - 1]} {ano}
        </strong>
        <Link
          href={`/painel/${slug}/clientes/aniversarios?mes=${anoSeguinte}-${String(mesSeguinteNum).padStart(2, '0')}`}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm"
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
                  : 'border-border-subtle bg-surface'
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
  searchParams: Promise<{
    error?: string
    vista?: string
    mes?: string
    reenvioEnviados?: string
    reenvioFalhas?: string
    reenvioPendentes?: string
    reenvioOffline?: string
  }>
}) {
  const { estudio: slug } = await params
  const { error, vista, mes: mesParam, reenvioEnviados, reenvioFalhas, reenvioPendentes, reenvioOffline } =
    await searchParams
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
    { data: estadoGatewayData, error: erroEstadoGateway },
  ] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nome, nascimento, estado, genero')
      .eq('estudio_id', estudio.id)
      .not('nascimento', 'is', null),
    supabase.from('config').select('*').in('chave', ['msg_aniversario', 'msg_aniversario_ex']),
    supabase
      .from('envios_aniversario')
      .select('*, enviado:perfis!enviado_por(nome)')
      .eq('ano', anoAtual),
    supabase.from('estado_sms_gateway').select('*').eq('estudio_id', estudio.id).single(),
  ])

  if (erroClientes || erroEnvios || erroEstadoGateway) {
    throw new Error((erroClientes ?? erroEnvios ?? erroEstadoGateway)!.message)
  }
  const estadoGateway = estadoGatewayData as EstadoSmsGateway
  const emCrise = estadoGateway.tentativas_falhadas >= 3 && estadoGateway.offline_desde !== null

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
        mensagem: preencherMensagem(template, c.nome, c.genero),
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href={`/painel/${slug}/clientes`}
        className="text-sm text-muted underline"
      >
        ← Clientes
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        Aniversários
      </h1>
      <p className="mt-1 text-sm text-muted">
        {estudio.nome} · a mensagem é enviada automaticamente por SMS às 10:00 do próprio dia. A
        mensagem também aparece pronta a copiar, para enviares à mão sempre que quiseres.
      </p>

      <div className="mt-4 flex gap-1.5">
        <Link
          href={`/painel/${slug}/clientes/aniversarios`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            vistaCalendario
              ? 'border-brand bg-brand text-black'
              : 'border-border-subtle text-muted'
          }`}
        >
          Calendário
        </Link>
        <Link
          href={`/painel/${slug}/clientes/aniversarios?vista=lista`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            !vistaCalendario
              ? 'border-brand bg-brand text-black'
              : 'border-border-subtle text-muted'
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
            className="rounded-xl border border-border-subtle bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-sm text-foreground">
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
                      : 'bg-zinc-100 text-muted dark:bg-zinc-900'
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
                  className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-bold hover:bg-foreground/[.08]"
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
                    className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong"
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
        <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-zinc-500">
          Nenhum cliente com data de nascimento registada.
        </div>
      )}
      </>
      )}

      {ehGestao && (
        <div
          className={`mt-10 flex flex-col gap-2 rounded-xl border p-4 text-sm ${
            emCrise
              ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
              : 'border-border-subtle bg-surface'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Envio automático por SMS
          </p>
          {emCrise ? (
            <p>
              {estadoGateway.tentativas_falhadas} tentativa{estadoGateway.tentativas_falhadas === 1 ? '' : 's'}{' '}
              falhada{estadoGateway.tentativas_falhadas === 1 ? '' : 's'} a ligar ao telemóvel
              {estadoGateway.ultima_falha_em &&
                ` · última em ${new Date(estadoGateway.ultima_falha_em).toLocaleString('pt-PT', {
                  timeZone: 'Europe/Lisbon',
                })}`}
            </p>
          ) : (
            <p className="text-muted">Sem falhas de ligação registadas.</p>
          )}
          {reenvioEnviados !== undefined && (
            <p className="text-xs">
              Último reenvio manual: {reenvioEnviados} enviado(s), {reenvioFalhas} rejeitado(s) pelo
              gateway, {reenvioPendentes} ainda pendente(s)
              {reenvioOffline === 'true' && ' · telemóvel continua offline'}.
            </p>
          )}
          <form action={reenviarAniversariosPendentes} className="mt-1">
            <input type="hidden" name="estudio_slug" value={slug} />
            <SubmitButton
              pendingText="A reenviar…"
              className="self-start rounded-full border border-border-strong px-4 py-1.5 text-xs font-bold hover:bg-brand/[.08]"
            >
              Tentar Reenvio de Parabéns Pendentes
            </SubmitButton>
          </form>
        </div>
      )}

      {ehGestao && (
        <details className="mt-4 rounded-xl border border-border-subtle">
          <summary className="flex cursor-pointer items-center gap-1.5 p-4 text-xs font-semibold uppercase tracking-wider text-[#5B3FA0]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3FA0]" />
            Editar mensagens
          </summary>
          <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
            <p className="text-xs text-zinc-500">
              Usa <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{'{nome}'}</code> onde
              quiseres que apareça o nome da pessoa, e{' '}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{'{estimado}'}</code> onde
              quiseres &ldquo;estimado&rdquo;/&ldquo;estimada&rdquo; (ajusta-se ao género da ficha;
              sem género definido, usa &ldquo;estimado&rdquo;).
            </p>
            <ConfigAniversarioForm
              slug={slug}
              chave="msg_aniversario"
              label="Mensagem para clientes ativos"
              valorInicial={msgAtiva}
              action={guardarConfigAniversario}
            />
            <ConfigAniversarioForm
              slug={slug}
              chave="msg_aniversario_ex"
              label="Mensagem para ex-clientes"
              valorInicial={msgExCliente}
              action={guardarConfigAniversario}
            />
          </div>
        </details>
      )}
    </div>
  )
}
