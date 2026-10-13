import Link from "next/link"
import { ShieldAlertIcon } from "lucide-react"

import { EstadoVazio } from "@/components/estado-vazio"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Sem permissão" }

export default function SemPermissao() {
  return (
    <EstadoVazio
      paginaInteira
      icone={ShieldAlertIcon}
      titulo="Não tem permissão para ver esta página"
      descricao="Se precisa de acesso, fale com o gerente."
      acao={
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      }
    />
  )
}
