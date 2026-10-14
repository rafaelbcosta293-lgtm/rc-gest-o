import type { NextRequest } from "next/server"

import { exigirSessao } from "@/lib/auth"
import { feriadoNacional, formatarDiaSemanaCurto, formatarMesAno } from "@/lib/datas"
import { formatarData, formatarHora, formatarHorasDecimais, hojeEmLisboa } from "@/lib/formatar"
import { agruparPorDia, eMesValido, semAcentosParaFicheiro, totaisDoMes } from "@/lib/horas"
import { textoCoordenadas } from "@/lib/mapas"
import { eGerente } from "@/lib/perfis"
import { createClient } from "@/lib/supabase/server"
import { periodosDoMes, pessoasVisiveis, rotuloTrabalho, type PeriodoMapa } from "../_componentes/dados"

/**
 * Exportação do mapa de horas em CSV para o Excel português:
 * separador ";", vírgula decimal e BOM UTF-8 (para os acentos).
 * ?mes=aaaa-mm&colaborador=<id> → períodos de uma pessoa;
 * ?mes=aaaa-mm&todos=1 → resumo de todos (só o gerente).
 */

type Valor = string | number | null | undefined

/**
 * Célula para o Excel. Os textos (títulos, nomes, notas…) ficam sem
 * carateres de controlo (um CR isolado parte a linha), com uma plica antes
 * do que pareça uma fórmula (= + - @) e entre aspas se tiverem ";", aspas
 * ou espaços nas pontas. Os números passam tal como estão.
 */
