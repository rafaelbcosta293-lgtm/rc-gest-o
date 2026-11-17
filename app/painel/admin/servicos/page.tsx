import Link from '@/components/LinkRapido'
import { createClient } from '@/lib/supabase/server'
import { areaBloqueada, chaveConfigSenha } from '@/lib/data/gate'
import { ESTUDIOS_COM_CONTA_PARTILHADA, chaveAtivoDispositivo, dispositivoAutorizado } from '@/lib/data/dispositivo'
import {
  criarPlano,
  guardarConfig,
  guardarSenha,
  alternarRestricaoDispositivo,
  autorizarEsteComputadorAction,
  removerAutorizacaoEsteComputadorAction,
} from './actions'
import { desbloquearAdmin } from '../actions'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import TituloSeccao from '@/components/TituloSeccao'
import ListaPlanos from './ListaPlanos'
import SeccaoProdutos, { type CategoriaProduto, type Produto } from './SeccaoProdutos'
import type { ConfigLinha, Plano } from '@/lib/supabase/database.types'
import { carregarServicos } from '@/lib/data/servicos'
import { ArrowLeft } from 'lucide-react'

const inputCls =
  'rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

const NOME_ESTUDIO: Record<string, string> = { fatima: 'Fátima', leiria: 'Leiria' }

// Estas chaves de "config" têm sítio próprio — não aparecem na lista
// genérica de "Definições do negócio": as de aniversário editam-se em
// Clientes → Aniversários; os textos dos lembretes, em Lembretes SMS.
const CHAVES_ESCONDIDAS = [
  'msg_aniversario',
  'msg_aniversario_ex',
  'msg_lembrete_treino',
  'msg_lembrete_treino_sabado',
  chaveConfigSenha('admin'),
  chaveConfigSenha('coordenacao'),
  ...ESTUDIOS_COM_CONTA_PARTILHADA.map((s) => chaveAtivoDispositivo(s)!),
]

// A chave em si não é um nome pensado para se ler — aqui ganha um rótulo
// em português e um grupo. (As definições que nada usava foram apagadas;
// o custo por hora de PT passou a ser calculado — ver custoHoraPt.ts.)
const CONFIG_META: Record<string, { label: string; grupo: string; tipo?: 'textarea' | 'time' }> = {
  taxa_inscricao: { label: 'Taxa de inscrição (€)', grupo: 'Contratos e pagamentos' },
  taxa_reativacao: { label: 'Taxa de reativação (€)', grupo: 'Contratos e pagamentos' },
  seguro_anual: { label: 'Seguro anual (€)', grupo: 'Contratos e pagamentos' },

  ferias_max_pts_simultaneo: { label: 'Máx. instrutores de férias ao mesmo tempo', grupo: 'Equipa' },

  zsgo_produto_mensalidade: { label: 'Artigo — mensalidade de Treino Personalizado', grupo: 'Faturação (ZS Go)' },
  zsgo_produto_mensalidade_acompanhado: { label: 'Artigo — mensalidade de Treino Acompanhado', grupo: 'Faturação (ZS Go)' },
  zsgo_produto_mensalidade_pilates: { label: 'Artigo — mensalidade de Pilates', grupo: 'Faturação (ZS Go)' },
  zsgo_produto_mensalidade_nutricao: { label: 'Artigo — mensalidade de Nutrição', grupo: 'Faturação (ZS Go)' },
  zsgo_produto_inscricao: { label: 'Artigo — taxa de inscrição', grupo: 'Faturação (ZS Go)' },
  zsgo_produto_seguro: { label: 'Artigo — seguro anual', grupo: 'Faturação (ZS Go)' },
  zsgo_produto_reativacao: { label: 'Artigo — taxa de reativação', grupo: 'Faturação (ZS Go)' },
  zsgo_metodo_mb_way: { label: 'Método de pagamento — MB Way', grupo: 'Faturação (ZS Go)' },
  zsgo_metodo_multibanco: { label: 'Método de pagamento — Multibanco', grupo: 'Faturação (ZS Go)' },
  zsgo_metodo_transferencia: { label: 'Método de pagamento — Transferência', grupo: 'Faturação (ZS Go)' },
  zsgo_metodo_numerario: { label: 'Método de pagamento — Numerário', grupo: 'Faturação (ZS Go)' },
}

const GRUPOS_ORDEM = ['Contratos e pagamentos', 'Equipa', 'Faturação (ZS Go)', 'Outras definições'] as const

