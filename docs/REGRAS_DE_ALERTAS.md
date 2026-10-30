# Motor de alertas: regras e como alterar os limites

O motor avalia estas regras uma vez por hora
(`.github/workflows/alertas.yml` → `app/api/cron/alertas`), compara
com o que já está na tabela `alerts`, cria o que é novo, resolve
automaticamente o que deixou de se verificar e nunca duplica um
alerta já em aberto. A lógica de cada regra e da reconciliação está
em `lib/data/alertas.ts` (testada em `alertas.test.ts`).

## Como alterar um limite

Os limites usados pelo cron vivem em `LIMITES_OMISSAO`
(`lib/data/alertas.ts`). A tabela `alert_rules.limites` guarda os
mesmos valores para leitura humana e para uma futura UI de
definições, mas **ainda não é lida pelo cron** — alterar um número lá
não muda nada até essa ligação ser feita. Para já, mudar um limite é
editar `LIMITES_OMISSAO` no código.

Para desligar uma regra sem tocar no código: `alert_rules.ativo =
false` para essa `chave` — o cron já respeita essa flag.

## Regras implementadas

| Chave | Área | Severidade | Condição |
|---|---|---|---|
| `lead_sem_contacto` | Leads | Atenção → Crítico | lead "Nova" sem transição há mais de 2h (Atenção) / 24h (Crítico) |
| `lead_sem_seguimento` | Leads | Crítico | próxima ação vencida, ou sem atividade há mais de 3 dias |
| `experimental_amanha` | Leads | Atenção | "Experimental agendada" com visita marcada para amanhã |
| `experimental_falhada_sem_reagendar` | Leads | Crítico | "Falhou a experimental" há mais de 48h sem nova marcação |
| `experimental_sem_decisao` | Leads | Atenção | "Experimental realizada" há mais de 5 dias sem decisão |
| `cliente_sem_treino_agendado` | Clientes | Crítico | cliente ativo sem nenhum evento de treino futuro na Agenda |
| `cliente_limite_desmarcacoes` | Clientes | Atenção | 2+ desmarcações consecutivas ou 5+ nos últimos 60 dias |
| `fim_experiencia_proximo` | Clientes | Atenção | fim da experiência a 7 dias ou menos |
| `reavaliacao_atrasada` | Clientes | Atenção | `proxima_reavaliacao` já passou |
| `reavaliacao_proxima` | Clientes | Info | `proxima_reavaliacao` a 14 dias ou menos |
| `aniversario_hoje` | Clientes | Info | `nascimento` faz anos hoje (só mês/dia, ignora o ano) |
| `mensalidade_em_atraso` | Pagamentos | Crítico | não "em dia" e já passou o dia 8 do mês — nunca mostra o valor |
| `plano_a_expirar` | Pagamentos | Atenção | `valido_ate` a 7 dias ou menos |

Visibilidade: quem gere o estúdio (admin/studio_manager) vê todos.
Quem não gere só vê os alertas cujo `papel_destinatario` bate com o
seu papel — `comercial` para as 5 regras de Leads, `pt` para
`mensalidade_em_atraso` (nunca com o valor), as restantes ficam
`null` (só gestão).

## Fora desta fase (precisam de conceitos que a app ainda não modela)

- Queda de assiduidade de 30% face à média das 4 semanas anteriores.
- Score de risco de saída acima de 70 (o score existe no painel de
  retenção, `lib/data/retencao.ts` → `scoreRisco`, mas ainda não
  alimenta um alerta).
- Ocupação do "Bloco Exclusivo", escalas sem PT, horas acima do
  limite, abertura/fecho em falta, manutenção de máquinas.
- Meta mensal em risco, churn acima da média, conversão de origem a
  cair — dependem dos Objetivos (Fase 6, já implementado) e de mais
  alguns meses de histórico para a comparação fazer sentido.
