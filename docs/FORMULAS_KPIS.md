# Fórmulas dos KPIs

Cada fórmula vive numa função pura testada em `lib/data/`, nunca
duplicada na página que a mostra — isto é a referência de onde
encontrar e como alterar cada uma. "Pura" quer dizer: recebe os dados
já carregados e um valor de "hoje", sem tocar na base de dados, por
isso é testável com `npm run test` sem precisar de Supabase.

| KPI | Fórmula | Onde |
|---|---|---|
| Taxa de conversão do funil | leads que alcançaram "Ganha" ÷ total de leads no período | `lib/data/funil.ts` → `calcularMetricasFunil` |
| Comparecimento à experimental (show rate) | "Experimental realizada" ÷ (agendadas + falhadas + realizadas) | `lib/data/funil.ts` → `calcularMetricasFunil` |
| Velocidade até ao 1º contacto | horas entre a criação da lead e a 1ª transição a partir de "Nova" | `lib/data/funil.ts` → `calcularMetricasFunil` |
| Leads por origem / conversão por origem | agrupa por `origem`, ganhas ÷ total dessa origem | `lib/data/comercial.ts` → `porOrigem` |
| Ranking de comerciais | contactos, agendamentos, show rate, fechos por `responsavel_id` | `lib/data/comercial.ts` → `rankingComerciais` |
| Churn mensal | cancelados no mês ÷ (ativos agora + cancelados no mês) — **aproximação**: sem snapshot diário de "ativos no início do mês", usa-se este proxy | `lib/data/retencao.ts` → `churnMensal` |
| Cancelamento no fim da experiência | clientes cuja saída caiu a ±7 dias do fim da experiência ÷ clientes com experiência já terminada | `lib/data/retencao.ts` → `cancelamentoFimExperiencia` |
| Tempo médio de vida | média, em meses, de `saiu_em − inicio_contrato`, só de quem já saiu | `lib/data/retencao.ts` → `tempoMedioDeVidaMeses` |
| Coortes de retenção | agrupa por mês de `inicio_contrato`; para cada mês M desde a entrada, % que continua ativa (`saiu_em` nulo ou ≥ essa marca) | `lib/data/retencao.ts` → `matrizCoorte` |
| Score de risco de saída (0–100) | soma pesada de: quebra de assiduidade (até 35), desmarcações recentes (até 20), sem treino agendado (+20), pagamento em atraso (+15), reavaliação vencida (+5), fim de experiência a ≤7 dias (+5) — **pesos são uma primeira calibração, não vêm da especificação** | `lib/data/retencao.ts` → `scoreRisco` |
| Ocupação de PT | horas realizadas (`registos_pt`) ÷ horas de escala × 0,5h por slot | `lib/data/operacional.ts` → `ocupacaoPorPt` |
| Retenção/assiduidade por PT | % de clientes ativos do PT; assiduidade = realizados ÷ `treinosPrevistos()` | `lib/data/operacional.ts` → `retencaoEAssiduidadePorPt` |
| MRR | soma do pagamento mais recente de cada cliente ainda dentro da validade (em dia) — **"reconhecido"**, não decompõe novo/expansão/contração/churn/reativação (falta histórico de mudanças de plano) | `lib/data/financeiro.ts` → `mrrAtual` |
| ARPU | MRR ÷ clientes ativos | `lib/data/financeiro.ts` → `arpu` |
| Receita cobrada por mês | soma de `pagamentos.valor` por mês de `data_pagamento` — **dinheiro recebido, não MRR reconhecido por calendário de subscrição** | `lib/data/financeiro.ts` → `receitaPorMes` |
| Antiguidade da dívida | clientes não "em dia", agrupados por dias em atraso em 4 faixas (1–8/9–30/31–60/+60) | `lib/data/financeiro.ts` → `agingDivida` |
| Margem por hora de PT | receita do mês ÷ horas realizadas, menos `custo_hora_pt` (tabela `config`) | `lib/data/financeiro.ts` → `margemPorHora` |
| Progresso de uma meta (fluxo: leads/vendas) | projeção = (realizado até hoje ÷ dia do mês) × dias do mês; ritmo necessário = (meta − realizado) ÷ dias restantes | `lib/data/objetivos.ts` → `progressoFluxo` |
| Progresso de uma meta (fotografia: clientes ativos/churn/...) | comparação direta realizado vs meta, sem extrapolação | `lib/data/objetivos.ts` → `progressoStock` |
| Funil inverso ("quero X clientes") | leads = X ÷ taxa de conversão real; experimentais/contactos = leads × a respetiva taxa real | `lib/data/objetivos.ts` → `calcularFunilInverso` |
| Simulador "E se…" (clientes, MRR, margem, CAC, LTV, LTV/CAC, payback) | fórmulas de negócio clássicas sobre valores hipotéticos (não lê nenhum dado real) | `lib/data/simulador.ts` → `simular` |

## Fora do que está implementado (e porquê)

- **CAC real e LTV real** (fora do simulador): precisam de
  `marketing_costs` preenchida — a tabela existe desde a Fase 2 mas
  não há nenhuma interface para lá meter números.
- **Projeções de 3/6/12/24 meses com sazonalidade** (secção 6.2):
  precisam de histórico mensal real, que só começou a acumular em
  `kpi_snapshots_daily` a 2026-10-29. Construir isto antes disso dava
  números com ar de rigor sem nenhum dado a sustentá-los.
- **Mix por modalidade** (clientes): os clientes não têm um campo de
  modalidade, só os leads (`modalidade_interesse`).
