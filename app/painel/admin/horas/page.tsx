import Link from '@/components/LinkRapido'
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaBloqueada } from '@/lib/data/gate'
import { hojeEmLisboa } from '@/lib/data/hoje'
import { formatarHoras, hojeLisboa, listarDiasDoMes, textoParaContabilista } from '@/lib/data/assiduidade'
import { TIPOS_CONTRATO } from '@/lib/data/equipaAssiduidade'
import { carregarHorasDoMes, type EstadoFecho } from '@/lib/data/horasEquipa'
import { somarMesesISO } from '@/lib/data/despesas'
import PortaSenha from '@/components/PortaSenha'
import SubmitButton from '@/components/SubmitButton'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { desbloquearAdmin } from '../actions'
import { botaoCls, botaoSecCls, nomeMes } from '../despesas/partes'
import { listarArquivo } from '@/lib/data/arquivoRegistos'
import { arquivarMes, reverHorasDoMes } from './actions'
import CopiarResumo from './CopiarResumo'

const ROTA = '/painel/admin/horas'

const ROTULO_ESTADO: Record<EstadoFecho, string> = {
  Rascunho: 'Por submeter',
  Submetido: 'Submetido',
  Aprovado: 'Aprovado',
}
const COR_ESTADO: Record<EstadoFecho, string> = {
  Rascunho: 'bg-zinc-500/15 text-zinc-300',
  Submetido: 'bg-amber-500/20 text-amber-200',
  Aprovado: 'bg-emerald-500/15 text-emerald-300',
}
const MENSAGENS_OK: Record<string, string> = {
  aprovado: 'Horas do mês aprovadas.',
  reaberto: 'Mês reaberto — o instrutor pode corrigir e submeter de novo.',
  arquivado: 'PDF guardado no arquivo.',
}

