import Link from "next/link"
import { CalendarCheckIcon, UsersIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { ProvedorPicagem } from "@/components/horas/contexto-picagem"
import { carregarEstadoPicagem, ordenarTrabalhosDoDia } from "@/components/horas/estado-picagem"
import { Picagem } from "@/components/horas/picagem"
import { Button } from "@/components/ui/button"
import type { Sessao } from "@/lib/auth"
import { hojeEmLisboa } from "@/lib/formatar"
import { dataEmLisboa } from "@/lib/horas"
import { createClient } from "@/lib/supabase/server"
import { CartaoTrabalhoHoje, type TrabalhoHoje } from "./cartao-trabalho-hoje"

/**
 * "O meu dia" (colaborador e chefe de equipa): picagem e os trabalhos de
 * hoje por ordem de passagem. A RLS decide quais: o colaborador recebe os
 * da sua equipa; o chefe os das equipas que chefia.
 */
export async function OMeuDia({ sessao }: { sessao: Sessao }) {
  const supabase = await createClient()
  const hoje = hojeEmLisboa()
  const [trabalhosR, estado] = await Promise.all([
    supabase
      .from("trabalhos")
      .select(
        `id, titulo, hora_inicio, estado, ordem,
         equipa:equipas(id, nome, cor),
         cliente:clientes(nome, telemovel, telefone),
         local:locais(nome, morada, codigo_postal, localidade, latitude, longitude, notas)`
      )
      .eq("data", hoje),
    carregarEstadoPicagem(sessao.colaborador.id),
  ])
  if (trabalhosR.error) throw new Error(`Não foi possível carregar os trabalhos de hoje: ${trabalhosR.error.message}`)

  const trabalhos: TrabalhoHoje[] = ordenarTrabalhosDoDia(trabalhosR.data)
  const abertoHoje = estado.aberto !== null && dataEmLisboa(estado.aberto.entrada) === estado.hoje
  const trabalhoAtual = abertoHoje ? estado.aberto?.trabalhoId : null

  // Agrupar por equipa só quando há mais do que uma (chefe de várias equipas).
  const grupos = new Map<string, { nome: string | null; cor: string | null; trabalhos: TrabalhoHoje[] }>()
  for (const trabalho of trabalhos) {
    const chave = trabalho.equipa?.id ?? "sem-equipa"
    const grupo = grupos.get(chave) ?? { nome: trabalho.equipa?.nome ?? null, cor: trabalho.equipa?.cor ?? null, trabalhos: [] }
    grupo.trabalhos.push(trabalho)
    grupos.set(chave, grupo)
  }
  const chefe = sessao.colaborador.perfil === "chefe_equipa"

  return (
    <ProvedorPicagem colaboradorId={sessao.colaborador.id}>
      <div className="grid gap-6">
        <Picagem estado={estado} />

        <section aria-labelledby="titulo-trabalhos-hoje" className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="titulo-trabalhos-hoje" className="text-lg font-semibold">
              Trabalhos de hoje
              {trabalhos.length > 0 && <span className="font-normal text-muted-foreground"> · {trabalhos.length}</span>}
            </h2>
            {chefe && (
              <Button asChild variant="ghost" size="sm" className="h-11">
                <Link href="/agenda?vista=dia">Ver agenda</Link>
              </Button>
            )}
          </div>

          {trabalhos.length === 0 ? (
            !chefe && !sessao.colaborador.equipaId ? (
              <EstadoVazio
                icone={UsersIcon}
                titulo="Ainda não tem equipa atribuída"
                descricao="Fale com o gerente. Pode picar as horas na mesma."
              />
            ) : (
              <EstadoVazio
                icone={CalendarCheckIcon}
                titulo="Não há trabalhos para hoje"
                descricao={chefe ? "Os trabalhos marcados na agenda para hoje aparecem aqui." : undefined}
              />
            )
          ) : (
            [...grupos.entries()].map(([chave, grupo]) => (
              <div key={chave} className="grid gap-2">
                {grupos.size > 1 && (
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full bg-muted-foreground"
                      style={grupo.cor ? { backgroundColor: grupo.cor } : undefined}
                      aria-hidden="true"
                    />
                    {grupo.nome ?? "Sem equipa"}
                  </h3>
                )}
                <ul className="grid gap-3 lg:grid-cols-2">
                  {grupo.trabalhos.map((trabalho) => (
                    <CartaoTrabalhoHoje
                      key={trabalho.id}
                      trabalho={trabalho}
                      atual={trabalhoAtual === trabalho.id}
                      aTrabalhar={abertoHoje}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </ProvedorPicagem>
  )
}
