import { Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { convidarParaApp, desativarAcessoApp } from './appClienteActions'
import CopiarTexto from '@/components/CopiarTexto'

const dataHora = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : null

// Acesso do cliente à app do cliente (convite por SMS com o link de
// ativação; o cliente escolhe a password e entra com o nº de cliente).
export default async function CartaoAppCliente({
  slug,
  clienteId,
  podeGerir,
  aviso,
}: {
  slug: string
  clienteId: string
  podeGerir: boolean
  aviso: { app?: string; link?: string; motivo?: string }
}) {
  const supabase = await createClient()
  const { data: conta } = await supabase
    .from('app_clientes_contas')
    .select('ativa, convidado_em, ativada_em, ultimo_acesso, desativada_em')
    .eq('cliente_id', clienteId)
    .maybeSingle()

  const estado = !conta
    ? 'Sem acesso'
    : !conta.ativa
      ? `Acesso desativado${conta.desativada_em ? ` em ${dataHora(conta.desativada_em)}` : ''}`
      : conta.ativada_em
        ? `Conta ativa desde ${dataHora(conta.ativada_em)}${conta.ultimo_acesso ? ` · último acesso ${dataHora(conta.ultimo_acesso)}` : ''}`
        : `Convite enviado a ${dataHora(conta.convidado_em)} — ainda por ativar`

  return (
    <section id="app-cliente" className="mt-4 rounded-xl border border-border-subtle p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">App do cliente</h2>
      </div>
      <p className="mt-2 text-sm text-foreground">{estado}</p>

      {aviso.app === 'convidado' && <p className="mt-2 text-sm text-teal-700 dark:text-teal-400">Convite enviado por SMS.</p>}
      {aviso.app === 'desativado' && <p className="mt-2 text-sm text-teal-700 dark:text-teal-400">Acesso desativado.</p>}
      {aviso.app === 'sms-falhou' && aviso.link && (
        <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          A conta ficou criada, mas o SMS não saiu{aviso.motivo ? ` (${aviso.motivo})` : ''}. Pode enviar este link ao cliente:
          <div className="mt-1">
            <CopiarTexto texto={aviso.link} rotulo="Copiar link" />
          </div>
        </div>
      )}

      {podeGerir && (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={convidarParaApp}>
            <input type="hidden" name="estudio_slug" value={slug} />
            <input type="hidden" name="cliente_id" value={clienteId} />
            <button className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background hover:opacity-90">
              {!conta || !conta.ativa ? 'Enviar convite por SMS' : conta.ativada_em ? 'Enviar nova password por SMS' : 'Reenviar convite'}
            </button>
          </form>
          {conta?.ativa && (
            <form action={desativarAcessoApp}>
              <input type="hidden" name="estudio_slug" value={slug} />
              <input type="hidden" name="cliente_id" value={clienteId} />
              <button className="rounded-full border border-border-strong px-4 py-2 text-sm font-bold hover:bg-foreground/[.08]">
                Tirar acesso
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
