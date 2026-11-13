'use client'

import { useState } from 'react'
import { ESTADOS_LEAD, ORIGENS_LEAD, OBJETIVOS_LEAD } from '@/lib/data/constantes'
import type { Lead, Perfil, TemperaturaLead } from '@/lib/supabase/database.types'
import SubmitButton from '@/components/SubmitButton'
import { useAvisoSairSemGuardar } from '@/hooks/useAvisoSairSemGuardar'

const inputCls =
  'rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/30'
const labelCls = 'text-xs font-semibold text-muted'

const ESTADOS_EDITAVEIS = Object.keys(ESTADOS_LEAD).filter((k) => k !== 'Ganha')
const TEMPERATURAS: TemperaturaLead[] = ['Fria', 'Morna', 'Quente']
const ORIGENS_CONHECIDAS: readonly string[] = ORIGENS_LEAD
const OBJETIVOS_CONHECIDOS: readonly string[] = OBJETIVOS_LEAD

export default function LeadForm({
  estudioSlug,
  estudioId,
  pts,
  lead,
  action,
  error,
  outrosEstudios = [],
}: {
  estudioSlug: string
  estudioId: number
  pts: Pick<Perfil, 'id' | 'nome'>[]
  lead?: Lead
  action: (formData: FormData) => void
  error?: string
  // Só faz sentido ao editar (nunca ao criar) — permite enviar esta
  // lead para outro estúdio no mesmo "Guardar", sem precisar de uma
  // ação à parte (ex.: contacto que chegou a Fátima mas é para Leiria).
  outrosEstudios?: { slug: string; nome: string }[]
}) {
  const { marcarSujo } = useAvisoSairSemGuardar()
  const [moverPara, setMoverPara] = useState('')

  // Origem conhecida fica logo escolhida; uma guardada à mão (ou vinda
  // de antes desta lista existir) cai em "Outra", com o texto original
  // preservado no campo ao lado — nunca se perde o que já lá estava.
  const origemConhecida = !!lead?.origem && ORIGENS_CONHECIDAS.includes(lead.origem)
  const [origem, setOrigem] = useState(lead?.origem ? (origemConhecida ? lead.origem : 'Outra') : '')
  const [origemOutra, setOrigemOutra] = useState(lead?.origem && !origemConhecida ? lead.origem : '')

  // Mesma lógica da origem — um objetivo conhecido fica logo escolhido;
  // texto livre (de antes desta lista existir) cai em "Outro", com o
  // texto original preservado no campo ao lado.
  const objetivoConhecido = !!lead?.objetivo && OBJETIVOS_CONHECIDOS.includes(lead.objetivo)
  const [objetivo, setObjetivo] = useState(lead?.objetivo ? (objetivoConhecido ? lead.objetivo : 'Outro') : '')
  const [objetivoOutro, setObjetivoOutro] = useState(lead?.objetivo && !objetivoConhecido ? lead.objetivo : '')

  return (
    <form action={action} onChange={marcarSujo} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="estudio_slug" value={estudioSlug} />
      <input type="hidden" name="estudio_id" value={estudioId} />
      <input type="hidden" name="mover_para_estudio_slug" value={moverPara} />
      {lead && <input type="hidden" name="id" value={lead.id} />}
      {lead && (
        <input
          type="hidden"
          name="visita_marcada_em_atual"
          value={lead.visita_marcada_em ?? ''}
        />
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className={labelCls}>
            Nome
          </label>
          <input id="nome" name="nome" required defaultValue={lead?.nome} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefone" className={labelCls}>
            Telefone
          </label>
          <input
            id="telefone"
            name="telefone"
            defaultValue={lead?.telefone ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={lead?.email ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="origem" className={labelCls}>
            Origem
          </label>
          <select
            id="origem"
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            {ORIGENS_LEAD.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {origem === 'Outra' && (
            <input
              value={origemOutra}
              onChange={(e) => setOrigemOutra(e.target.value)}
              placeholder="Qual?"
              className={`${inputCls} mt-1`}
            />
          )}
          <input type="hidden" name="origem" value={origem === 'Outra' ? origemOutra : origem} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="campanha" className={labelCls}>
            Campanha
          </label>
          <input
            id="campanha"
            name="campanha"
            defaultValue={lead?.campanha ?? ''}
            placeholder="ex.: Promo verão 2026"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="modalidade_interesse" className={labelCls}>
            Modalidade de interesse
          </label>
          <select
            id="modalidade_interesse"
            name="modalidade_interesse"
            defaultValue={lead?.modalidade_interesse ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="Treino Personalizado">Treino Personalizado</option>
            <option value="Treino Acompanhado">Treino Acompanhado</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Temperatura</span>
          <div className="flex gap-1.5">
            {TEMPERATURAS.map((t) => (
              <label
                key={t}
                className="flex-1 cursor-pointer rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-center text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:font-medium"
              >
                <input
                  type="radio"
                  name="temperatura"
                  value={t}
                  defaultChecked={(lead?.temperatura ?? 'Morna') === t}
                  className="sr-only"
                />
                {t}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-end gap-1.5 pb-1.5">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="walk_in" defaultChecked={lead?.walk_in ?? false} />
            Walk-in (apareceu sem marcação)
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="objetivo" className={labelCls}>
            Objetivo
          </label>
          <select
            id="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            {OBJETIVOS_LEAD.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {objetivo === 'Outro' && (
            <input
              value={objetivoOutro}
              onChange={(e) => setObjetivoOutro(e.target.value)}
              placeholder="Qual?"
              className={`${inputCls} mt-1`}
            />
          )}
          <input type="hidden" name="objetivo" value={objetivo === 'Outro' ? objetivoOutro : objetivo} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="interesse" className={labelCls}>
            Interesse
          </label>
          <input
            id="interesse"
            name="interesse"
            defaultValue={lead?.interesse ?? ''}
            placeholder="ex.: PT individual, aulas de grupo"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="disponibilidade" className={labelCls}>
            Disponibilidade
          </label>
          <input
            id="disponibilidade"
            name="disponibilidade"
            defaultValue={lead?.disponibilidade ?? ''}
            placeholder="ex.: fins de tarde"
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="responsavel_id" className={labelCls}>
            Responsável
          </label>
          <select
            id="responsavel_id"
            name="responsavel_id"
            defaultValue={lead?.responsavel_id ?? ''}
            className={inputCls}
          >
            <option value="">—</option>
            {pts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="proximo_contacto" className={labelCls}>
            Próximo contacto
          </label>
          <input
            id="proximo_contacto"
            name="proximo_contacto"
            type="date"
            defaultValue={lead?.proximo_contacto ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="proximo_contacto_hora" className={labelCls}>
            Hora pedida pela lead
          </label>
          <input
            id="proximo_contacto_hora"
            name="proximo_contacto_hora"
            type="time"
            defaultValue={lead?.proximo_contacto_hora ?? ''}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="valor_potencial" className={labelCls}>
            Valor potencial (€)
          </label>
          <input
            id="valor_potencial"
            name="valor_potencial"
            type="number"
            step="any"
            defaultValue={lead?.valor_potencial ?? ''}
            className={inputCls}
          />
        </div>

        {lead && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="estado" className={labelCls}>
                Estado
              </label>
              <select
                id="estado"
                name="estado"
                defaultValue={lead.estado}
                className={inputCls}
              >
                {ESTADOS_EDITAVEIS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
                {lead.estado === 'Ganha' && <option value="Ganha">Ganha</option>}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="visita_data" className={labelCls}>
                Data da visita
              </label>
              <input
                id="visita_data"
                name="visita_data"
                type="date"
                defaultValue={lead.visita_data ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="visita_hora" className={labelCls}>
                Hora da visita
              </label>
              <input
                id="visita_hora"
                name="visita_hora"
                type="time"
                defaultValue={lead.visita_hora ?? ''}
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="motivo_perda" className={labelCls}>
                Motivo da perda
              </label>
              <input
                id="motivo_perda"
                name="motivo_perda"
                defaultValue={lead.motivo_perda ?? ''}
                placeholder="só é guardado se o estado for &quot;Perdida&quot;"
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nota" className={labelCls}>
          Notas
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={2}
          defaultValue={lead?.nota ?? ''}
          className={inputCls}
        />
      </div>

      {lead && outrosEstudios.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface p-3">
          <span className={labelCls}>Enviar para outro estúdio</span>
          {outrosEstudios.length === 1 ? (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={moverPara === outrosEstudios[0].slug}
                onChange={(e) => setMoverPara(e.target.checked ? outrosEstudios[0].slug : '')}
              />
              Enviar esta lead para {outrosEstudios[0].nome}
            </label>
          ) : (
            <select
              value={moverPara}
              onChange={(e) => setMoverPara(e.target.value)}
              className={`${inputCls} w-fit`}
            >
              <option value="">— não mover —</option>
              {outrosEstudios.map((e) => (
                <option key={e.slug} value={e.slug}>
                  Enviar para {e.nome}
                </option>
              ))}
            </select>
          )}
          {moverPara && (
            <p className="text-xs text-muted">
              Ao guardar, esta lead passa para o estúdio escolhido — mantém o estado e o
              histórico, só muda de onde é vista.
            </p>
          )}
        </div>
      )}

      <SubmitButton
        pendingText="A guardar…"
        className="mt-2 self-start rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black shadow-pop hover:bg-brand-strong hover:shadow-card-hover"
      >
        {lead ? 'Guardar alterações' : 'Criar lead'}
      </SubmitButton>
    </form>
  )
}
