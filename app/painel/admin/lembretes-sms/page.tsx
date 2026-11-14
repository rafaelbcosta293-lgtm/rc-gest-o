import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada } from '@/lib/data/gate'
import { getEstudios } from '@/lib/data/estudios'
import { desbloquearAdmin } from '../actions'
import { somarDias } from '@/lib/data/horarios'
import { normalizarTelefoneSms } from '@/lib/sms/gateway'
import {
  CHAVE_TEMPLATE_LEMBRETE,
  CHAVE_TEMPLATE_LEMBRETE_SABADO,
  TEMPLATE_LEMBRETE_OMISSAO,
  VARIAVEIS_TEMPLATE_LEMBRETE,
  nomeDiaSemana,
  templateSabadoDerivado,
  dataDeAmanhaEmLisboa,
  preencherTemplateLembrete,
  proximoDiaAlvoLembrete,
} from '@/lib/data/lembretesSms'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import TemplateForm from './TemplateForm'
import TesteSmsForm from './TesteSmsForm'
import { reenviarLembretesPendentes } from './actions'
import type { Estudio, EstadoSmsGateway } from '@/lib/supabase/database.types'

type EstadoDoEstudio = { estudio: Estudio; estado: EstadoSmsGateway; pendentes: number; semNumero: string[] }

