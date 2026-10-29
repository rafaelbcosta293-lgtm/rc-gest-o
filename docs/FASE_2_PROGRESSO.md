# Fase 2 — Base de dados e timeline (progresso)

> Build e testes correram sem erros depois de cada alteração. Nada
> aqui apaga dados reais — tudo aditivo (novas tabelas/colunas/valores
> de enum, nunca `drop`).

## O que já está feito

### Esquema (aplicado diretamente ao projeto Supabase, migração a migração)
- `papel_utilizador` ganhou o valor `comercial`.
- `estado_lead` (etapas do funil de leads) renomeado e alargado para as
  8 etapas da especificação: Nova, Contactada, Qualificada, Experimental
  agendada, Experimental realizada, Falhou a experimental, Proposta / Em
  decisão, Ganha, Perdida. Confirmado: as mudanças de nome propagam-se
  sozinhas a tudo o que já usava os nomes antigos (vistas incluídas —
  `v_leads_paradas` passou a filtrar por 'Ganha'/'Perdida' sem eu ter de
  a reescrever).
- `leads` ganhou `campanha`, `modalidade_interesse`, `temperatura`
  (Fria/Morna/Quente, por omissão Morna) — todos opcionais, não quebram
  leads já existentes.
- **`lead_stage_history`**: uma linha por mudança de etapa, escrita
  sozinha por um trigger em `leads` (nunca diretamente pela app).
- **`activities`**: a timeline unificada. Triggers em `pagamentos`,
  `presencas`, `avaliacoes`, `envios_aniversario`, `clientes` (mudança
  de estado) e `leads` (as transições "visíveis": agendar/realizar/
  falhar experimental, ganhar) escrevem lá sozinhos. **Nunca grava
  valores em €** — um evento de Pagamento só guarda o método e o id do
  pagamento, nunca o valor (quem precisa do valor já tem acesso direto
  a `pagamentos`, que continua admin-only).
- **`goals`**, **`marketing_costs`** (este último admin-only, por ser
  a base do CAC), **`alert_rules`** + **`alerts`**,
  **`kpi_snapshots_daily`** (leitura restrita a quem gere o estúdio,
  por poder vir a incluir valores financeiros).
- **`settings`**: decidi alargar a tabela `config` já existente em vez
  de criar uma nova (ver decisão 3 em `FASE_1_AUDITORIA_E_PLANO.md`).
  Os valores que já lá estavam (`seguro_anual`, `taxa_inscricao`,
  `validade_sessoes_dias`, `dia_limite_mensalidade`,
  `horas_desmarcacao`) já batiam certo com a especificação — não mexi
  neles. Acrescentei os que faltavam: `custo_hora_pt`,
  `max_clientes_bloco_exclusivo`, limites de desmarcações, contrato
  mínimo, preços por modalidade/frequência, horário do estúdio.

### Verificação da "regra de ouro" (feita a sério, não só lida no código)
Simulei um pedido como se fosse mesmo uma conta PT (Carolina Ribeiro,
`papel = 'pt'`) contra a base de dados em produção:

| Tabela/vista | Linhas visíveis a um PT |
|---|---|
| `pagamentos` | **0** |
| `planos` | **0** |
| `v_estado_pagamento` (em_dia/valido_ate, sem valor) | 203 |
| `clientes` | 378 |
| `leads` | 5 |

Confirma que um PT não consegue ver nenhum valor em €, nem pela API —
não é só a interface a esconder, a base de dados recusa mesmo.

### TypeScript
- `lib/supabase/database.types.ts`: tipos novos para tudo o que ficou
  na base de dados (`LeadStageHistory`, `Activity`/`TipoAtividade`,
  `Goal`, `MarketingCost`, `AlertRule`/`AlertaRegistado`,
  `KpiSnapshotDiario`), `Papel` com `comercial`, `EstadoLead` com os
  nomes novos, `Lead` com os campos novos.
- Todos os sítios que comparavam com os nomes antigos das etapas
  (`'Convertido'`, `'Perdido'`) foram atualizados para os novos
  (`'Ganha'`, `'Perdida'`): `app/painel/admin/page.tsx`,
  `app/painel/[estudio]/leads/{actions.ts,page.tsx,LeadForm.tsx}`,
  `lib/data/marketing.ts`, `lib/data/constantes.ts` (`ESTADOS_LEAD`,
  com cores para as 3 etapas novas). `Equipa` já deixa escolher o
  papel "comercial".

### Testes (novo: `npm run test`, Vitest instalado)
43 testes, todos a passar, às fórmulas mais complexas e mais usadas:
- `lib/data/clientes.test.ts` — a lógica de renovação de seguro
  (a mais intrincada da app: âncora, reativações dentro/fora do ciclo,
  ano de inscrição).
- `lib/data/marketing.test.ts` — o funil de marketing
  (leads/agendamentos/visitas/fechos/walk-ins).
- `lib/data/presencas.test.ts` — treinos previstos, formatação de
  datas, dias do mês.
- `lib/data/agenda.test.ts` — expansão de eventos repetidos.

Corre com `npm run test`.

## Por fazer antes de fechar a Fase 2

- **Dados de demonstração** — fica por fazer. Criar a branch de
  desenvolvimento do Supabase (decisão 5) tem custo (computação por
  hora), e a própria ferramenta exige confirmação explícita do custo
  antes de a criar — não avanço com isso sem teres mesmo visto o valor.
  Confirma-me que queres mesmo a branch (e eu mostro o custo que a
  Supabase pedir) e sigo com os dados de demonstração.
- Ligar `quadro_do_dia`, `resumo_mensal_pt`, `resumo_presencas` (já
  existem na base de dados, nunca foram chamados) fica para a Fase 5,
  quando construir os painéis que os vão mesmo usar — não faz sentido
  ligá-los sem nenhuma interface a mostrá-los ainda.

A seguir: Fase 3 (Kanban, ficha da lead com timeline, importação de
leads, métricas do funil) — não depende dos dados de demonstração para
arrancar (dá para testar com os dados reais, que já têm 5 leads).
