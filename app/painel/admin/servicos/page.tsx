import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { areaTemPassword, areaDesbloqueada, chaveConfigSenha } from '@/lib/data/gate'
import { criarPlano, guardarConfig, guardarSenha } from './actions'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import ListaPlanos from './ListaPlanos'
import type { ConfigLinha, Plano } from '@/lib/supabase/database.types'

const inputCls =
  'rounded-md border border-border-subtle px-3 py-2 text-sm outline-none focus:border-black/30 dark:bg-zinc-900 dark:focus:border-white/30'

// Estas chaves de "config" têm forms dedicados (write-only, nunca
// mostram o valor atual) — não devem aparecer na lista genérica de
// "Definições do negócio". As de aniversário editam-se em Clientes →
// Aniversários, onde já são usadas.
const CHAVES_ESCONDIDAS = [
  'msg_aniversario',
  'msg_aniversario_ex',
  chaveConfigSenha('admin'),
  chaveConfigSenha('coordenacao'),
]

// A chave em si (ex.: "desmarcacoes_acumuladas_limite") não é um nome
// pensado para se ler — aqui ganha um rótulo em português e um grupo,
// para a lista deixar de ser uma pilha única e passar a secções com
// sentido, fáceis de encontrar.
const CONFIG_META: Record<string, { label: string; grupo: string; tipo?: 'textarea' | 'time' }> = {
  horario_estudio_inicio: { label: 'Hora de abertura', grupo: 'Horário do estúdio', tipo: 'time' },
  horario_estudio_fim: { label: 'Hora de fecho', grupo: 'Horário do estúdio', tipo: 'time' },

  contrato_minimo_meses: { label: 'Contrato mínimo (meses)', grupo: 'Contratos e pagamentos' },
  dia_limite_mensalidade: { label: 'Dia limite do mês para pagar a mensalidade', grupo: 'Contratos e pagamentos' },
  taxa_inscricao: { label: 'Taxa de inscrição (€)', grupo: 'Contratos e pagamentos' },
  taxa_reativacao: { label: 'Taxa de reativação (€)', grupo: 'Contratos e pagamentos' },
  seguro_anual: { label: 'Seguro anual (€)', grupo: 'Contratos e pagamentos' },
  validade_sessoes_dias: { label: 'Validade das sessões (dias)', grupo: 'Contratos e pagamentos' },

  horas_desmarcacao: { label: 'Antecedência mínima para desmarcar (horas)', grupo: 'Desmarcações' },
  desmarcacoes_seguidas_limite: { label: 'Limite de desmarcações seguidas', grupo: 'Desmarcações' },
  desmarcacoes_acumuladas_limite: { label: 'Limite de desmarcações acumuladas', grupo: 'Desmarcações' },

  preco_tp_1x_40min: { label: '1×/semana · 40 min (€)', grupo: 'Preços — Treino Personalizado' },
  preco_tp_1x_50min: { label: '1×/semana · 50 min (€)', grupo: 'Preços — Treino Personalizado' },
  preco_tp_2x_40min: { label: '2×/semana · 40 min (€)', grupo: 'Preços — Treino Personalizado' },
  preco_tp_2x_50min: { label: '2×/semana · 50 min (€)', grupo: 'Preços — Treino Personalizado' },

  preco_ta_1x: { label: '1×/semana (€)', grupo: 'Preços — Treino Acompanhado' },
  preco_ta_2x: { label: '2×/semana (€)', grupo: 'Preços — Treino Acompanhado' },
  preco_ta_3x: { label: '3×/semana (€)', grupo: 'Preços — Treino Acompanhado' },

  custo_hora_pt: { label: 'Custo por hora de PT (€)', grupo: 'Outros' },
  max_clientes_bloco_exclusivo: { label: 'Máx. clientes por bloco exclusivo', grupo: 'Outros' },
  reavaliacao_antecipada_treino_acompanhado: {
    label: 'Reavaliação antecipada — Treino Acompanhado (€)',
    grupo: 'Outros',
  },

  regulamento: { label: 'Regulamento do estúdio', grupo: 'Documentos', tipo: 'textarea' },

  qr_token_fatima: { label: 'Código QR — Fátima', grupo: 'Códigos QR dos estúdios' },
  qr_token_leiria: { label: 'Código QR — Leiria', grupo: 'Códigos QR dos estúdios' },
}

const GRUPOS_ORDEM = [
  'Horário do estúdio',
  'Contratos e pagamentos',
  'Desmarcações',
  'Preços — Treino Personalizado',
  'Preços — Treino Acompanhado',
  'Outros',
  'Documentos',
  'Códigos QR dos estúdios',
  'Outras definições',
] as const

