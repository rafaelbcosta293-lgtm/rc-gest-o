import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { desbloquearAdmin } from '../actions'
import {
  TEMPLATE_LEMBRETE_OMISSAO,
  VARIAVEIS_TEMPLATE_LEMBRETE,
  dataDeAmanhaEmLisboa,
  preencherTemplateLembrete,
} from '@/lib/data/lembretesSms'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import TemplateForm from './TemplateForm'
import TesteSmsForm from './TesteSmsForm'
import { reenviarLembretesPendentes } from './actions'
import type { EstadoSmsGateway } from '@/lib/supabase/database.types'

export default async function LembretesSmsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    erroSenha?: string
    erroTeste?: string
    testeEnviado?: string
    reenvioEnviados?: string
    reenvioFalhas?: string
    reenvioPendentes?: string
    reenvioOffline?: string
  }>
}) {
  const {
    error,
    erroSenha,
    erroTeste,
    testeEnviado,
    reenvioEnviados,
    reenvioFalhas,
    reenvioPendentes,
    reenvioOffline,
  } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração — Lembretes SMS"
        destino="/painel/admin/lembretes-sms"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  const amanha = dataDeAmanhaEmLisboa()

  const [{ data: configData }, { data: estadoData, error: erroEstado }, { count: pendentesCount }] =
    await Promise.all([
      supabase.from('config').select('valor').eq('chave', 'msg_lembrete_treino').maybeSingle(),
      supabase.from('estado_sms_gateway').select('*').eq('id', 1).single(),
      supabase
        .from('agenda_eventos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'Treino')
        .eq('estado', 'Agendado')
        .eq('data', amanha)
        .eq('lembrete_enviado', false)
        .not('cliente_id', 'is', null),
    ])

  if (erroEstado) {
    throw new Error(erroEstado.message)
  }

  const template = configData?.valor || TEMPLATE_LEMBRETE_OMISSAO
  const estado = estadoData as EstadoSmsGateway
  const pendentes = pendentesCount ?? 0

  const textoPreview = preencherTemplateLembrete(template, {
    nome: 'Nome de Teste',
    data: amanha,
    horaInicio: '10:00:00',
  })

  const emCrise = estado.tentativas_falhadas > 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Lembretes SMS</h1>
      <p className="mt-1 text-sm text-muted">
        Todos os dias às 10:00, avisa por SMS quem tem treino agendado para o dia seguinte.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <TituloSeccao cor={emCrise ? 'vermelho' : 'teal'}>Estado do gateway</TituloSeccao>
      <div
        className={`mt-2 flex flex-col gap-2 rounded-xl border p-4 text-sm ${
          emCrise
            ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
            : 'border-border-subtle bg-surface'
        }`}
      >
        <p>
          <strong>{pendentes}</strong> lembrete{pendentes === 1 ? '' : 's'} pendente
          {pendentes === 1 ? '' : 's'} para amanhã.
        </p>
        {emCrise ? (
          <p>
            {estado.tentativas_falhadas} tentativa{estado.tentativas_falhadas === 1 ? '' : 's'} falhada
            {estado.tentativas_falhadas === 1 ? '' : 's'} a ligar ao telemóvel
            {estado.ultima_falha_em &&
              ` · última em ${new Date(estado.ultima_falha_em).toLocaleString('pt-PT', {
                timeZone: 'Europe/Lisbon',
              })}`}
            {estado.alerta_registado_em && ' · alerta já registado na app'}
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

        <form action={reenviarLembretesPendentes} className="mt-1">
          <SubmitButton
            pendingText="A reenviar…"
            className="self-start rounded-full border border-border-strong px-4 py-1.5 text-xs font-bold hover:bg-brand/[.08]"
          >
            Tentar Reenvio de Lembretes Pendentes
          </SubmitButton>
        </form>
      </div>

      <TituloSeccao cor="roxo">Modelo da mensagem</TituloSeccao>
      <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4">
        <TemplateForm valorInicial={template} />
        <div className="rounded-lg bg-brand/[.06] p-3 text-xs text-muted">
          <p className="font-semibold text-foreground">Variáveis disponíveis:</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {VARIAVEIS_TEMPLATE_LEMBRETE.map((v) => (
              <li key={v.variavel}>
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{v.variavel}</code> → {v.descricao}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <TituloSeccao cor="azul">Enviar SMS de teste</TituloSeccao>
      <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4">
        {erroTeste && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {erroTeste}
          </p>
        )}
        {testeEnviado && (
          <p className="rounded-md bg-teal-50 px-3 py-2 text-xs text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            SMS de teste enviado.
          </p>
        )}
        <TesteSmsForm textoInicial={textoPreview} />
      </div>
    </div>
  )
}