export default async function LembretesSmsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    erroSenha?: string
    erroTeste?: string
    testeEnviado?: string
    guardado?: string
    reenvioEstudio?: string
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
    guardado,
    reenvioEstudio,
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
  const estudios = await getEstudios(supabase)

  const [{ data: configData }, estadosPorEstudio] = await Promise.all([
    supabase.from('config').select('chave, valor').in('chave', [CHAVE_TEMPLATE_LEMBRETE, CHAVE_TEMPLATE_LEMBRETE_SABADO]),
    Promise.all(
      estudios.map(async (estudio): Promise<EstadoDoEstudio> => {
        // O dia visado pode não ser "amanhã" — ver proximoDiaAlvoLembrete
        // (hoje só muda para o Fátima, à véspera de um domingo).
        const diaAlvo = proximoDiaAlvoLembrete(amanha, estudio.slug)
        const [{ data: estadoData, error: erroEstado }, { data: pendentesData }] = await Promise.all([
          supabase.from('estado_sms_gateway').select('*').eq('estudio_id', estudio.id).single(),
          supabase
            .from('agenda_eventos')
            .select('hora_inicio, titulo, telefone, cliente:clientes(nome, telefone)')
            .eq('estudio_id', estudio.id)
            .in('tipo', ['Treino', 'Sessão experimental'])
            .eq('estado', 'Agendado')
            .eq('data', diaAlvo)
            .eq('lembrete_enviado', false)
            .order('hora_inicio'),
        ])
        if (erroEstado) throw new Error(erroEstado.message)
        type Pendente = {
          hora_inicio: string
          titulo: string | null
          telefone: string | null
          cliente: { nome: string; telefone: string | null } | { nome: string; telefone: string | null }[] | null
        }
        const pendentesLista = (pendentesData ?? []) as unknown as Pendente[]
        // Quem não vai receber por não ter número válido na ficha.
        const semNumero = pendentesLista
          .map((p) => {
            const c = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
            return { nome: c?.nome ?? p.titulo ?? '—', telefone: c ? c.telefone : p.telefone, hora: p.hora_inicio.slice(0, 5) }
          })
          .filter((p) => !normalizarTelefoneSms(p.telefone))
          .map((p) => `${p.nome} (${p.hora})`)
        return { estudio, estado: estadoData as EstadoSmsGateway, pendentes: pendentesLista.length, semNumero }
      })
    ),
  ])

  const valorConfig = (chave: string) => (configData ?? []).find((c) => c.chave === chave)?.valor?.trim() || null
  const template = valorConfig(CHAVE_TEMPLATE_LEMBRETE) ?? TEMPLATE_LEMBRETE_OMISSAO
  const templateSabado = valorConfig(CHAVE_TEMPLATE_LEMBRETE_SABADO)
  const textoPreview = preencherTemplateLembrete(template, {
    nome: 'Nome de Teste',
    data: amanha,
    horaInicio: '10:00:00',
  })
  // Pré-visualização do de sábado com a próxima segunda-feira.
  let proximaSegunda = amanha
  while (nomeDiaSemana(proximaSegunda) !== 'segunda-feira') proximaSegunda = somarDias(proximaSegunda, 1)
  const textoPreviewSabado = preencherTemplateLembrete(template, {
    nome: 'Nome de Teste',
    data: proximaSegunda,
    horaInicio: '10:00:00',
    naoEAmanha: true,
    templateSabado,
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Lembretes SMS</h1>
      <p className="mt-1 text-sm text-muted">
        Todos os dias às 10:00, avisa por SMS quem tem treino agendado para o dia seguinte. Volta a passar pela
        agenda perto do meio-dia e ao fim do dia (entre as 19h e as 21h) para enviar os lembretes das marcações feitas
        entretanto — quem já recebeu não recebe outra vez. Cada estúdio envia pelo seu próprio telemóvel.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <TituloSeccao cor="teal">Estado do gateway, por estúdio</TituloSeccao>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {estadosPorEstudio.map(({ estudio, estado, pendentes, semNumero }) => {
          const emCrise = estado.tentativas_falhadas >= 3 && estado.offline_desde !== null
          return (
            <div
              key={estudio.slug}
              className={`flex flex-col gap-2 rounded-xl border p-4 text-sm ${
                emCrise
                  ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-border-subtle bg-surface'
              }`}
            >
              <p className="font-bold text-foreground">{estudio.nome}</p>
              <p>
                <strong>{pendentes}</strong> lembrete{pendentes === 1 ? '' : 's'} pendente
                {pendentes === 1 ? '' : 's'} para amanhã.
              </p>
              {semNumero.length > 0 && (
                <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Sem número de telemóvel válido na ficha (não vão receber): {semNumero.join(', ')}.
                </p>
              )}
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

              {reenvioEstudio === estudio.slug && (
                <p className="text-xs">
                  Último reenvio manual: {reenvioEnviados} enviado(s), {reenvioFalhas} rejeitado(s)
                  pelo gateway, {reenvioPendentes} ainda pendente(s)
                  {reenvioOffline === 'true' && ' · telemóvel continua offline'}.
                </p>
              )}

              <form action={reenviarLembretesPendentes} className="mt-1">
                <input type="hidden" name="estudio_slug" value={estudio.slug} />
                <SubmitButton
                  pendingText="A reenviar…"
                  className="self-start rounded-full border border-border-strong px-4 py-1.5 text-xs font-bold hover:bg-brand/[.08]"
                >
                  Tentar Reenvio de Lembretes Pendentes
                </SubmitButton>
              </form>
            </div>
          )
        })}
      </div>

      <TituloSeccao cor="roxo">Modelos da mensagem</TituloSeccao>
      <p className="mt-1 text-xs text-muted">Partilhados pelos dois estúdios.</p>
      <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4">
        <div>
          <p className="text-sm font-bold text-foreground">Mensagem padrão (todos os dias, para o dia seguinte)</p>
          <p className="text-xs text-muted">Enviada às 10:00 a quem tem treino amanhã.</p>
        </div>
        {guardado === 'diario' && <p className="text-xs font-semibold text-teal-400">Modelo padrão guardado.</p>}
        <TemplateForm valorInicial={template} tipo="diario" />
        <PreVisualizacao texto={textoPreview} />

        <div className="mt-3 border-t border-border-subtle pt-4">
          <p className="text-sm font-bold text-foreground">Mensagem de sábado (referente à segunda-feira)</p>
          <p className="text-xs text-muted">
            Enviada ao sábado às 10:00 a quem tem treino na segunda-feira (domingo está fechado). Se ficar vazia, usa a
            mensagem padrão com &quot;amanhã&quot; trocado por &quot;na próxima&quot;.
          </p>
        </div>
        {guardado === 'sabado' && <p className="text-xs font-semibold text-teal-400">Modelo de sábado guardado.</p>}
        <TemplateForm valorInicial={templateSabado ?? templateSabadoDerivado(template)} tipo="sabado" placeholder={templateSabadoDerivado(template)} />
        <PreVisualizacao texto={textoPreviewSabado} />

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
      {erroTeste && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroTeste}
        </p>
      )}
      {testeEnviado && (
        <p className="mt-2 rounded-md bg-teal-50 px-3 py-2 text-xs text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          SMS de teste enviado pelo telemóvel de {estudios.find((e) => e.slug === testeEnviado)?.nome ?? testeEnviado}.
        </p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {estudios.map((estudio) => (
          <div key={estudio.slug} className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-4">
            <p className="text-sm font-bold text-foreground">{estudio.nome}</p>
            <TesteSmsForm estudioSlug={estudio.slug} textoInicial={textoPreview} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PreVisualizacao({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-black/20 p-3 text-xs">
      <p className="font-semibold text-muted">Pré-visualização</p>
      <p className="mt-1 whitespace-pre-line text-foreground">{texto}</p>
    </div>
  )
}
