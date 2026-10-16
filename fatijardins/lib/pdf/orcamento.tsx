import "server-only"

import { Document, Page, Path, Rect, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer"

import { formatarData, formatarMoeda, formatarNumero } from "@/lib/formatar"
import {
  calcularTotais,
  formatarNumeroOrcamento,
  NOMES_TIPO_LINHA,
  nomeTaxaIva,
  TIPOS_LINHA,
  totalLinha,
  type TipoLinhaOrcamento,
} from "@/lib/orcamentos"
import type { Tables } from "@/lib/supabase/database.types"
import { registarFontes, type FontePdf } from "./fontes"

export type DadosPdfOrcamento = {
  orcamento: Pick<
    Tables<"orcamentos">,
    "ano" | "numero" | "titulo" | "descricao" | "data" | "validade" | "estado" | "condicoes"
  >
  linhas: Pick<
    Tables<"orcamento_linhas">,
    "tipo" | "descricao" | "quantidade" | "unidade" | "preco_unitario" | "taxa_iva" | "total"
  >[]
  cliente: Pick<Tables<"clientes">, "nome" | "nif" | "morada" | "codigo_postal" | "localidade"> | null
  local: Pick<Tables<"locais">, "nome" | "morada" | "codigo_postal" | "localidade"> | null
  empresa: Pick<
    Tables<"empresa">,
    "nome" | "nif" | "morada" | "codigo_postal" | "localidade" | "telefone" | "email" | "website" | "iban"
  > | null
}

// Cores da marca (as de components/logotipo.tsx) e tons sóbrios para o texto.
const VERDE = "#15803d"
const VERDE_ESCURO = "#14532d"
const VERDE_CLARO = "#f0fdf4"
const FOLHA_COR = "#dcfce7"
const TEXTO = "#1c1917"
const SUAVE = "#57534e"
const FILETE = "#e7e5e4"
const VERMELHO = "#b91c1c"

/** Folha do símbolo da Fatijardins (a mesma de components/logotipo.tsx). */
const FOLHA = "M47 15C30 15 18 24 18 38c0 4 1 7 3 10 2-9 8-17 17-22-7 6-11 13-13 23 3 1 5 1 8 1 13 0 19-11 17-35z"

// ---------------------------------------------------------------------
// Texto: o Intl pode usar espaços finos (U+202F, U+2009…) nos milhares e
// antes do "€", e há carateres que a fonte não tem (hífen inseparável,
// espaços especiais, hífen condicional, emojis…): trocam-se por
// equivalentes ou saem.
// ---------------------------------------------------------------------

const ESPACOS_ESPECIAIS = /[\u2000-\u200A\u202F\u205F\u3000]/g
const INVISIVEIS = /[\u00AD\u200B\u2060\uFEFF]/g

/** Texto escrito pelas pessoas: espaços e hífenes especiais viram os normais. */
function texto(valor: string | null | undefined): string {
  if (!valor) return ""
  return valor
    // Acentos escritos à parte (e + ´, como alguns teclados os gravam) juntam-se à letra.
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(ESPACOS_ESPECIAIS, " ")
    .replace(INVISIVEIS, "")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/\u2012/g, "\u2013")
    .replace(/\u2300/g, "\u00D8")
    .trim()
}

/**
 * Só os carateres que a fonte tem: os outros passam à forma compatível
 * (™ → TM, ﬁ → fi) se a fonte a tiver, senão saem (emojis, ideogramas…),
 * para não aparecerem quadrados ou símbolos trocados no PDF.
 */
function soCarateresDaFonte(valor: string, temCarater: FontePdf["temCarater"]): string {
  let resultado = ""
  let retirados = false
  for (const carater of valor) {
    if (carater === "\n" || temCarater(carater.codePointAt(0) ?? 0)) {
      resultado += carater
      continue
    }
    const compativel = carater.normalize("NFKC")
    if (compativel !== carater && [...compativel].every((c) => temCarater(c.codePointAt(0) ?? 0))) {
      resultado += compativel
    } else {
      retirados = true
    }
  }
  // Sem espaços duplos onde estava um emoji.
  return retirados ? resultado.replace(/ {2,}/g, " ").trim() : resultado
}

