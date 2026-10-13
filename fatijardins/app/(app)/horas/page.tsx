import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, DownloadIcon, TriangleAlertIcon, UsersIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exigirSessao } from "@/lib/auth"
import { formatarMesAno } from "@/lib/datas"
import { formatarData, formatarDuracao, formatarHora, formatarHorasDecimais, hojeEmLisboa } from "@/lib/formatar"
import {
  agruparPorDia,
  dataEmLisboa,
  eMesValido,
  horasPorTrabalho,
  intervaloDoMes,
  somarMesesMes,
  totaisDoMes,
  type TotaisMes,
} from "@/lib/horas"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { periodosDoMes, pessoasVisiveis, rotuloTrabalho } from "./_componentes/dados"
import { BotaoAdicionarPeriodo, EditorPeriodos, type TrabalhoDoMes } from "./_componentes/editor-periodos"
import { EsqueletoMapa } from "./_componentes/esqueletos"
import { ListaDias } from "./_componentes/lista-dias"
import { SeletorPessoa } from "./_componentes/seletor-pessoa"

export const metadata = { title: "Horas" }

type ParametrosPesquisa = PageProps<"/horas">["searchParams"]

function primeiroValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

export default function PaginaHoras(props: PageProps<"/horas">) {
  return (
    <>
      <CabecalhoPagina titulo="Horas" descricao="Mapa mensal das horas picadas" />
      <Suspense fallback={<EsqueletoMapa />}>
        <MapaHoras searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}

function Indicador({ rotulo, minutos, destaque, texto }: { rotulo: string; minutos?: number; destaque?: boolean; texto?: string }) {
  return (
    <div
      className={
        destaque
          ? "col-span-2 rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm sm:p-4 lg:col-span-1"
          : "rounded-xl border bg-card p-3 shadow-sm sm:p-4"
      }
    >
      <p className="text-sm leading-tight text-muted-foreground">{rotulo}</p>
      <p className={destaque ? "mt-1 text-2xl font-semibold tabular-nums" : "mt-1 text-xl font-semibold tabular-nums"}>
        {texto ?? formatarDuracao(minutos)}
      </p>
      {minutos !== undefined && minutos > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">{formatarHorasDecimais(minutos)} h</p>
      )}
    </div>
  )
}

function Totais({ totais }: { totais: TotaisMes }) {
  return (
    <section aria-label="Totais do mês" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Indicador rotulo="Total" minutos={totais.minutos} destaque />
      <Indicador rotulo="Normais" minutos={totais.normais} />
      <Indicador rotulo="Extra dias úteis" minutos={totais.extraUteis} />
      <Indicador rotulo="Extra fins de semana/feriados" minutos={totais.extraFimDeSemana} />
      <Indicador rotulo="Dias trabalhados" texto={String(totais.dias)} />
    </section>
  )
}

