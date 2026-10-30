// Registo de auditoria (secção 7): calcula só os campos que
// realmente mudaram entre o antes/depois gravado pelo trigger
// (migração 0032) — mostrar a linha inteira sempre seria ruído.
export type DiferencaAuditoria = { campo: string; de: unknown; para: unknown }

const CAMPOS_IGNORADOS = new Set(['criado_em', 'atualizado_em'])

export function diferencasAuditoria(
  antigos: Record<string, unknown> | null,
  novos: Record<string, unknown> | null
): DiferencaAuditoria[] {
  if (!antigos || !novos) return []
  const campos = new Set([...Object.keys(antigos), ...Object.keys(novos)])
  const diferencas: DiferencaAuditoria[] = []
  for (const campo of campos) {
    if (CAMPOS_IGNORADOS.has(campo)) continue
    const de = antigos[campo]
    const para = novos[campo]
    if (JSON.stringify(de) !== JSON.stringify(para)) {
      diferencas.push({ campo, de, para })
    }
  }
  return diferencas
}
