import { Suspense } from "react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirSessao } from "@/lib/auth"
import { formatarDataExtenso } from "@/lib/formatar"
import { ProximasAusencias } from "./_inicio/ausencias"
import { CobrancasAtraso } from "./_inicio/cobrancas"
import {
  EsqueletoCartao,
  EsqueletoInicio,
  EsqueletoOMeuDia,
  EsqueletoPicagem,
  EsqueletoResumo,
} from "./_inicio/esqueletos"
import { ATrabalharAgora, HojePorEquipa, HorasARever, PicagemGerente } from "./_inicio/gerente"
import { OMeuDia } from "./_inicio/o-meu-dia"
import { EquipamentosAtencao, StockBaixo } from "./_inicio/recursos"
import { Resumo } from "./_inicio/resumo"
import { ProximasVisitas } from "./_inicio/visitas"

export const metadata = { title: "Início" }

function saudacao(agora: Date) {
  const hora = Number(
    new Intl.DateTimeFormat("pt-PT", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Lisbon" }).format(agora)
  )
  if (hora < 12) return "Bom dia"
  if (hora < 20) return "Boa tarde"
  return "Boa noite"
}

export default function Inicio() {
  return (
    <Suspense fallback={<EsqueletoInicio />}>
      <ConteudoInicio />
    </Suspense>
  )
}

async function ConteudoInicio() {
  const sessao = await exigirSessao()
  // Hora atual só depois de ler a sessão (pedido dinâmico).
  const agora = new Date()
  const primeiroNome = sessao.colaborador.nome.split(" ")[0]
  const dataHoje = formatarDataExtenso(agora)
  const perfil = sessao.colaborador.perfil

  return (
    <>
      <CabecalhoPagina
        titulo={`${saudacao(agora)}, ${primeiroNome}`}
        descricao={dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1)}
      />
      {perfil === "gerente" ? (
        <div className="grid gap-6">
          <Suspense fallback={<EsqueletoResumo />}>
            <Resumo />
          </Suspense>
          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<EsqueletoCartao />}>
              <HojePorEquipa />
            </Suspense>
            <Suspense fallback={<EsqueletoCartao />}>
              <ATrabalharAgora />
            </Suspense>
            {/* Alertas (cobranças e recursos): só aparecem quando há alguma coisa a tratar. */}
            <Suspense fallback={<EsqueletoCartao />}>
              <CobrancasAtraso />
            </Suspense>
            <Suspense fallback={<EsqueletoCartao />}>
              <EquipamentosAtencao sessao={sessao} />
            </Suspense>
            <Suspense fallback={<EsqueletoCartao />}>
              <StockBaixo />
            </Suspense>
            <Suspense fallback={<EsqueletoCartao />}>
              <HorasARever />
            </Suspense>
            <Suspense fallback={<EsqueletoPicagem />}>
              <PicagemGerente sessao={sessao} />
            </Suspense>
          </div>
          <Suspense fallback={<EsqueletoCartao />}>
            <ProximasVisitas />
          </Suspense>
          <Suspense fallback={<EsqueletoCartao />}>
            <ProximasAusencias />
          </Suspense>
        </div>
      ) : (
        <div className="grid gap-6">
          <Suspense fallback={<EsqueletoOMeuDia />}>
            <OMeuDia sessao={sessao} />
          </Suspense>
          {perfil === "chefe_equipa" && (
            <>
              {/* Recursos: só aparecem quando há alguma coisa a tratar (sem nada, o bloco fica vazio e escondido). */}
              <div className="grid gap-6 empty:hidden lg:grid-cols-2">
                <Suspense fallback={<EsqueletoCartao />}>
                  <EquipamentosAtencao sessao={sessao} />
                </Suspense>
                <Suspense fallback={<EsqueletoCartao />}>
                  <StockBaixo />
                </Suspense>
              </div>
              <Suspense fallback={<EsqueletoResumo />}>
                <Resumo />
              </Suspense>
              <Suspense fallback={<EsqueletoCartao />}>
                <ProximasVisitas />
              </Suspense>
            </>
          )}
          <Suspense fallback={<EsqueletoCartao />}>
            <ProximasAusencias />
          </Suspense>
        </div>
      )}
    </>
  )
}
