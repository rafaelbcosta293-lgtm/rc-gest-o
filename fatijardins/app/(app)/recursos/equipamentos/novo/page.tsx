import { Suspense } from "react"

import { CabecalhoPagina } from "@/components/cabecalho-pagina"
import { exigirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { CamposEquipamento } from "@/lib/validacao/equipamentos"
import { carregarOpcoesEquipamento } from "../../_equipamentos/dados"
import { EsqueletoFormularioEquipamento } from "../../_equipamentos/esqueletos"
import { FormularioEquipamento } from "../../_equipamentos/formulario-equipamento"

export const metadata = { title: "Novo equipamento" }

const VAZIO: CamposEquipamento = {
  nome: "",
  tipo: "maquina",
  marca: "",
  modelo: "",
  numero_serie: "",
  matricula: "",
  estado: "operacional",
  equipa_id: "",
  colaborador_id: "",
  data_aquisicao: "",
  proxima_revisao: "",
  seguro_ate: "",
  ipo_ate: "",
  notas: "",
}

export default function PaginaNovoEquipamento() {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Novo equipamento" voltar={{ href: "/recursos", texto: "Equipamentos" }} />
      <Suspense fallback={<EsqueletoFormularioEquipamento />}>
        <NovoEquipamento />
      </Suspense>
    </div>
  )
}

async function NovoEquipamento() {
  await exigirPerfil("gerente")
  const supabase = await createClient()
  const opcoes = await carregarOpcoesEquipamento(supabase)

  return (
    <FormularioEquipamento
      valoresIniciais={VAZIO}
      equipas={opcoes.equipas}
      colaboradores={opcoes.colaboradores}
      cancelarHref="/recursos"
    />
  )
}
