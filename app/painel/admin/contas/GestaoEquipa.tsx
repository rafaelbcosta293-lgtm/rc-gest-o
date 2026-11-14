import { UserPlus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ehContaFixa, ehEmailSemConta, permissoesDaConta } from '@/lib/data/acessos'
import { MODULOS } from '@/lib/data/constantes'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import {
  atualizarInstrutor,
  criarInstrutor,
  definirAcesso,
  desativarInstrutor,
  eliminarInstrutor,
  removerAcesso,
} from './equipaActions'

const PAPEIS: { valor: string; nome: string; ajuda: string }[] = [
  { valor: 'pt', nome: 'Instrutor (PT)', ajuda: 'Treinos e o seu próprio trabalho' },
  { valor: 'master_trainer', nome: 'Master Trainer', ajuda: 'Como PT, com responsabilidade técnica' },
  { valor: 'comercial', nome: 'Comercial', ajuda: 'Leads e contactos' },
  { valor: 'studio_manager', nome: 'Responsável de estúdio', ajuda: 'Gestão: aprova férias e horas, edita pagamentos' },
]

const campo = 'mt-1 block w-full rounded-lg border border-border-subtle bg-background px-2.5 py-1.5 text-sm text-foreground'
const rotulo = 'text-xs font-medium text-muted'

type Pessoa = {
  id: string
  nome: string
  telefone: string | null
  papel: string
  ativo: boolean
  email: string | null
  semConta: boolean
  ultimoLogin: string | null
  estudios: number[]
  modulos: string[]
  agendaEscrita: boolean
}

