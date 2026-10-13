import { Suspense } from "react"
import Link from "next/link"
import { ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { EstadoVazio } from "@/components/estado-vazio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exigirSessao } from "@/lib/auth"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { EsqueletoListaCartoes } from "../_componentes/esqueletos"

export const metadata = { title: "Equipas" }

export default function PaginaEquipas() {
  return (
    <>
      <CabecalhoPagina
        titulo="Equipas"
        acoes={
          <Suspense fallback={null}>
            <BotaoNovaEquipa />
          </Suspense>
        }
      />
      <Suspense fallback={<EsqueletoListaCartoes />}>
        <ListaEquipas />
      </Suspense>
    </>
  )
}

async function BotaoNovaEquipa() {
  const sessao = await exigirSessao()
  if (!eGerente(sessao.colaborador.perfil)) return null
  return (
    <Button asChild size="lg">
      <Link href="/equipa/equipas/nova">
        <PlusIcon />
        Nova equipa
      </Link>
    </Button>
  )
}

async function ListaEquipas() {
  const sessao = await exigirSessao()
  const gerente = eGerente(sessao.colaborador.perfil)
  const supabase = await createClient()

  const [equipasRes, membrosRes] = await Promise.all([
    supabase
      .from("equipas")
      .select("id, nome, cor, ativa, chefe:colaboradores!equipas_chefe_id_fkey(id, nome)")
      .order("ativa", { ascending: false })
      .order("nome"),
    supabase.from("colaboradores").select("equipa_id").eq("ativo", true).not("equipa_id", "is", null),
  ])
  if (equipasRes.error) throw new Error(`Erro ao ler as equipas: ${equipasRes.error.message}`)
  if (membrosRes.error) throw new Error(`Erro ao ler os membros: ${membrosRes.error.message}`)

  const membrosPorEquipa = new Map<string, number>()
  for (const { equipa_id } of membrosRes.data) {
    if (equipa_id) membrosPorEquipa.set(equipa_id, (membrosPorEquipa.get(equipa_id) ?? 0) + 1)
  }
  const equipas = equipasRes.data
  const ativas = equipas.filter((e) => e.ativa).length
  const inativas = equipas.length - ativas
  let resumo = `${ativas} ${ativas === 1 ? "equipa ativa" : "equipas ativas"}`
  if (inativas > 0) resumo += ` e ${inativas} ${inativas === 1 ? "inativa" : "inativas"}`

  return (
    <>
      {equipas.length === 0 ? (
        <EstadoVazio
          icone={UsersIcon}
          titulo="Ainda não há equipas"
          descricao={gerente ? "Crie as equipas de campo e escolha o chefe de cada uma." : undefined}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{resumo}</p>
          <ul className="grid gap-3 lg:grid-cols-2">
            {equipas.map((equipa) => {
              const membros = membrosPorEquipa.get(equipa.id) ?? 0
              return (
                <li key={equipa.id}>
                  <Link
                    href={`/equipa/equipas/${equipa.id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40",
                      !equipa.ativa && "bg-muted/40"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full text-white",
                        !equipa.ativa && "opacity-50"
                      )}
                      style={{ backgroundColor: equipa.cor }}
                    >
                      <UsersIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{equipa.nome}</span>
                        {!equipa.ativa && <Badge variant="muted">Inativa</Badge>}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {equipa.chefe ? `Chefe: ${equipa.chefe.nome}` : "Sem chefe"}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {membros} {membros === 1 ? "membro ativo" : "membros ativos"}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