/** Aplica a limpeza a todos os textos de um registo (os outros valores ficam iguais). */
function limparRegisto<T extends object>(registo: T, limpar: (valor: string) => string): T {
  return Object.fromEntries(
    Object.entries(registo).map(([chave, valor]) => [chave, typeof valor === "string" ? limpar(valor) : valor])
  ) as T
}

/** Números formatados: os espaços dos milhares e antes do "€" ficam inseparáveis. */
function numero(formatado: string): string {
  return formatado.replace(ESPACOS_ESPECIAIS, "\u00A0")
}

function moeda(valor: number): string {
  return numero(formatarMoeda(valor))
}

const formatoQuantidade = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3, useGrouping: "always" })

function quantidade(valor: number): string {
  return numero(formatoQuantidade.format(valor))
}

function percentagem(taxa: number): string {
  return `${formatarNumero(taxa)}%`
}

/** "2765-001 Estoril" (o que houver). */
function codigoPostalLocalidade(dados: { codigo_postal: string | null; localidade: string | null }): string {
  return texto([dados.codigo_postal, dados.localidade].filter(Boolean).join(" "))
}

// ---------------------------------------------------------------------
// Estilos (pontos; A4 = 595 × 842)
// ---------------------------------------------------------------------

const MARGEM = 40

const estilos = StyleSheet.create({
  // Sem lineHeight na página (herdado, faz desaparecer os textos com render,
  // como a paginação, no @react-pdf/renderer 4.9). Onde é preciso, vai com o
  // fontSize no mesmo estilo: sem ele, o fator aplica-se ao tamanho por omissão (18).
  pagina: {
    paddingTop: 44,
    paddingBottom: 70,
    paddingHorizontal: MARGEM,
    fontSize: 9,
    color: TEXTO,
  },
  // Cabeçalho da 1.ª página
  cabecalho: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  empresa: { flexDirection: "row", gap: 10, flex: 1 },
  nomeEmpresa: { fontSize: 15, fontWeight: 600, color: VERDE_ESCURO, lineHeight: 1.2, marginBottom: 3 },
  dadoEmpresa: { fontSize: 8, color: SUAVE },
  caixaNumero: { alignItems: "flex-end", maxWidth: 230 },
  tituloDocumento: { fontSize: 15, fontWeight: 700, color: VERDE, letterSpacing: 0.6, lineHeight: 1.2 },
  datas: { marginTop: 6, gap: 1 },
  data: { flexDirection: "row", justifyContent: "flex-end", gap: 6, fontSize: 9 },
  rotuloData: { color: SUAVE },
  valorData: { fontWeight: 600, minWidth: 58, textAlign: "right" },
  filete: { height: 2, backgroundColor: VERDE, marginTop: 14, marginBottom: 14 },
  // Rascunho
  avisoRascunho: {
    borderWidth: 1.5,
    borderColor: VERMELHO,
    borderRadius: 4,
    color: VERMELHO,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
    fontSize: 9.5,
  },
  marcaAgua: {
    position: "absolute",
    top: 370,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 80,
    fontWeight: 700,
    letterSpacing: 2,
    color: VERMELHO,
    opacity: 0.12,
    transform: "rotate(-32deg)",
  },
  // Cliente e local
  partes: { flexDirection: "row", gap: 12, marginBottom: 16 },
  parte: {
    flex: 1,
    backgroundColor: "#fafaf9",
    borderWidth: 0.75,
    borderColor: FILETE,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rotulo: { fontSize: 7.5, fontWeight: 600, color: VERDE, letterSpacing: 0.4, marginBottom: 3 },
  nomeParte: { fontSize: 10, fontWeight: 600, marginBottom: 1 },
  dadoParte: { color: SUAVE },
  // Assunto
  titulo: { fontSize: 13, fontWeight: 600, color: VERDE_ESCURO, marginBottom: 4 },
  descricao: { fontSize: 9.5, lineHeight: 1.45, marginBottom: 4 },
  // Tabela das linhas
  tabela: { marginTop: 10 },
  cabecalhoTabela: {
    flexDirection: "row",
    backgroundColor: VERDE,
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: 600,
    letterSpacing: 0.3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  grupo: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: VERDE_CLARO,
    borderBottomWidth: 0.75,
    borderBottomColor: "#bbf7d0",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 6,
    fontWeight: 600,
    color: VERDE_ESCURO,
  },
  linha: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: FILETE,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  colDescricao: { flex: 1, paddingRight: 8 },
  colQuantidade: { width: 46, textAlign: "right" },
  colUnidade: { width: 36, paddingLeft: 6 },
  colPreco: { width: 66, textAlign: "right" },
  colIva: { width: 34, textAlign: "right" },
  colTotal: { width: 74, textAlign: "right" },
  semLinhas: { paddingVertical: 10, paddingHorizontal: 6, color: SUAVE },
  // Totais
  resumo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginTop: 16 },
  quadroIva: { width: 250 },
  cabecalhoIva: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: TEXTO,
    paddingBottom: 2,
    fontSize: 7.5,
    fontWeight: 600,
    color: SUAVE,
  },
  linhaIva: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: FILETE },
  colTaxa: { flex: 1 },
  colBase: { width: 80, textAlign: "right" },
  colValorIva: { width: 70, textAlign: "right" },
  totais: { width: 220 },
  linhaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: VERDE,
    color: "#ffffff",
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
  },
  // Condições
  secao: { marginTop: 20 },
  tituloSecao: { fontSize: 10, fontWeight: 600, color: VERDE_ESCURO, marginBottom: 4 },
  textoSecao: { fontSize: 9, lineHeight: 1.45 },
  iban: { marginTop: 6 },
  // Cabeçalho das páginas seguintes e rodapé
  continuacao: { position: "absolute", top: 20, left: MARGEM, right: MARGEM },
  linhaContinuacao: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: SUAVE,
    borderBottomWidth: 0.5,
    borderBottomColor: FILETE,
    paddingBottom: 3,
  },
  rodape: {
    position: "absolute",
    bottom: 26,
    left: MARGEM,
    right: MARGEM,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    borderTopWidth: 0.75,
    borderTopColor: FILETE,
    paddingTop: 6,
    fontSize: 7.5,
    color: SUAVE,
  },
  avisoFatura: { fontWeight: 600, color: TEXTO },
  paginacao: { width: 90, textAlign: "right" },
})