function CamposPerfil({
  p,
  estudios,
}: {
  p?: Pessoa
  estudios: { id: number; nome: string }[]
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={rotulo}>
          Nome
          <input name="nome" required defaultValue={p?.nome ?? ''} className={campo} />
        </label>
        <label className={rotulo}>
          Telemóvel (opcional)
          <input name="telefone" defaultValue={p?.telefone ?? ''} className={campo} />
        </label>
        <label className={rotulo}>
          Função
          <select name="papel" defaultValue={p?.papel ?? 'pt'} className={campo}>
            {PAPEIS.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.nome} — {x.ajuda}
              </option>
            ))}
            {p && !PAPEIS.some((x) => x.valor === p.papel) && <option value={p.papel}>{p.papel}</option>}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className={rotulo}>Estúdios onde trabalha (aparece nas escalas, horas e como PT)</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {estudios.map((e) => (
            <label key={e.id} className="inline-flex items-center gap-1.5 text-sm text-foreground">
              <input type="checkbox" name="estudios" value={e.id} defaultChecked={p ? p.estudios.includes(e.id) : false} />
              {e.nome}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

function CamposPermissoes({ p }: { p?: Pessoa }) {
  const modulos = p?.modulos ?? permissoesDaConta(null).modulos
  return (
    <fieldset>
      <legend className={rotulo}>O que esta conta pode abrir na app</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {MODULOS.filter((m) => m.pronto).map((m) => (
          <label key={m.id} className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <input type="checkbox" name="modulos" value={m.id} defaultChecked={modulos.includes(m.id)} />
            {m.nome}
          </label>
        ))}
      </div>
      <label className="mt-2 inline-flex items-center gap-1.5 text-sm text-foreground">
        <input type="checkbox" name="agenda_escrita" value="1" defaultChecked={p?.agendaEscrita ?? false} />
        Pode criar e alterar marcações na Agenda (sem isto, só vê)
      </label>
    </fieldset>
  )
}

export default async function GestaoEquipa({ estudios }: { estudios: { id: number; nome: string }[] }) {
  const admin = createAdminClient()
  const [{ data: contas, error: erroContas }, { data: perfis, error: erroPerfis }, { data: ligacoes, error: erroLigacoes }] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from('perfis').select('id, nome, telefone, papel, ativo'),
      admin.from('perfis_estudios').select('perfil_id, estudio_id'),
    ])
  const erro = erroContas ?? erroPerfis ?? erroLigacoes
  if (erro) throw new Error(erro.message)

  const perfilPorId = new Map((perfis ?? []).map((p) => [p.id as string, p]))
  const pessoas: Pessoa[] = contas.users
    .filter((u) => !ehContaFixa(u.email ?? null))
    .map((u) => {
      const perfil = perfilPorId.get(u.id)
      const permissoes = permissoesDaConta(u.app_metadata)
      return {
        id: u.id,
        nome: (perfil?.nome as string | undefined)?.trim() || (u.user_metadata?.nome as string | undefined) || '(sem nome)',
        telefone: (perfil?.telefone as string | null | undefined) ?? null,
        papel: (perfil?.papel as string | undefined) ?? 'pt',
        ativo: (perfil?.ativo as boolean | undefined) ?? true,
        email: u.email ?? null,
        semConta: ehEmailSemConta(u.email ?? null),
        ultimoLogin: u.last_sign_in_at ?? null,
        estudios: (ligacoes ?? []).filter((l) => l.perfil_id === u.id).map((l) => l.estudio_id as number),
        modulos: permissoes.modulos,
        agendaEscrita: permissoes.agendaEscrita,
      }
    })
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
  const nomeEstudio = new Map(estudios.map((e) => [e.id, e.nome]))
  const nomePapel = new Map(PAPEIS.map((p) => [p.valor, p.nome]))

  return (
    <section id="equipa" className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-bold tracking-tight text-foreground">Instrutores e contas pessoais</h2>
      <p className="mt-1 text-sm text-muted">
        Um <strong className="text-foreground">perfil</strong> é só a ficha do instrutor (para escalas, horas de trabalho, ficar
        associado a treinos e clientes) — não entra na app. Uma <strong className="text-foreground">conta</strong> é um perfil com
        email e palavra-passe, com as permissões que escolheres.
      </p>

      <details className="mt-4 rounded-xl border border-border-subtle bg-surface p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
          <UserPlus className="h-4 w-4" /> Adicionar instrutor
        </summary>
        <form action={criarInstrutor} className="mt-4 flex flex-col gap-4">
          <CamposPerfil estudios={estudios} />
          <div className="rounded-lg border border-border-subtle p-3">
            <p className="text-sm font-semibold text-foreground">Acesso à app (opcional)</p>
            <p className="mt-0.5 text-xs text-muted">Deixa o email em branco para criar só o perfil. Podes dar-lhe acesso mais tarde.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={rotulo}>
                Email
                <input type="email" name="email" autoComplete="off" className={campo} />
              </label>
              <label className={rotulo}>
                Palavra-passe inicial (mín. 6)
                <input type="text" name="password" autoComplete="off" minLength={6} className={campo} />
              </label>
            </div>
            <div className="mt-3">
              <CamposPermissoes />
            </div>
          </div>
          <SubmitButton pendingText="A criar…" className="self-start rounded-full bg-brand px-5 py-2 text-sm font-bold text-black">
            Adicionar
          </SubmitButton>
        </form>
      </details>

      <ul className="mt-4 flex flex-col gap-2">
        {pessoas.length === 0 && <li className="text-sm text-muted">Ainda não há instrutores registados.</li>}
        {pessoas.map((p) => (
          <li key={p.id}>
            <details className={`rounded-xl border border-border-subtle bg-surface ${p.ativo ? '' : 'opacity-60'}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-semibold text-foreground">{p.nome}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    !p.ativo
                      ? 'bg-zinc-800 text-zinc-300'
                      : p.semConta
                        ? 'bg-zinc-800 text-zinc-300'
                        : 'bg-emerald-950 text-emerald-300'
                  }`}
                >
                  {!p.ativo ? 'Desativado' : p.semConta ? 'Perfil (sem acesso)' : 'Conta'}
                </span>
                {!p.semConta && <span className="font-mono text-xs text-muted">{p.email}</span>}
                <span className="text-xs text-muted">{nomePapel.get(p.papel) ?? p.papel}</span>
                <span className="ml-auto text-xs text-muted">
                  {p.estudios.length ? p.estudios.map((id) => nomeEstudio.get(id) ?? '?').join(' + ') : 'Sem estúdio'}
                </span>
              </summary>

              <div className="flex flex-col gap-5 border-t border-border-subtle px-4 py-4">
                <form action={atualizarInstrutor} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={p.id} />
                  <CamposPerfil p={p} estudios={estudios} />
                  {!p.semConta && <CamposPermissoes p={p} />}
                  <SubmitButton pendingText="A guardar…" className="self-start rounded-full bg-brand px-5 py-2 text-sm font-bold text-black">
                    Guardar alterações
                  </SubmitButton>
                </form>

                <form action={definirAcesso} className="rounded-lg border border-border-subtle p-3">
                  <input type="hidden" name="id" value={p.id} />
                  <p className="text-sm font-semibold text-foreground">
                    {p.semConta ? 'Dar acesso à app' : 'Alterar email ou palavra-passe'}
                  </p>
                  {!p.semConta && (
                    <p className="mt-0.5 text-xs text-muted">
                      Último login: {p.ultimoLogin ? new Date(p.ultimoLogin).toLocaleDateString('pt-PT') : 'nunca'}. Deixa em branco o que
                      não quiseres mudar.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className={rotulo}>
                      Email
                      <input
                        type="email"
                        name="email"
                        autoComplete="off"
                        required={p.semConta}
                        placeholder={p.semConta ? '' : (p.email ?? '')}
                        className={campo}
                      />
                    </label>
                    <label className={rotulo}>
                      {p.semConta ? 'Palavra-passe inicial (mín. 6)' : 'Nova palavra-passe (mín. 6)'}
                      <input type="text" name="password" autoComplete="off" minLength={6} required={p.semConta} className={campo} />
                    </label>
                    <SubmitButton
                      pendingText="A guardar…"
                      className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[.08]"
                    >
                      {p.semConta ? 'Criar acesso' : 'Atualizar acesso'}
                    </SubmitButton>
                  </div>
                </form>

                <div className="flex flex-wrap gap-2">
                  {!p.semConta && (
                    <ConfirmarAcao
                      action={removerAcesso}
                      confirmacao={`Tirar o acesso à app a ${p.nome}? O perfil mantém-se (escalas, horas, histórico), mas deixa de conseguir entrar.`}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground">
                        Tirar acesso à app
                      </button>
                    </ConfirmarAcao>
                  )}
                  <ConfirmarAcao
                    action={desativarInstrutor}
                    confirmacao={
                      p.ativo
                        ? `Desativar ${p.nome}? Sai de todos os estúdios e deixa de conseguir entrar; o histórico fica guardado.`
                        : `Reativar ${p.nome}? Depois escolhe de novo os estúdios onde trabalha.`
                    }
                  >
                    <input type="hidden" name="id" value={p.id} />
                    {!p.ativo && <input type="hidden" name="reativar" value="1" />}
                    <button type="submit" className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground">
                      {p.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </ConfirmarAcao>
                  <ConfirmarAcao
                    action={eliminarInstrutor}
                    confirmacao={`Eliminar ${p.nome} de vez? Não dá para desfazer. Se tiver histórico (treinos, horas, férias), fica apenas desativado para não se perder esse histórico.`}
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="rounded-full border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950">
                      Eliminar
                    </button>
                  </ConfirmarAcao>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
