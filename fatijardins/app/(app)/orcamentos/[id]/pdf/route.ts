import type { NextRequest } from "next/server"
import { notFound } from "next/navigation"

import { exigirPerfil } from "@/lib/auth"
import { calcularTotais } from "@/lib/orcamentos"
import { gerarPdfOrcamento, nomeFicheiroPdf } from "@/lib/pdf/orcamento"
import { createClient } from "@/lib/supabase/server"
import { idObrigatorio } from "@/lib/validacao/comum"

/**
 * PDF do orçamento (A4), aberto no browser: GET /orcamentos/<id>/pdf.
 * Corre no Node.js (o runtime por omissão; com cacheComponents não se pode
 * declarar), de que o @react-pdf/renderer e as fontes lidas do disco precisam.
 * Sem sessão vai para o login (proxy.ts); o colaborador vai para "sem
 * permissão". Os dados são lidos com a sessão do utilizador, por isso a
 * RLS decide o que se vê (gerente e chefes de equipa).
 */
export async function GET(_pedido: NextRequest, { params }: RouteContext<"/orcamentos/[id]/pdf">) {
  await exigirPerfil("gerente", "chefe_equipa")
  const { id } = await params
  if (!idObrigatorio.safeParse(id).success) notFound()

  const supabase = await createClient()
  const [orcamentoR, linhasR, empresaR] = await Promise.all([
    supabase
      .from("orcamentos")
      .select(
        `ano, numero, titulo, descricao, data, validade, estado, condicoes, subtotal, total_iva, total,
         cliente:clientes (nome, nif, morada, codigo_postal, localidade),
         local:locais (nome, morada, codigo_postal, localidade)`
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orcamento_linhas")
      .select("tipo, descricao, quantidade, unidade, preco_unitario, taxa_iva, total")
      .eq("orcamento_id", id)
      .order("ordem")
      .order("created_at"),
    supabase
      .from("empresa")
      .select("nome, nif, morada, codigo_postal, localidade, telefone, email, website, iban")
      .maybeSingle(),
  ])
  if (orcamentoR.error) throw new Error(`Erro ao ler o orçamento: ${orcamentoR.error.message}`)
  if (linhasR.error) throw new Error(`Erro ao ler as linhas do orçamento: ${linhasR.error.message}`)
  if (empresaR.error) throw new Error(`Erro ao ler os dados da empresa: ${empresaR.error.message}`)

  const { cliente, local, ...orcamento } = orcamentoR.data ?? notFound()

  // As contas do PDF (lib/orcamentos) são as mesmas da BD; avisa se alguma vez divergirem.
  const totais = calcularTotais(linhasR.data)
  if (totais.subtotal !== orcamento.subtotal || totais.total !== orcamento.total) {
    console.error(
      `PDF do orçamento ${id}: totais diferentes dos da BD (${totais.subtotal}/${totais.total} ≠ ${orcamento.subtotal}/${orcamento.total}).`
    )
  }

  const pdf = await gerarPdfOrcamento({ orcamento, linhas: linhasR.data, cliente, local, empresa: empresaR.data })

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: abre no visualizador do browser (no telemóvel dá para partilhar ou descarregar).
      "Content-Disposition": `inline; filename="${nomeFicheiroPdf(orcamento)}"`,
      // Dados de clientes e valores: nunca em caches partilhadas.
      "Cache-Control": "private, no-store",
    },
  })
}
