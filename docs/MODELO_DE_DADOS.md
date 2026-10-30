# Modelo de dados

Visão rápida das tabelas que sustentam o CRM/analítica (secções 2–6 da
especificação). Para o esquema completo, ver `supabase/migrations/` —
cada ficheiro tem o SQL exato e um comentário a explicar a decisão.
Os tipos TypeScript correspondentes estão todos em
`lib/supabase/database.types.ts`.

## Núcleo (já existia antes desta especificação)

- **estudios** — Fátima e Leiria.
- **perfis** / **perfis_estudios** — contas de login e a que estúdio(s)
  têm acesso. `papel` é `admin | studio_manager | master_trainer | pt | comercial`.
- **clientes** — ficha do cliente (estado, frequência, contrato, fim da
  experiência, data de saída).
- **planos**, **pagamentos** — preços e pagamentos efetivos. `pagamentos`
  nunca é lido diretamente por quem não é admin (ver RLS abaixo).
- **presencas**, **avaliacoes**, **escalas**, **registos_pt**, **ausencias**
  — operação diária.
- **leads**, **lead_contactos** — funil comercial.
- **checklist_registos** / **checklist_respostas** — abertura/fecho.
- **agenda_eventos** — agenda interna (treinos, avaliações, reuniões).

## Acrescentado para o CRM/analítica (Fases 2–6)

| Tabela | Para quê | RLS |
|---|---|---|
| `lead_stage_history` | uma linha por mudança de etapa do funil, gravada só por trigger — base das taxas de conversão e do funil inverso | leitura via `tenho_estudio()` da lead associada |
| `activities` | timeline unificada (lead + cliente): contactos, pagamentos, presenças, avaliações, aniversários, mudanças de estado — nunca grava valores em € | `tenho_estudio(estudio_id)` |
| `goals` | metas mensais/anuais por estúdio e métrica (Objetivos, secção 6.1) | `tenho_estudio(estudio_id)` |
| `marketing_costs` | custo de marketing por origem/mês, para o CAC — **vazia**, sem interface para a alimentar ainda | `e_admin()` |
| `alert_rules` | catálogo das regras do motor de alertas, com os limites em `limites` jsonb | leitura livre, escrita `e_gestao()` |
| `alerts` | alertas gerados (novo/visto/resolvido/adiado), com resolução automática | `tenho_estudio(estudio_id)` |
| `kpi_snapshots_daily` | fotografia diária de métricas não-financeiras, para a Timeline da empresa — alimentada a partir de 2026-10-29 pelo cron `/api/cron/kpi-snapshot` | `e_gestao()` |
| `marcos_empresa` | marcos manuais da Timeline da empresa (campanha, preço, equipa, meta) | `e_gestao()` |
| `cenarios_simulador` | cenários guardados do Simulador "E se…" | `e_admin()` |

## A regra de ouro: € nunca sai do admin por acidente

`pagamentos` e `planos` só são lidos diretamente por quem tem
`papel = 'admin'` (políticas `admin_pagamentos`/`admin_planos`,
`using (e_admin())`). Tudo o que precisa de saber "está em dia?" sem
saber "quanto paga?" usa a view `v_estado_pagamento`
(`em_dia`, `valido_ate`, nunca `valor`).

**Cuidado ao escrever um cron**: `v_estado_pagamento` chama
`tenho_estudio()` no próprio corpo da view, que depende de
`auth.uid()`. Um cliente de serviço (service role, sem sessão) recebe
sempre `auth.uid() = null`, logo essa função dá sempre falso e a view
devolve **sempre 0 linhas** para esse cliente — não é um erro, é
silencioso. Os crons que precisam de "em dia?" (`/api/cron/alertas`,
`/api/cron/kpi-snapshot`) replicam a lógica da view diretamente sobre
a tabela `pagamentos` (que o service role lê sem problemas, porque
RLS é mesmo ignorado a esse nível — a diferença é que a lógica da view
não é RLS, é só SQL dentro do corpo da view).

Em qualquer função/view nova que precise do mesmo "em dia sem valor":
reutiliza `v_estado_pagamento` nas páginas normais (sessão de
utilizador real) e replica a lógica em JS nos crons (service role).
