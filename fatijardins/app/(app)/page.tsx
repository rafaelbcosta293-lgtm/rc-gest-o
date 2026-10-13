import Link from "next/link"
import {
  CalendarOffIcon,
  ChevronRightIcon,
  MapPinIcon,
  TreesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { exigirSessao, type Sessao } from "@/lib/auth"
import { formatarData, formatarDataExtenso, hojeEmLisboa, somarDias } from "@/lib/formatar"
import { eGerenteOuChefe } from "@/lib/perfis"
import { NOMES_TIPO_AUSENCIA } from "@/lib/rotulos"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Início" }

function saudacao(agora: Date) {
  const hora = Number(
    new Intl.DateTimeFormat("pt-PT", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Lisbon" }).format(agora)
  )
  if (hora < 12) return "Bom dia"
  if (hora < 20) return "Boa tarde"
  return "Boa noite"
}

export default async function Inicio() {
  const sessao = await exigirSessao()
  const agora = new Date()
  const primeiroNome = sessao.colaborador.nome.split(" ")[0]
  const dataHoje = formatarDataExtenso(agora)

  return (
    <>
      <CabecalhoPagina
        titulo={`${saudacao(agora)}, ${primeiroNome}`}
        descricao={dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1)}
      />
      <div className="grid gap-6">
        {eGerenteOuChefe(sessao.colaborador.perfil) ? (
          <Resumo />
        ) : (
          <MinhaEquipa sessao={sessao} />
        )}
        <ProximasAusencias />
      </div>
    </>
  )
}

function Indicador({
  href,
  icone: Icone,
  rotulo,
  valor,
}: {
  href: string
  icone: LucideIcon
  rotulo: string
  valor: number | null
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/50 sm:gap-3 sm:p-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground sm:size-11">
        <Icone className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-tight font-semibold tabular-nums">{valor ?? "—"}</span>
        <span className="block text-sm leading-tight text-balance text-muted-foreground">{rotulo}</span>
      </span>
    </Link>
  )
}

async function Resumo() {
  const supabase = await createClient()
  const [clientes, locais, colaboradores, equipas] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("locais").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("colaboradores").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("equipas").select("id", { count: "exact", head: true }).eq("ativa", true),
  ])

  return (
    <section aria-label="Resumo" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
      <Indicador href="/clientes" icone={TreesIcon} rotulo="Clientes ativos" valor={clientes.count} />
      <Indicador href="/clientes" icone={MapPinIcon} rotulo="Locais / jardins" valor={locais.count} />
      <Indicador href="/equipa" icone={UsersIcon} rotulo="Colaboradores" valor={colaboradores.count} />
      <Indicador href="/equipa/equipas" icone={UsersIcon} rotulo="Equipas" valor={equipas.count} />
    </section>
  )
}

async function MinhaEquipa({ sessao }: { sessao: Sessao }) {
  const supabase = await createClient()
  const equipaId = sessao.colaborador.equipaId

  const [{ data: equipa }, { data: colegas }] = equipaId
    ? await Promise.all([
        supabase.from("equipas").select("nome, chefe_id").eq("id", equipaId).maybeSingle(),
        supabase
          .from("colaboradores")
          .select("id, nome, funcao, telemovel")
          .eq("equipa_id", equipaId)
          .eq("ativo", true)
          .order("nome"),
      ])
    : [{ data: null }, { data: [] }]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{equipa ? equipa.nome : "Sem equipa atribuída"}</CardTitle>
        <CardDescription>
          Os seus trabalhos do dia vão aparecer aqui quando a agenda estiver disponível.
        </CardDescription>
      </CardHeader>
      {colegas && colegas.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {colegas.map((colega) => (
              <li key={colega.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {colega.nome}
                    {colega.id === sessao.colaborador.id && (
                      <span className="text-muted-foreground"> (eu)</span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">{colega.funcao}</span>
                </span>
                {colega.id === equipa?.chefe_id && <Badge variant="secondary">Chefe</Badge>}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

async function ProximasAusencias() {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const { data: ausencias } = await supabase
    .from("ausencias")
    .select("id, tipo, data_inicio, data_fim, colaborador:colaboradores(id, nome)")
    .lte("data_inicio", somarDias(hoje, 30))
    .gte("data_fim", hoje)
    .order("data_inicio")
    .limit(10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ausências nos próximos 30 dias</CardTitle>
      </CardHeader>
      <CardContent>
        {!ausencias || ausencias.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarOffIcon className="size-4" />
            Não há ausências marcadas.
          </p>
        ) : (
          <ul className="divide-y">
            {ausencias.map((ausencia) => (
              <li key={ausencia.id}>
                <Link
                  href={`/equipa/colaboradores/${ausencia.colaborador?.id}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{ausencia.colaborador?.nome}</span>
                    <span className="block text-sm text-muted-foreground">
                      {ausencia.data_inicio === ausencia.data_fim
                        ? formatarData(ausencia.data_inicio)
                        : `${formatarData(ausencia.data_inicio)} a ${formatarData(ausencia.data_fim)}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={ausencia.data_inicio <= hoje ? "default" : "secondary"}>
                      {NOMES_TIPO_AUSENCIA[ausencia.tipo]}
                    </Badge>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
