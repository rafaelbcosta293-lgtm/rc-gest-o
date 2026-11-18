import Link from '@/components/LinkRapido'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { areaBloqueada } from '@/lib/data/gate'
import { getEstudios } from '@/lib/data/estudios'
import { desbloquearAdmin } from '../../actions'
import PortaSenha from '@/components/PortaSenha'
import ConfirmarAcao from '@/components/ConfirmarAcao'
import { carregarDestinatariosNumero, mensagemNumeroCliente, podeReceber } from '@/lib/data/smsNumeroCliente'
import { enviarNumeroClienteEstudio } from './actions'

// O envio de ~80 SMS pode demorar mais do que o limite normal.
export const maxDuration = 300

export default async function NumeroClienteSmsPage({
  searchParams,
}: {
  searchParams: Promise<{ erroSenha?: string; error?: string; estudio?: string; enviados?: string; falhas?: string; porEnviar?: string; offline?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  if (await areaBloqueada(supabase, 'admin')) {
    return (
      <PortaSenha
        titulo="Administração — SMS nº de cliente"
        destino="/painel/admin/lembretes-sms/numero-cliente"
        action={desbloquearAdmin}
        erro={sp.erroSenha}
      />
    )
  }
  const estudios = await getEstudios(supabase)
  const porEstudio = await Promise.all(estudios.map(async (e) => ({ estudio: e, lista: await carregarDestinatariosNumero(supabase, e.id) })))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/painel/admin/lembretes-sms" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Lembretes SMS
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">SMS com o nº de cliente</h1>
      <p className="mt-1 text-sm text-muted">
        Mensagem única, para o check-in no tablet. Vai para os clientes <strong>ativos</strong> e para quem tem <strong>treinos ou aulas marcados</strong>{' '}
        daqui para a frente. Cada cliente só a recebe uma vez — se o envio parar a meio, voltar a carregar envia só aos que faltam.
      </p>

      {sp.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.error}</p>}
      {sp.estudio && (
        <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${sp.offline ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
          {estudios.find((e) => e.slug === sp.estudio)?.nome}: {sp.enviados} enviado(s).
          {sp.falhas ? ` Números recusados: ${sp.falhas}.` : ''}
          {sp.offline ? ` O telemóvel-gateway não respondeu (${sp.offline}) — ficaram ${sp.porEnviar} por enviar; tente de novo daqui a pouco.` : ''}
        </div>
      )}

      {porEstudio.map(({ estudio, lista }) => {
        const pendentes = lista.filter((d) => !d.enviado && podeReceber(d))
        const enviados = lista.filter((d) => d.enviado)
        const semContacto = lista.filter((d) => !podeReceber(d))
        const exemplo = pendentes[0] ?? lista[0]
        return (
          <section key={estudio.id} className="mt-8 rounded-xl border border-border-subtle bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">{estudio.nome}</h2>
              <p className="text-sm text-muted">
                {lista.length} destinatários · <strong className="text-foreground">{pendentes.length} por enviar</strong> · {enviados.length} já enviados
                {semContacto.length ? ` · ${semContacto.length} sem telemóvel/nº válido` : ''}
              </p>
            </div>
            {exemplo?.numero_socio && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Exemplo ({exemplo.nome})</p>
                <p className="mt-1 whitespace-pre-line rounded-lg bg-background p-3 text-sm text-foreground">
                  {mensagemNumeroCliente(exemplo.nome, exemplo.nome_preferido, exemplo.numero_socio)}
                </p>
              </div>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-brand">Ver a lista ({lista.length})</summary>
              <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
                {lista.map((d) => (
                  <li key={d.id}>
                    {d.enviado ? '✓ ' : ''}
                    {d.nome} · {d.numero_socio ?? 'sem nº'} · {d.estado}
                    {!podeReceber(d) ? ' · sem telemóvel válido' : ''}
                  </li>
                ))}
              </ul>
            </details>
            {pendentes.length > 0 && (
              <ConfirmarAcao
                action={enviarNumeroClienteEstudio}
                confirmacao={`Enviar agora ${pendentes.length} SMS aos clientes de ${estudio.nome}? Não dá para desfazer.`}
                className="mt-4"
              >
                <input type="hidden" name="estudio_slug" value={estudio.slug} />
                <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                  Enviar {pendentes.length} SMS ({estudio.nome})
                </button>
              </ConfirmarAcao>
            )}
          </section>
        )
      })}
    </div>
  )
}