// ---------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------

function Simbolo({ tamanho }: { tamanho: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={16} fill={VERDE} />
      <Path d={FOLHA} fill={FOLHA_COR} />
    </Svg>
  )
}

function Colunas({ celulas }: { celulas: [string, string, string, string, string, string] }) {
  const [descricao, qtd, unidade, preco, iva, total] = celulas
  return (
    <>
      <Text style={estilos.colDescricao}>{descricao}</Text>
      <Text style={estilos.colQuantidade}>{qtd}</Text>
      <Text style={estilos.colUnidade}>{unidade}</Text>
      <Text style={estilos.colPreco}>{preco}</Text>
      <Text style={estilos.colIva}>{iva}</Text>
      <Text style={estilos.colTotal}>{total}</Text>
    </>
  )
}

type Linha = DadosPdfOrcamento["linhas"][number]

function agruparPorTipo(linhas: Linha[]): { tipo: TipoLinhaOrcamento; linhas: Linha[] }[] {
  return TIPOS_LINHA.map((tipo) => ({ tipo, linhas: linhas.filter((linha) => linha.tipo === tipo) })).filter(
    (grupo) => grupo.linhas.length > 0
  )
}

function DocumentoOrcamento({ dados, fonte }: { dados: DadosPdfOrcamento; fonte: string }) {
  const { orcamento, linhas, cliente, local, empresa } = dados
  const numero = formatarNumeroOrcamento(orcamento.ano, orcamento.numero)
  const rascunho = orcamento.estado === "rascunho"
  const totais = calcularTotais(linhas)
  const grupos = agruparPorTipo(linhas)
  const nomeEmpresa = texto(empresa?.nome) || "Fatijardins"

  const dadosEmpresa = [
    texto(empresa?.morada),
    empresa ? codigoPostalLocalidade(empresa) : "",
    empresa?.nif ? `NIF ${empresa.nif}` : "",
    [empresa?.telefone && `Tel. ${texto(empresa.telefone)}`, texto(empresa?.email)].filter(Boolean).join("  ·  "),
    texto(empresa?.website),
  ].filter(Boolean)

  const condicoes = texto(orcamento.condicoes)
  const iban = texto(empresa?.iban)

  return (
    <Document
      title={`Orçamento ${numero} — ${texto(orcamento.titulo)}`}
      subject={texto(orcamento.titulo)}
      author={nomeEmpresa}
      creator={nomeEmpresa}
      producer={nomeEmpresa}
      language="pt-PT"
    >
      <Page size="A4" style={[estilos.pagina, { fontFamily: fonte }]}>
        {/* Páginas seguintes: lembrete do documento no topo. */}
        <View
          fixed
          style={estilos.continuacao}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={estilos.linhaContinuacao}>
                <Text>{nomeEmpresa}</Text>
                <Text>
                  Orçamento n.º {numero}
                  {rascunho ? " (RASCUNHO)" : ""} — continuação
                </Text>
              </View>
            ) : null
          }
        />

        <View style={estilos.cabecalho}>
          <View style={estilos.empresa}>
            <Simbolo tamanho={44} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.nomeEmpresa}>{nomeEmpresa}</Text>
              {dadosEmpresa.map((dado, i) => (
                <Text key={i} style={estilos.dadoEmpresa}>
                  {dado}
                </Text>
              ))}
            </View>
          </View>
          <View style={estilos.caixaNumero}>
            <Text style={estilos.tituloDocumento}>ORÇAMENTO n.º {numero}</Text>
            <View style={estilos.datas}>
              <View style={estilos.data}>
                <Text style={estilos.rotuloData}>Data</Text>
                <Text style={estilos.valorData}>{formatarData(orcamento.data)}</Text>
              </View>
              <View style={estilos.data}>
                <Text style={estilos.rotuloData}>Válido até</Text>
                <Text style={estilos.valorData}>{formatarData(orcamento.validade)}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={estilos.filete} />

        {rascunho && (
          <Text style={estilos.avisoRascunho}>
            <Text style={{ fontWeight: 700 }}>RASCUNHO</Text> — documento interno: este orçamento ainda não foi
            enviado ao cliente e pode mudar.
          </Text>
        )}

        <View style={estilos.partes}>
          <View style={estilos.parte}>
            <Text style={estilos.rotulo}>CLIENTE</Text>
            <Text style={estilos.nomeParte}>{texto(cliente?.nome) || "—"}</Text>
            {cliente?.nif && <Text style={estilos.dadoParte}>NIF {cliente.nif}</Text>}
            {cliente?.morada && <Text style={estilos.dadoParte}>{texto(cliente.morada)}</Text>}
            {cliente && codigoPostalLocalidade(cliente) && (
              <Text style={estilos.dadoParte}>{codigoPostalLocalidade(cliente)}</Text>
            )}
          </View>
          <View style={estilos.parte}>
            <Text style={estilos.rotulo}>LOCAL DA OBRA</Text>
            <Text style={estilos.nomeParte}>{texto(local?.nome) || "—"}</Text>
            {local?.morada && <Text style={estilos.dadoParte}>{texto(local.morada)}</Text>}
            {local && codigoPostalLocalidade(local) && (
              <Text style={estilos.dadoParte}>{codigoPostalLocalidade(local)}</Text>
            )}
          </View>
        </View>

        <Text style={estilos.titulo}>{texto(orcamento.titulo)}</Text>
        {texto(orcamento.descricao) && <Text style={estilos.descricao}>{texto(orcamento.descricao)}</Text>}

        <View style={estilos.tabela}>
          {/* Repete-se no topo de cada página por onde a tabela passa. */}
          <View fixed style={estilos.cabecalhoTabela}>
            <Colunas celulas={["DESCRIÇÃO", "QTD.", "UN.", "PREÇO UNIT.", "IVA", "TOTAL"]} />
          </View>
          {grupos.length === 0 && <Text style={estilos.semLinhas}>Este orçamento ainda não tem linhas.</Text>}
          {grupos.map((grupo) => (
            <View key={grupo.tipo}>
              {/* O nome do grupo não fica sozinho no fim de uma página. */}
              <View style={estilos.grupo} wrap={false} minPresenceAhead={28}>
                <Text>{NOMES_TIPO_LINHA[grupo.tipo]}</Text>
                <Text>{moeda(calcularTotais(grupo.linhas).subtotal)}</Text>
              </View>
              {grupo.linhas.map((linha, i) => (
                // Cada linha fica inteira na mesma página (salvo textos enormes).
                <View key={i} style={estilos.linha} wrap={linha.descricao.length > 1200}>
                  <Colunas
                    celulas={[
                      texto(linha.descricao),
                      quantidade(linha.quantidade),
                      texto(linha.unidade),
                      moeda(linha.preco_unitario),
                      percentagem(linha.taxa_iva),
                      moeda(linha.total ?? totalLinha(linha)),
                    ]}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={estilos.resumo} wrap={false}>
          <View style={estilos.quadroIva}>
            <Text style={estilos.rotulo}>RESUMO DO IVA</Text>
            <View style={estilos.cabecalhoIva}>
              <Text style={estilos.colTaxa}>Taxa</Text>
              <Text style={estilos.colBase}>Base</Text>
              <Text style={estilos.colValorIva}>IVA</Text>
            </View>
            {totais.iva.map((iva) => (
              <View key={iva.taxa} style={estilos.linhaIva}>
                <Text style={estilos.colTaxa}>{nomeTaxaIva(iva.taxa)}</Text>
                <Text style={estilos.colBase}>{moeda(iva.base)}</Text>
                <Text style={estilos.colValorIva}>{moeda(iva.valor)}</Text>
              </View>
            ))}
            {totais.iva.length === 0 && (
              <View style={estilos.linhaIva}>
                <Text style={estilos.colTaxa}>—</Text>
              </View>
            )}
          </View>
          <View style={estilos.totais}>
            <View style={estilos.linhaTotal}>
              <Text>Subtotal (sem IVA)</Text>
              <Text>{moeda(totais.subtotal)}</Text>
            </View>
            <View style={estilos.linhaTotal}>
              <Text>IVA</Text>
              <Text>{moeda(totais.totalIva)}</Text>
            </View>
            <View style={estilos.total}>
              <Text>TOTAL</Text>
              <Text>{moeda(totais.total)}</Text>
            </View>
          </View>
        </View>

        {(condicoes || iban) && (
          <View style={estilos.secao}>
            <Text style={estilos.tituloSecao} minPresenceAhead={30}>
              Condições
            </Text>
            {condicoes && <Text style={estilos.textoSecao}>{condicoes}</Text>}
            {iban && (
              <Text style={estilos.iban}>
                Pagamento por transferência bancária para o IBAN <Text style={{ fontWeight: 600 }}>{iban}</Text>.
              </Text>
            )}
          </View>
        )}

        <View fixed style={estilos.rodape}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.avisoFatura}>Este documento não é uma fatura.</Text>
            <Text>
              {[nomeEmpresa, empresa?.nif && `NIF ${empresa.nif}`, `Orçamento n.º ${numero}`].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
          {/* Largura fixa: o texto só é conhecido depois da paginação. */}
          <Text
            style={estilos.paginacao}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>

        {/* Por cima de tudo, em todas as páginas, para não ser enviado por engano. */}
        {rascunho && (
          <Text fixed style={estilos.marcaAgua}>
            RASCUNHO
          </Text>
        )}
      </Page>
    </Document>
  )
}

/** Gera o PDF do orçamento (A4) e devolve-o num Buffer. */
export async function gerarPdfOrcamento(dados: DadosPdfOrcamento): Promise<Buffer> {
  const { familia, temCarater } = await registarFontes()
  // Os textos escritos pelas pessoas ficam só com carateres que a fonte desenha.
  const limpar = (valor: string) => soCarateresDaFonte(texto(valor), temCarater)
  const limpos: DadosPdfOrcamento = {
    orcamento: limparRegisto(dados.orcamento, limpar),
    linhas: dados.linhas.map((linha) => limparRegisto(linha, limpar)),
    cliente: dados.cliente && limparRegisto(dados.cliente, limpar),
    local: dados.local && limparRegisto(dados.local, limpar),
    empresa: dados.empresa && limparRegisto(dados.empresa, limpar),
  }
  return renderToBuffer(<DocumentoOrcamento dados={limpos} fonte={familia} />)
}

/** "Orcamento-2026-0002.pdf" (sem acentos nem barras, para qualquer telemóvel). */
export function nomeFicheiroPdf(orcamento: { ano: number; numero: number }): string {
  return `Orcamento-${formatarNumeroOrcamento(orcamento.ano, orcamento.numero).replace("/", "-")}.pdf`
}