async function MapaHoras({ searchParams }: { searchParams: ParametrosPesquisa }) {
  const sessao = await exigirSessao()
  const parametros = await searchParams
  const supabase = await createClient()
  // Hora atual depois do createClient() (pedido dinâmico).
  const agora = new Date()
  const hoje = hojeEmLisboa(agora)
  const mesAtual = hoje.slice(0, 7)
  const mesPedido = primeiroValor(parametros.mes)
  const mes = eMesValido(mesPedido) ? mesPedido : mesAtual
  const gerente = eGerente(sessao.colaborador.perfil)

  // Só se mostram as horas de quem a pessoa pode ver; um id de outra pessoa no endereço é ignorado.
  const pessoas = await pessoasVisiveis(sessao, supabase)
  const pedido = primeiroValor(parametros.colaborador)
  const escolhida = pedido ? pessoas.find((pessoa) => pessoa.id === pedido) : undefined
  const pessoa = escolhida ?? pessoas.find((p) => p.id === sessao.colaborador.id) ?? pessoas[0]
  const semAcesso = Boolean(pedido) && !escolhida

  const intervalo = intervaloDoMes(mes)
  const [periodos, trabalhosR] = await Promise.all([
    periodosDoMes(supabase, mes, pessoa.id),
    gerente
      ? supabase
          .from("trabalhos")
          .select("id, data, titulo, hora_inicio, cliente:clientes(nome), equipa:equipas(nome)")
          .gte("data", intervalo.primeiro)
          .lte("data", intervalo.ultimo)
          .neq("estado", "cancelado")
          .order("data")
          .order("hora_inicio", { nullsFirst: false })
      : null,
  ])
  if (trabalhosR?.error) throw new Error(`Não foi possível carregar os trabalhos: ${trabalhosR.error.message}`)

  const dias = agruparPorDia(periodos, agora)
  const totais = totaisDoMes(dias)
  const porTrabalho = horasPorTrabalho(periodos, agora)
  // Dias do mês até hoje (mais algum dia com horas, por precaução).
  const datas = intervalo.dias.filter((data) => data <= hoje || dias.some((dia) => dia.data === data))

  const trabalhosDoMes: TrabalhoDoMes[] = (trabalhosR?.data ?? []).map((trabalho) => ({
    id: trabalho.id,
    data: trabalho.data,
    // Ex.: "08:30 · Manutenção semanal — Condomínio X (Equipa Verde)"
    rotulo:
      `${trabalho.hora_inicio ? formatarHora(trabalho.hora_inicio) : "Sem hora"} · ${trabalho.titulo}` +
      (trabalho.cliente ? ` — ${trabalho.cliente.nome}` : "") +
      (trabalho.equipa ? ` (${trabalho.equipa.nome})` : ""),
  }))

  const eu = pessoa.id === sessao.colaborador.id
  const urlMes = (outro: string) => {
    const parametrosUrl = new URLSearchParams({ mes: outro })
    if (!eu) parametrosUrl.set("colaborador", pessoa.id)
    return `/horas?${parametrosUrl}`
  }
  const nomeMes = formatarMesAno(intervalo.primeiro)
  const exportar = new URLSearchParams({ mes, colaborador: pessoa.id })

  const conteudo = (
    <div className="grid gap-5">
      {semAcesso && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Não tem acesso às horas dessa pessoa. Está a ver as suas horas.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {pessoas.length > 1 && (
          <div className="w-full sm:w-72">
            <SeletorPessoa pessoas={pessoas} atual={pessoa.id} mes={mes} />
          </div>
        )}
        <nav aria-label="Mês" className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon-lg">
            <Link href={urlMes(somarMesesMes(mes, -1))} aria-label="Mês anterior" scroll={false}>
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <p className="min-w-40 px-2 text-center font-semibold" aria-live="polite">
            {nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}
          </p>
          {mes < mesAtual ? (
            <Button asChild variant="outline" size="icon-lg">
              <Link href={urlMes(somarMesesMes(mes, 1))} aria-label="Mês seguinte" scroll={false}>
                <ChevronRightIcon className="size-5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon-lg" disabled aria-label="Mês seguinte">
              <ChevronRightIcon className="size-5" />
            </Button>
          )}
        </nav>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          {gerente && <BotaoAdicionarPeriodo />}
          <Button asChild variant="outline" size="lg">
            <a href={`/horas/exportar?${exportar}`} download>
              <DownloadIcon />
              Exportar CSV
            </a>
          </Button>
          {gerente && (
            <Button asChild variant="outline" size="lg">
              <a href={`/horas/exportar?${new URLSearchParams({ mes, todos: "1" })}`} download>
                <UsersIcon />
                Exportar equipa (CSV)
              </a>
            </Button>
          )}
        </div>
      </div>

      {pessoas.length > 1 && (
        <h2 className="-mb-2 text-lg font-semibold">
          {pessoa.nome}
          {pessoa.equipa && <span className="font-normal text-muted-foreground"> · {pessoa.equipa}</span>}
        </h2>
      )}

      <Totais totais={totais} />

      {datas.length === 0 ? (
        <EstadoVazio icone={ClockIcon} titulo="Este mês ainda não começou" />
      ) : (
        <ListaDias datas={datas} dias={dias} gerente={gerente} ligarTrabalhos={sessao.colaborador.perfil !== "colaborador"} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Horas por trabalho</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porTrabalho.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem horas registadas neste mês.</p>
          ) : (
            <ul className="divide-y">
              {porTrabalho.map((grupo) => (
                <li key={grupo.trabalhoId ?? "sem-trabalho"} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className={grupo.trabalhoId ? "block font-medium" : "block text-muted-foreground"}>
                      {rotuloTrabalho(grupo.exemplo)}
                    </span>
                    {grupo.trabalhoId && (
                      <span className="block text-sm text-muted-foreground">
                        {formatarData(grupo.exemplo.trabalho?.data ?? dataEmLisboa(grupo.exemplo.entrada))}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">{formatarDuracao(grupo.minutos)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatarHorasDecimais(grupo.minutos)} h
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )

  if (!gerente) return conteudo
  return (
    <EditorPeriodos
      key={`${pessoa.id}-${mes}`}
      colaboradorId={pessoa.id}
      nome={pessoa.nome}
      trabalhos={trabalhosDoMes}
      dataSugerida={mes === mesAtual ? hoje : intervalo.primeiro}
    >
      {conteudo}
    </EditorPeriodos>
  )
}