const CORES_GRUPO: Record<string, 'teal' | 'roxo' | 'azul' | 'ambar' | 'verde' | 'vermelho' | 'neutro' | 'laranja'> = {
  'Contratos e pagamentos': 'verde',
  Equipa: 'azul',
  'Faturação (ZS Go)': 'roxo',
  'Outras definições': 'neutro',
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; erroSenha?: string }>
}) {
  const { error, erroSenha } = await searchParams

  const supabase = await createClient()

  if (await areaBloqueada(supabase, 'admin')) {
    return (
      <PortaSenha
        titulo="Administração"
        destino="/painel/admin/servicos"
        action={desbloquearAdmin}
        erro={erroSenha}
      />
    )
  }

  const [
    { data: planosData, error: erroPlanos },
    { data: configData, error: erroConfig },
    { data: categoriasProdutoData, error: erroCategoriasProduto },
    { data: produtosData, error: erroProdutos },
  ] = await Promise.all([
    supabase.from('planos').select('*').order('ordem'),
    supabase.from('config').select('*').order('chave'),
    supabase.from('produto_categorias').select('id, nome, ordem').order('ordem'),
    supabase.from('produtos').select('id, categoria_id, nome, valor, ativo').order('nome'),
  ])

  if (erroPlanos || erroConfig || erroCategoriasProduto || erroProdutos) {
    throw new Error((erroPlanos ?? erroConfig ?? erroCategoriasProduto ?? erroProdutos)!.message)
  }
  const categoriasProduto = (categoriasProdutoData ?? []) as CategoriaProduto[]
  const produtos = ((produtosData ?? []) as Produto[]).map((p) => ({ ...p, valor: Number(p.valor) }))

  const planos = (planosData ?? []) as Plano[]
  const servicos = await carregarServicos(supabase)
  const configTodo = (configData ?? []) as ConfigLinha[]
  const config = configTodo.filter((c) => !CHAVES_ESCONDIDAS.includes(c.chave))

  const dispositivos = await Promise.all(
    ESTUDIOS_COM_CONTA_PARTILHADA.map(async (slug) => ({
      slug,
      ativo: !!configTodo.find((c) => c.chave === chaveAtivoDispositivo(slug))?.valor,
      autorizado: await dispositivoAutorizado(slug),
    }))
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        Serviços / Produtos
      </h1>
      <p className="mt-1 text-sm text-muted">
        Serviços (planos) e produtos, partilhados por todos os estúdios, definições do negócio e acessos.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <TituloSeccao cor="teal">Planos (mensalidades)</TituloSeccao>
      <p className="mt-1 text-xs text-muted">
        Cada plano pertence a um serviço — {servicos.map((s) => s.nome).join(', ')}. Os pagamentos ficam no serviço do
        plano, para as métricas de cada serviço não se misturarem. Arrasta pela pega à esquerda para mudar a ordem.
      </p>
      <ListaPlanos planos={planos} servicos={servicos} />

      <form
        action={criarPlano}
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-strong p-3"
      >
        <select name="servico_id" defaultValue={1} title="Serviço do plano" className={`${inputCls} w-44`}>
          {servicos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <input name="nome" required placeholder="Nome do plano" className={`${inputCls} flex-1 basis-40`} />
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
          + Plano
        </SubmitButton>
      </form>
      <p className="mt-2 text-xs text-muted">
        &quot;Sessões/sem&quot; é a frequência semanal, não o total do ciclo — ex.: Express/Premium
        4 → 1, 8 → 2, 12 → 3. É o número usado em Pagamentos para calcular a meta de treinos do
        mês.
      </p>
      <p className="mt-2 text-xs text-muted">
        Eliminar um plano já usado em pagamentos antigos pode não ser possível — nesse caso,
        desmarca &quot;ativo&quot; em vez de eliminar.
      </p>

      <SeccaoProdutos categorias={categoriasProduto} produtos={produtos} />

      <TituloSeccao cor="vermelho">Passwords de acesso</TituloSeccao>
      <p className="mt-2 text-xs text-muted">
        Passwords extra, separadas do login normal, para entrar em Administração e em
        Coordenação. Deixa em branco e guarda para não alterar a password atual.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form
          action={guardarSenha}
          className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface p-3"
        >
          <input type="hidden" name="chave" value={chaveConfigSenha('admin')} />
          <label className="text-xs font-medium text-muted">Password de Administração</label>
          <div className="flex items-end gap-2">
            <input type="password" name="senha" placeholder="Nova password" className={`${inputCls} flex-1`} />
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
        <form
          action={guardarSenha}
          className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface p-3"
        >
          <input type="hidden" name="chave" value={chaveConfigSenha('coordenacao')} />
          <label className="text-xs font-medium text-muted">Password de Coordenação</label>
          <div className="flex items-end gap-2">
            <input type="password" name="senha" placeholder="Nova password" className={`${inputCls} flex-1`} />
            <SubmitButton
              pendingText="…"
              className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
            >
              Guardar
            </SubmitButton>
          </div>
        </form>
      </div>

      <TituloSeccao cor="vermelho">Computadores autorizados (contas de Fátima/Leiria)</TituloSeccao>
      <p className="mt-2 text-xs text-muted">
        Restringe a conta partilhada de cada estúdio a computadores já autorizados aqui — para a
        password do estúdio não servir para entrar fora dele (ex.: em casa). Autoriza primeiro
        todos os computadores desse estúdio antes de ativar a restrição, para a equipa não ficar
        de repente sem conseguir entrar.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dispositivos.map(({ slug, ativo, autorizado }) => (
          <div key={slug} className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3">
            <span className="text-xs font-medium text-muted">{NOME_ESTUDIO[slug]}</span>
            <p className="text-xs text-muted">
              Restrição: <strong>{ativo ? 'ativa' : 'desativada'}</strong> · Este computador:{' '}
              <strong>{autorizado ? 'autorizado' : 'não autorizado'}</strong>
            </p>
            <form action={autorizado ? removerAutorizacaoEsteComputadorAction : autorizarEsteComputadorAction}>
              <input type="hidden" name="estudio" value={slug} />
              <SubmitButton
                pendingText="…"
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
              >
                {autorizado ? 'Remover autorização deste computador' : 'Autorizar este computador'}
              </SubmitButton>
            </form>
            <form action={alternarRestricaoDispositivo} className="flex items-center gap-2">
              <input type="hidden" name="estudio" value={slug} />
              <label className="flex flex-1 items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" name="ativo" defaultChecked={ativo} />
                Exigir computador autorizado para esta conta
              </label>
              <SubmitButton
                pendingText="…"
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
              >
                Guardar
              </SubmitButton>
            </form>
          </div>
        ))}
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
                    className={`flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface p-3 ${
                      meta?.tipo === 'textarea' ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <input type="hidden" name="chave" value={c.chave} />
                    <label className="text-xs font-medium text-muted">{meta?.label ?? c.chave}</label>
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
                        className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand/[.08]"
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
        <p className="mt-8 text-sm text-muted">Sem definições configuradas.</p>
      )}
    </div>
  )
}