const CORES_GRUPO: Record<string, 'teal' | 'roxo' | 'azul' | 'ambar' | 'verde' | 'vermelho' | 'neutro' | 'laranja'> = {
  'Horário do estúdio': 'azul',
  'Contratos e pagamentos': 'verde',
  Desmarcações: 'laranja',
  'Preços — Treino Personalizado': 'roxo',
  'Preços — Treino Acompanhado': 'teal',
  Outros: 'ambar',
  Documentos: 'neutro',
  'Códigos QR dos estúdios': 'neutro',
  'Outras definições': 'neutro',
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const { error, erroSenha } = await searchParams

  const supabase = await createClient()

  const protegida = await areaTemPassword(supabase, 'admin')
  const desbloqueada = protegida ? await areaDesbloqueada('admin') : true
  if (protegida && !desbloqueada) {
    return (
      <PortaSenha
        titulo="Administração"
        destino="/painel/admin/servicos"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  const [{ data: planosData, error: erroPlanos }, { data: configData, error: erroConfig }] =
    await Promise.all([
      supabase.from('planos').select('*').order('ordem'),
      supabase.from('config').select('*').order('chave'),
    ])

  if (erroPlanos || erroConfig) {
    throw new Error((erroPlanos ?? erroConfig)!.message)
  }

  const planos = (planosData ?? []) as Plano[]
  const config = ((configData ?? []) as ConfigLinha[]).filter(
    (c) => !CHAVES_ESCONDIDAS.includes(c.chave)
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/painel/admin" className="text-sm text-muted underline">
        ← Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Serviços / Produtos
      </h1>
      <p className="mt-1 text-sm text-muted">
        Valores dos planos (partilhados por todos os estúdios), definições do negócio e acessos.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <p className="mt-6 text-xs text-zinc-500">Arrasta pela pega à esquerda para mudar a ordem.</p>
      <ListaPlanos planos={planos} />

      <form
        action={criarPlano}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong p-3"
      >
        <input name="nome" required placeholder="Nome do serviço" className={`${inputCls} flex-1 basis-40`} />
        <input
          name="valor"
          type="number"
          step="0.01"
          required
          placeholder="Valor (€)"
          className={`${inputCls} w-24`}
        />
        <input
          name="sessoes_por_semana"
          type="number"
          placeholder="sessões/sem"
          className={`${inputCls} w-28`}
        />
        <SubmitButton
          pendingText="A criar…"
          className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-black hover:bg-brand-strong"
        >
          + Serviço
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        Eliminar um serviço já usado em pagamentos antigos pode não ser possível — nesse caso,
        desmarca &quot;ativo&quot; em vez de eliminar.
      </p>

      <TituloSeccao cor="vermelho">Passwords de acesso</TituloSeccao>
      <p className="mt-2 text-xs text-zinc-500">
        Passwords extra, separadas do login normal, para entrar em Administração e em
        Coordenação. Deixa em branco e guarda para não alterar a password atual.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form
          action={guardarSenha}
          className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface p-3"
        >
          <input type="hidden" name="chave" value={chaveConfigSenha('admin')} />
          <label className="text-xs font-medium text-zinc-500">Password de Administração</label>
          <div className="flex items-end gap-2">
            <input type="password" name="senha" placeholder="Nova password" className={`${inputCls} flex-1`} />
            <SubmitButton
              pendingText="…"
              className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
        <form
          action={guardarSenha}
          className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface p-3"
        >
          <input type="hidden" name="chave" value={chaveConfigSenha('coordenacao')} />
          <label className="text-xs font-medium text-zinc-500">Password de Coordenação</label>
          <div className="flex items-end gap-2">
            <input type="password" name="senha" placeholder="Nova password" className={`${inputCls} flex-1`} />
            <SubmitButton
              pendingText="…"
              className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
      </div>

      {(() => {
        const porGrupo = new Map<string, ConfigLinha[]>()
        for (const c of config) {
          const grupo = CONFIG_META[c.chave]?.grupo ?? 'Outras definições'
          const lista = porGrupo.get(grupo) ?? []
          lista.push(c)
          porGrupo.set(grupo, lista)
        }
        const gruposComDados = GRUPOS_ORDEM.filter((g) => porGrupo.has(g))

        return gruposComDados.map((grupo) => (
          <div key={grupo}>
            <TituloSeccao cor={CORES_GRUPO[grupo] ?? 'neutro'}>{grupo}</TituloSeccao>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {porGrupo.get(grupo)!.map((c) => {
                const meta = CONFIG_META[c.chave]
                return (
                  <form
                    key={c.chave}
                    action={guardarConfig}
                    className={`flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface p-3 ${
                      meta?.tipo === 'textarea' ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <input type="hidden" name="chave" value={c.chave} />
                    <label className="text-xs font-medium text-zinc-500">{meta?.label ?? c.chave}</label>
                    <div className="flex items-end gap-2">
                      {meta?.tipo === 'textarea' ? (
                        <textarea
                          name="valor"
                          defaultValue={c.valor ?? ''}
                          rows={6}
                          className={`${inputCls} flex-1`}
                        />
                      ) : (
                        <input
                          type={meta?.tipo === 'time' ? 'time' : 'text'}
                          name="valor"
                          defaultValue={c.valor ?? ''}
                          className={`${inputCls} flex-1`}
                        />
                      )}
                      <SubmitButton
                        pendingText="…"
                        className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium"
                      >
                        Guardar
                      </SubmitButton>
                    </div>
                  </form>
                )
              })}
            </div>
          </div>
        ))
      })()}
      {config.length === 0 && (
        <p className="mt-8 text-sm text-zinc-500">Sem definições configuradas.</p>
      )}
    </div>
  )
}