function celula(valor: Valor): string {
  if (typeof valor === "number") return String(valor)
  let texto = String(valor ?? "").replace(/[\u0000-\u001f\u007f]/g, " ")
  if (/^\s*[=+\-@]/.test(texto)) texto = `'${texto}`
  return /[;"]|^\s|\s$/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function linha(...valores: Valor[]): string {
  return valores.map(celula).join(";")
}

function respostaCsv(linhas: string[], ficheiro: string) {
  return new Response(`\uFEFF${linhas.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ficheiro}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

function respostaErro(estado: number, mensagem: string) {
  return new Response(mensagem, { status: estado, headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

function horas(minutos: number): string {
  return formatarHorasDecimais(minutos)
}

export async function GET(request: NextRequest) {
  const sessao = await exigirSessao()
  const parametros = request.nextUrl.searchParams
  const supabase = await createClient()
  const agora = new Date()
  const mesPedido = parametros.get("mes")
  const mes = eMesValido(mesPedido) ? mesPedido : hojeEmLisboa(agora).slice(0, 7)
  const nomeMes = formatarMesAno(`${mes}-01`)

  // Resumo de todos os colaboradores ativos (gerente).
  if (parametros.get("todos") === "1") {
    if (!eGerente(sessao.colaborador.perfil)) {
      return respostaErro(403, "Só o gerente pode exportar as horas de toda a equipa.")
    }
    const [pessoas, periodos] = await Promise.all([
      pessoasVisiveis(sessao, supabase),
      periodosDoMes(supabase, mes, null),
    ])
    const porPessoa = new Map<string, PeriodoMapa[]>()
    for (const periodo of periodos) {
      porPessoa.set(periodo.colaboradorId, [...(porPessoa.get(periodo.colaboradorId) ?? []), periodo])
    }

    const linhas = [
      linha("Nome", "Equipa", "Dias", "Horas totais", "Minutos", "Normais", "Extra dias úteis", "Extra fins de semana/feriados"),
    ]
    const soma = { dias: 0, minutos: 0, normais: 0, extraUteis: 0, extraFimDeSemana: 0 }
    for (const pessoa of pessoas) {
      const lista = porPessoa.get(pessoa.id) ?? []
      // Ativos, e inativos só se tiverem horas neste mês.
      if (!pessoa.ativo && lista.length === 0) continue
      const totais = totaisDoMes(agruparPorDia(lista, agora))
      soma.dias += totais.dias
      soma.minutos += totais.minutos
      soma.normais += totais.normais
      soma.extraUteis += totais.extraUteis
      soma.extraFimDeSemana += totais.extraFimDeSemana
      linhas.push(
        linha(
          pessoa.nome,
          pessoa.equipa,
          totais.dias,
          horas(totais.minutos),
          totais.minutos,
          horas(totais.normais),
          horas(totais.extraUteis),
          horas(totais.extraFimDeSemana)
        )
      )
    }
    linhas.push(
      "",
      linha(
        "Total",
        "",
        soma.dias,
        horas(soma.minutos),
        soma.minutos,
        horas(soma.normais),
        horas(soma.extraUteis),
        horas(soma.extraFimDeSemana)
      ),
      linha("Mês", nomeMes)
    )
    return respostaCsv(linhas, `horas-equipa-${mes}.csv`)
  }

  // Períodos de uma pessoa (o próprio, a equipa do chefe ou qualquer um para o gerente).
  const pessoas = await pessoasVisiveis(sessao, supabase)
  const pedido = parametros.get("colaborador") || sessao.colaborador.id
  const pessoa = pessoas.find((p) => p.id === pedido)
  if (!pessoa) return respostaErro(403, "Não tem acesso às horas desta pessoa.")

  // O gerente recebe também onde foi picada a entrada e a saída.
  const gerente = eGerente(sessao.colaborador.perfil)
  const periodos = await periodosDoMes(supabase, mes, pessoa.id, { comLocalizacao: gerente })
  const dias = agruparPorDia(periodos, agora)
  const totais = totaisDoMes(dias)

  // "Horas" vem arredondada a 2 casas; "Minutos" é exato e soma sempre o total.
  const linhas = [
    linha(
      "Data",
      "Dia",
      "Entrada",
      "Saída",
      "Trabalho",
      "Cliente",
      "Horas",
      "Minutos",
      "Extra",
      "Notas",
      ...(gerente ? ["Local da entrada", "Local da saída"] : [])
    ),
  ]
  for (const dia of dias) {
    const nomeDia = formatarDiaSemanaCurto(dia.data) + (feriadoNacional(dia.data) ? " (feriado)" : "")
    dia.periodos.forEach((periodo, indice) => {
      const ultimo = indice === dia.periodos.length - 1
      const notas = [
        periodo.notas,
        periodo.saida === null ? "Em curso" : null,
        periodo.aRever ? "A rever" : null,
        periodo.origem === "manual" ? "Introduzido pelo gerente" : null,
      ].filter(Boolean)
      linhas.push(
        linha(
          formatarData(dia.data),
          nomeDia,
          formatarHora(periodo.entrada),
          periodo.saida ? formatarHora(periodo.saida) : "",
          periodo.trabalho?.titulo ?? rotuloTrabalho(periodo),
          periodo.trabalho?.cliente,
          horas(periodo.minutos),
          periodo.minutos,
          // O extra é do dia: fica na última linha de cada dia.
          ultimo && dia.extra > 0 ? horas(dia.extra) : "",
          notas.join(" · "),
          ...(gerente ? [textoCoordenadas(periodo.localEntrada), textoCoordenadas(periodo.localSaida)] : [])
        )
      )
    })
  }
  linhas.push(
    "",
    // O total em horas vem dos minutos (não da soma das linhas arredondadas).
    linha(
      "Total",
      "",
      "",
      "",
      "",
      "",
      horas(totais.minutos),
      totais.minutos,
      horas(totais.extraUteis + totais.extraFimDeSemana),
      ""
    ),
    linha("Normais", "", "", "", "", "", horas(totais.normais), "", "", ""),
    linha("Extra dias úteis", "", "", "", "", "", "", "", horas(totais.extraUteis), ""),
    linha("Extra fins de semana/feriados", "", "", "", "", "", "", "", horas(totais.extraFimDeSemana), ""),
    linha("Dias trabalhados", totais.dias),
    linha("Colaborador", pessoa.nome),
    linha("Mês", nomeMes)
  )
  return respostaCsv(linhas, `horas-${semAcentosParaFicheiro(pessoa.nome)}-${mes}.csv`)
}