const diaMes = (iso: string) => {
  const d = hojeLisboa(new Date(iso))
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

export default async function HorasDaEquipaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ok?: string; error?: string; erroSenha?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  if (await areaBloqueada(supabase, 'admin')) {
    return <PortaSenha titulo="Administração — Horas da equipa" destino={ROTA} action={desbloquearAdmin} erro={sp.erroSenha} />
  }

  const hoje = hojeEmLisboa()
  const mesISO = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : hoje.slice(0, 7)
  const [ano, mes] = mesISO.split('-').map(Number)
  const [linhas, arquivo] = await Promise.all([carregarHorasDoMes(supabase, ano, mes, hoje), listarArquivo('registos-instrutores')])
  const noArquivo = arquivo.find((a) => a.mes === mesISO)

  const porAprovar = linhas.filter((l) => l.estado === 'Submetido').length
  const porSubmeter = linhas.filter((l) => l.estado === 'Rascunho').length
  const totalFeitas = linhas.reduce((s, l) => s + l.resumo.horasRealizadas, 0)
  const totalExtra = linhas.reduce((s, l) => s + l.resumo.horasExtra, 0)
  const totalFerias = linhas.reduce((s, l) => s + l.resumo.diasFerias.length, 0)
  // Com o mês ainda a decorrer, o que falta são horas por fazer — só é
  // "em falta" quando o mês já acabou.
  const mesEmCurso = mesISO === hoje.slice(0, 7)
  const texto = textoParaContabilista(linhas, ano, mes, mesEmCurso ? hoje : undefined)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/painel/admin" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administração
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Horas da equipa</h1>
      <p className="mt-1 text-sm text-muted">
        O que cada instrutor registou no mês — horas feitas, horas extra e dias de férias — e se já submeteu o mês. É o resumo a passar ao
        contabilista para os recibos de vencimento.
      </p>

      {sp.ok && MENSAGENS_OK[sp.ok] && <p className="mt-4 rounded-md bg-teal-950 px-3 py-2 text-sm text-teal-300">{MENSAGENS_OK[sp.ok]}</p>}
      {sp.error && <p className="mt-4 rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{sp.error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`${ROTA}?mes=${somarMesesISO(mesISO, -1)}`} className={botaoSecCls} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h2 className="min-w-44 text-center text-lg font-bold text-foreground first-letter:uppercase">{nomeMes(mesISO)}</h2>
        <Link href={`${ROTA}?mes=${somarMesesISO(mesISO, 1)}`} className={botaoSecCls} aria-label="Mês seguinte">
          <ChevronRight className="h-4 w-4" />
        </Link>
        {mesISO !== hoje.slice(0, 7) && (
          <Link href={ROTA} className={botaoSecCls}>
            Este mês
          </Link>
        )}
        {/* <a> simples (e não Link): é um ficheiro para descarregar, não uma página. */}
        <a href={`${ROTA}/pdf?mes=${mesISO}`} download className={`${botaoCls} ml-auto inline-flex items-center gap-1.5`}>
          <FileDown className="h-3.5 w-3.5" /> Descarregar PDF de {nomeMes(mesISO)}
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero rotulo="Por aprovar" valor={String(porAprovar)} cor={porAprovar ? 'text-amber-300' : undefined} nota={porAprovar ? 'meses submetidos' : 'nada à espera'} />
        <Numero rotulo="Por submeter" valor={String(porSubmeter)} nota={`de ${linhas.length} instrutor${linhas.length === 1 ? '' : 'es'}`} />
        <Numero rotulo="Horas feitas" valor={formatarHoras(totalFeitas)} nota="equipa toda" />
        <Numero rotulo="Horas extra" valor={formatarHoras(totalExtra)} cor={totalExtra > 0 ? 'text-emerald-300' : undefined} />
        <Numero rotulo="Dias de férias" valor={String(totalFerias)} />
      </div>

      {linhas.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
          Ainda não há instrutores — cria-os em Definições → Contas.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-semibold">Instrutor</th>
                <th className="px-4 py-2.5 text-right font-semibold">Horas feitas</th>
                <th className="px-4 py-2.5 text-right font-semibold">Horas do mês</th>
                <th className="px-4 py-2.5 text-right font-semibold">Extra</th>
                <th className="px-4 py-2.5 text-right font-semibold">{mesEmCurso ? 'Por fazer' : 'Em falta'}</th>
                <th className="px-4 py-2.5 font-semibold">Férias</th>
                <th className="px-4 py-2.5 text-right font-semibold">Sem registo</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const r = l.resumo
                return (
                  <tr key={l.id} className="border-b border-border-subtle/60 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{l.nome}</p>
                      <p className="text-xs text-muted">
                        {l.estudioNome} · {TIPOS_CONTRATO[l.tipoContrato]} · {formatarHoras(r.horasDiarias)}/dia
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{formatarHoras(r.horasRealizadas)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted">{formatarHoras(r.horasEsperadas)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${r.horasExtra > 0 ? 'text-emerald-300' : 'text-muted'}`}>
                      {formatarHoras(r.horasExtra)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${r.saldo < 0 && !mesEmCurso ? 'font-semibold text-red-300' : 'text-muted'}`}>
                      {r.saldo < 0 ? formatarHoras(-r.saldo) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.diasFerias.length ? (
                        <>
                          <span className="font-mono font-semibold text-foreground">{r.diasFerias.length}</span>
                          <span className="ml-1.5 text-xs text-muted">dia{r.diasFerias.length === 1 ? '' : 's'} {listarDiasDoMes(r.diasFerias)}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${r.diasSemRegisto.length ? 'font-semibold text-amber-300' : 'text-muted'}`}>
                      {r.diasSemRegisto.length || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${COR_ESTADO[l.estado]}`}>{ROTULO_ESTADO[l.estado]}</span>
                      {l.estado !== 'Rascunho' && l.submetidoEm && <p className="mt-1 text-[11px] text-muted">a {diaMes(l.submetidoEm)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {l.estado === 'Submetido' && (
                          <form action={reverHorasDoMes}>
                            <input type="hidden" name="mes" value={mesISO} />
                            <input type="hidden" name="perfil_id" value={l.id} />
                            <input type="hidden" name="decisao" value="aprovar" />
                            <SubmitButton pendingText="…" className={botaoCls}>
                              Aprovar
                            </SubmitButton>
                          </form>
                        )}
                        {l.estado !== 'Rascunho' && (
                          <ConfirmarAcao
                            action={reverHorasDoMes}
                            confirmacao={`Reabrir ${nomeMes(mesISO)} de ${l.nome}? Volta a poder alterar os dias e tem de submeter o mês outra vez.`}
                          >
                            <input type="hidden" name="mes" value={mesISO} />
                            <input type="hidden" name="perfil_id" value={l.id} />
                            <input type="hidden" name="decisao" value="reabrir" />
                            <button type="submit" className={botaoSecCls}>
                              Reabrir
                            </button>
                          </ConfirmarAcao>
                        )}
                        {l.estudioSlug && (
                          <Link
                            href={`/painel/${l.estudioSlug}/assiduidade?mes=${mesISO}&pessoa=${l.id}`}
                            className="text-xs text-muted underline hover:text-foreground"
                          >
                            Ver dias
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {linhas.length > 0 && (
        <section className="mt-8 rounded-xl border border-border-subtle bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Para o contabilista</h2>
          <p className="mt-1 text-sm text-muted">
            O mesmo resumo em texto, pronto a colar num email.
            {porSubmeter > 0 && ` Atenção: ${porSubmeter} instrutor${porSubmeter === 1 ? ' ainda não submeteu' : 'es ainda não submeteram'} o mês — os números podem mudar.`}
          </p>
          <div className="mt-3">
            <CopiarResumo texto={texto} />
          </div>
        </section>
      )}
      <section className="mt-8 rounded-xl border border-border-subtle bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Arquivo mensal em PDF</h2>
        <p className="mt-1 text-sm text-muted">
          Um documento por mês com os registos de cada instrutor — horas dia a dia, férias, ausências e escala — para guardar fora da aplicação. O PDF do
          mês anterior é guardado sozinho nos dias 1, 6 e 12 de cada mês (para apanhar o que ainda for submetido ou corrigido). Inclui quem entretanto
          saiu da equipa.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={arquivarMes}>
            <input type="hidden" name="mes" value={mesISO} />
            <SubmitButton pendingText="A guardar…" className={botaoSecCls}>
              {noArquivo ? `Refazer o PDF de ${nomeMes(mesISO)} no arquivo` : `Guardar já ${nomeMes(mesISO)} no arquivo`}
            </SubmitButton>
          </form>
          {noArquivo && <span className="text-xs text-muted">guardado a {diaMes(noArquivo.guardadoEm)}</span>}
        </div>
        {arquivo.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Ainda não há meses guardados.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {arquivo.map((a) => (
              <li key={a.mes}>
                <a
                  href={`${ROTA}/pdf?mes=${a.mes}&arquivo=1`}
                  download
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2 text-sm hover:border-border-strong hover:bg-foreground/[.05]"
                >
                  <span className="flex items-center gap-2 font-semibold text-foreground first-letter:uppercase">
                    <FileDown className="h-4 w-4 text-muted" /> {nomeMes(a.mes)}
                  </span>
                  <span className="text-xs text-muted">
                    guardado a {diaMes(a.guardadoEm)} · {Math.max(1, Math.round(a.bytes / 1024))} KB
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Numero({ rotulo, valor, cor, nota }: { rotulo: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{rotulo}</p>
      <p className={`mt-0.5 font-mono text-xl font-bold ${cor ?? 'text-foreground'}`}>{valor}</p>
      {nota && <p className="text-xs text-muted">{nota}</p>}
    </div>
  )
}
