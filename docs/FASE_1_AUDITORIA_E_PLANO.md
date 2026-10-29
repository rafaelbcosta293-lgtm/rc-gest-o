# Fase 1 — Auditoria e plano técnico

> Resposta à especificação em `docs/ESPECIFICACAO_CRM_ANALITICA.md`.
> Nada de código de funcionalidades foi escrito nesta fase — só esta
> auditoria e o plano. Fica à espera do OK para a Fase 2.

## 1. Stack

- **Next.js 16.3.5** (App Router, Turbopack), **React 19.2.8**, TypeScript.
- **Supabase**: Postgres + Auth + RLS. Projeto `ttlrwfdxslbuhaaxwhev` ("rc-gestao"), região `eu-central-1` (Frankfurt).
- **Tailwind v4** com tokens centrais em `app/globals.css` (`@theme inline`) — mudar uma cor/sombra/raio aqui muda a app toda, sem tocar em mais nenhum ficheiro.
- **lucide-react** para ícones. **Nenhuma biblioteca de gráficos** — os gráficos que já existem (dashboards de Administração/Coordenação, feitos numa sessão recente) são SVG à mão, em `components/StatCard.tsx`, `Sparkline.tsx`, `BarMeter.tsx`, `RadialProgress.tsx`. Zero dependências de peso.
- **googleapis** para a integração com o Google Calendar.
- Deploy na **Vercel** (região `fra1`, igual à da base de dados — já otimizado), via GitHub Actions (cron a cada 30 min, porque o plano Hobby só dá cron diário nativo).
- **Não há nenhuma framework de testes instalada** (sem Jest/Vitest). Isto é uma lacuna direta para a secção 9 da especificação.
- Duas apps vivem neste mesmo repositório: esta ("RC Gestão", branch de produção `claude/supabase-auth-part-1-51divn`, o que o resto deste documento descreve) e uma app de clientes, mais simples, na branch `app-clientes`. Não mexo nessa branch nesta fase.

## 2. Estrutura de pastas (resumo)

```
app/
  painel/
    admin/              — dashboard financeiro + pendências (só Administração, por email)
    coordenacao/        — dashboard operacional (Fátima+Leiria juntas) + marketing + horários
    [estudio]/           — área por estúdio (Fátima | Leiria)
      clientes/, treinos/, presencas/, avaliacoes/, leads/, pagamentos/,
      checklist/, horarios/, agenda/, equipa/
  api/cron/              — reconciliação de presenças (30 min) e retenção (diário)
  login/, registo/, recuperar-password/, atualizar-password/
lib/
  data/                  — lógica de negócio e acesso a dados, por módulo
  google/calendar.ts     — leitura do Google Calendar
  supabase/              — clientes Supabase (server/proxy) + tipos gerados à mão
components/              — componentes partilhados (inclui os 4 novos de gráficos)
supabase/migrations/     — 17 migrations incrementais (não é o esquema completo — ver secção 3)
docs/                    — este ficheiro e a especificação
```

## 3. Modelo de dados atual

**Importante:** `supabase/migrations/` tem só as alterações *incrementais* desde que começámos a trackear migrations — o esquema base (tabelas, enums, funções, RLS) foi criado diretamente no Supabase antes disso e não está reproduzido em código. A fonte da verdade é o projeto Supabase live. Fica registado aqui para a Fase 2 não assumir que `supabase/migrations/` é reproduzível do zero.

**Tabelas principais** (schema `public`, todas com RLS ativo):

| Tabela | Para quê |
|---|---|
| `estudios` | Fátima/Leiria |
| `perfis` | conta de cada pessoa da equipa, com `papel` (`admin`\|`studio_manager`\|`master_trainer`\|`pt`) |
| `perfis_estudios` | que estúdios cada pessoa vê |
| `clientes` | ficha do cliente (já tem `auth_user_id`, usado pela app de clientes) |
| `planos`, `pagamentos` | preços e histórico de pagamentos |
| `sessoes`, `sessao_exercicios`, `categorias`, `exercicios`, `exercicios_categorias` | treinos |
| `presencas` | com `origem` (`manual`\|`calendario`) e `google_event_id` — já integrado com o Calendar |
| `avaliacoes` | avaliações físicas, com campos gerados (IMC, massa gorda/magra em kg) |
| `leads`, `lead_contactos` | **já existe um funil simples**: `estado` = Novo/Contactado/Visita marcada/Visita feita/Convertido/Perdido, mais `origem`, `interesse`, `disponibilidade`, `valor_potencial`, `responsavel_id`, `proximo_contacto` |
| `escalas`, `ausencias`, `registos_pt` | escala semanal dos PTs e horas registadas |
| `checklist_modelo`, `checklist_registos`, `checklist_respostas` | abertura/fecho |
| `agenda_eventos` | agenda interna construída recentemente (grelha contínua ao minuto, repetição por `serie_id`) |
| `envios_aniversario` | registo de parabéns enviados |
| `clientes_sem_agendamento` | cache escrita pelo cron diário de retenção |
| `config` | par chave/valor genérico — **candidato natural a virar/alimentar o `settings` da especificação** |
| `eventos` | tabela de anúncios simples (título/corpo/publicado), usada pela app de clientes |

**Views já existentes:**
- `v_estado_pagamento` — `em_dia`/`valido_ate` por cliente, **sem expor `valor`**. É `SECURITY DEFINER` *de propósito*: contorna o RLS admin-only de `pagamentos` só para devolver o booleano, nunca o valor. O linter do Supabase assinala isto (nível ERROR, "Security Definer View") — é intencional e já cumpre a "regra de ouro" da especificação, mas vale a pena documentar a intenção explicitamente no código (farei isso na Fase 2).
- `v_leads_paradas`, `v_reavaliacoes_pendentes`, `v_clientes_sem_treino_recente` — alimentam as "Pendências" de Administração/Coordenação.
- `v_leads_sem_valores` e `v_clientes_em_risco` — **existem na base de dados mas não são usadas em nenhum sítio do código.** Parecem ter sido criadas a pensar exatamente no que a especificação pede (leads sem `valor_potencial` para quem não é Administração/Comercial; clientes em risco cruzando falta de treino com a cache de retenção) e ficaram por ligar. Boa base para reaproveitar nas Fases 3/4 em vez de recriar.

**Funções SQL já existentes mas nunca chamadas pela app** (confirmei: zero `.rpc(...)` em todo o código):
- `quadro_do_dia(estudio, dia)` — devolve `leads_novas, contactos, contactos_sucesso, sessoes_agendadas, sessoes_para_hoje, vendas, valor_vendas`. **É quase literalmente a secção 4.1 "Quadro do dia" da especificação**, já em SQL.
- `resumo_mensal_pt(estudio, ano, mes)` — horas previstas/realizadas, treinos 40/60, dias de férias por PT. Sobrepõe-se à secção 4.4 "Produtividade por PT".
- `resumo_presencas(ano, mes)` — previstos vs realizados por cliente. É a "Assiduidade" da secção 4.3.
- `treinos_previstos(freq, ano, mes)` — **duplicada**: existe também como função TypeScript (`lib/data/presencas.ts`). As duas fazem o mesmo cálculo por caminhos diferentes; risco de um dia divergirem. Vou unificar numa só fonte de verdade na Fase 2.
- `aniversarios_do_mes(estudio, mes)` — a página de aniversários reimplementa isto em TS com uma query direta, em vez de chamar a função.

Ou seja: parte do trabalho da especificação já foi pensada ao nível da base de dados, só nunca foi ligada à interface. Vou reaproveitar o que faz sentido em vez de duplicar.

**Lacunas de esquema face à especificação** (nada disto existe ainda): `lead_stage_history`, `activities` (timeline unificada), `goals`, `marketing_costs`, `alert_rules`/`alerts`, `kpi_snapshots_daily`, `settings` dedicada (`config` é o embrião). O `leads` atual também não tem: campanha, modalidade de interesse, comercial responsável *separado* de `responsavel_id` (já existe, só precisa de ligação ao papel "Comercial"), etapa com histórico de datas, temperatura. O enum de etapas atual (6 estados) é mais curto que o funil de 8 etapas pedido.

## 4. Áreas existentes

Por estúdio: Clientes, Treinos, Presenças, Avaliações, Leads, Pagamentos, Abertura/Fecho, Horários, Agenda, Equipa.
Combinadas (Fátima+Leiria lado a lado): Coordenação (+ Marketing, + Horários/escalas), Administração (financeiro + pendências), ambas atrás de password própria (`lib/data/gate.ts`) além do login.

Os dashboards de Administração e Coordenação já foram redesenhados recentemente com cartões de estatística, gráficos de barras e anéis de progresso (sem biblioteca externa) — ver `components/StatCard.tsx` e companhia. É uma boa base visual para a secção 8 da especificação (cartões de KPI com número grande + variação + sparkline é exatamente o padrão já montado).

Existe ainda uma rota órfã, `app/painel/[estudio]/tarefas/page.tsx` — não é um bug, é um redirect de compatibilidade deixado de propósito depois de "Tarefas diárias" ter sido removida (migration `0015`). Não precisa de ação.

## 5. Integração com o Google Calendar

- `lib/google/calendar.ts`: lê eventos por intervalo de tempo e cor (`eventosComCorNoIntervalo`), e reconhece o cliente pelo primeiro+último nome (`clienteExatoDoEvento`).
- `app/api/cron/presencas-calendario/route.ts`: a cada 30 min (GitHub Actions, porque a Vercel Hobby só dá cron diário), marca presença automaticamente pela cor do evento no fim do evento, e desmarca se a cor mudar depois. Nunca mexe em presenças marcadas manualmente. Protegido por `CRON_SECRET`.
- `app/api/cron/retencao/route.ts`: diário, escreve a cache `clientes_sem_agendamento` (cliente ativo sem nada à frente no Calendar).
- **Disciplina de privacidade**: o repositório é público, por isso o log da Action nunca imprime nomes de clientes — só contagens. Isto tem de se manter em tudo o que a especificação pede que corra agendado (alertas, snapshots diários).
- A agenda interna (`agenda_eventos`), construída há pouco, é deliberadamente **independente** do Google Calendar — não lê nem escreve lá. A especificação não pede para as unificar; vou manter assim a não ser que digas o contrário.

## 6. Autenticação e permissões — como funciona hoje (importante para a Fase 2)

Há **duas camadas de permissão, independentes**:

1. **RLS na base de dados** (`e_admin()`, `e_gestao()`, `tenho_estudio()`, todas `SECURITY DEFINER` lendo `perfis.papel` e `perfis_estudios`). Esta é a fronteira a sério: `pagamentos` e `planos` têm política `admin_pagamentos`/`admin_planos` com `using e_admin()` — **só quem tem `papel = 'admin'` lê ou escreve preços e pagamentos, já ao nível do backend.** A "regra de ouro" da especificação já está cumprida aqui, não é só escondido na interface.
2. **Gate por email fixo na aplicação** (`lib/data/acessos.ts`): o acesso às páginas `/painel/admin`, `/painel/coordenacao` e a cada `/painel/[estudio]` é decidido por uma lista de **emails fixos** (o teu, um email "geral", e um email por estúdio) — não pelo `papel` da pessoa. `podeAcederAdmin` só deixa passar `rafaelbcosta293@gmail.com`, sejam quais forem os papéis que existam na tabela `perfis`.

Isto tem uma consequência a resolver: a especificação pede "**navegação por função: cada pessoa entra e vê primeiro o seu painel**" e um papel **Comercial** — e hoje não há papel "Comercial" nenhum (o enum só tem admin/studio_manager/master_trainer/pt), e a navegação por área não depende do papel, depende de quem está a usar o email partilhado. Trato isto como uma decisão a validar contigo antes da Fase 2 (pergunta 1, abaixo).

Também confirmei (via `mcp__Supabase__get_advisors`) que não há fugas de dados financeiros por nenhum caminho que eu tenha testado — o único aviso de segurança "real" é o `SECURITY DEFINER` da `v_estado_pagamento`, que é intencional. Há avisos menores (6 funções sem `search_path` fixo, a extensão `pg_net` na schema `public`, proteção contra passwords comprometidas desligada) — não são urgentes, mas trato-os na Fase 2 por estarem relacionados com as novas funções que vou escrever.

## 7. O que está partido ou incompleto

- **Sem testes nenhuns** — a especificação pede testes unitários a todas as fórmulas de KPI; parto de zero.
- **Sem papel "Comercial"**, nem área própria para quem só faz vendas/leads.
- **Acesso por área gerido por email fixo, não por papel** — funciona para a escala atual (poucas contas partilhadas), mas não escala para "cada pessoa vê o seu painel" sem alguma mudança.
- **Duas fontes da mesma fórmula** (`treinos_previstos` em SQL e em TS) — risco de divergência.
- **Funções SQL prontas e nunca ligadas** (`quadro_do_dia`, `resumo_mensal_pt`, `resumo_presencas`, `aniversarios_do_mes`) — oportunidade, não defeito.
- **`v_leads_sem_valores` e `v_clientes_em_risco`** na base de dados sem qualquer código a usá-las.
- Nada do resto (funil completo, timeline, alertas, metas, projeções, simulador, relatórios/exportação, auditoria) existe ainda — é o corpo do trabalho das Fases 2–7.

## 8. Plano técnico por fase (adaptado ao que existe)

### Fase 2 — Base de dados e timeline
- Novo enum `papel_utilizador` a incluir `comercial` (migration reversível: `ALTER TYPE ... ADD VALUE`).
- Tabelas novas: `lead_stage_history`, `activities`, `goals`, `marketing_costs`, `alert_rules`, `alerts`, `kpi_snapshots_daily`, `settings` (ou evoluir `config` para o mesmo fim — ver pergunta 3).
- Alargar `leads`: campanha, modalidade de interesse, temperatura, etapa alargada para as 8 da especificação (com migração dos 6 estados atuais para os novos, sem perder histórico).
- Triggers nos módulos existentes (pagamentos, presenças, avaliações, checklist, leads) a escrever em `activities`, para a timeline ficar completa sem reescrever esses módulos.
- Unificar `treinos_previstos` numa só fonte (mantenho a função SQL, a versão TS passa a só formatar).
- Ligar `quadro_do_dia`/`resumo_mensal_pt`/`resumo_presencas` à app em vez de as deixar por usar.
- Dados de demonstração: só numa **branch de desenvolvimento do Supabase** (`mcp__Supabase__create_branch`), nunca no projeto de produção — cumpre ao mesmo tempo "não apagues dados reais" e "só em desenvolvimento".
- Instalar **Vitest** (leve, nativo para Next/TS, zero configuração complexa) para a secção 9.

### Fase 3 — Funil e CRM
- Kanban novo (drag-and-drop) reaproveitando o padrão já usado na Agenda (grelha interativa cliente-side com ações rápidas via server actions "silenciosas", sem navegar).
- Ficha da lead: timeline a partir de `activities`, botões rápidos (ligar/WhatsApp/registar contacto/agendar experimental → cria em `agenda_eventos`, não no Google Calendar diretamente, a não ser que prefiras o Calendar — pergunta 4).
- Importação CSV/XLSX e Google Sheets.
- Métricas do funil sobre `lead_stage_history`.

### Fase 4 — Motor de alertas
- `alert_rules`/`alerts` + função agendada (Supabase cron/Edge Function) a avaliar as regras da tabela da especificação.
- Centro de alertas na navegação (contador + agrupado por severidade), resumo diário.

### Fase 5 — Painéis
- Reaproveita `StatCard`/`BarMeter`/`RadialProgress`/`Sparkline` já existentes; acrescento `FunnelChart`, `HeatmapGrid` (dia×hora e Blocos Exclusivos) e `LineChart` leve, todos SVG à mão — ver pergunta 2 sobre Recharts.
- Quadro do dia liga-se a `quadro_do_dia`; Produtividade por PT a `resumo_mensal_pt`; Assiduidade a `resumo_presencas`.
- Painel financeiro só visível a `e_admin()`, reforçado também na interface (dupla barreira, como já é o padrão nesta app).

### Fase 6 — Objetivos, projeções e simulador
- `goals` + projeção linear simples primeiro (ritmo atual vs meta), só depois os 3 cenários com sazonalidade — não acrescento complexidade de previsão antes de haver dados reais de 12 meses para validar contra.

### Fase 7 — Relatórios, exportação, auditoria, polimento, documentação
- Export CSV/XLSX (sem biblioteca pesada — `Response` com `text/csv` para CSV; para XLSX avalio uma biblioteca leve só nessa fase, com justificação).
- PDF do resumo mensal.
- Tabela de auditoria genérica (trigger a registar antes/depois em `pagamentos`, `planos`, `config`/`settings`).

## 9. Perguntas antes de avançar para a Fase 2

1. **Acesso por função vs. acesso por email fixo.** Proponho manter o acesso a Administração exatamente como está (só o teu email, já reforçado por RLS) e passar Coordenação/Comercial/Master Trainer/PT a decidir o que veem primeiro pelo `papel` de cada conta (cada pessoa já tem login próprio, exceto as contas partilhadas por estúdio). Concordas, ou preferes manter tudo por email fixo e só acrescentar o Comercial à lista?
2. **Gráficos: Recharts ou continuar sem dependências?** Já tenho 4 componentes de gráfico SVG à mão, sem biblioteca, usados nos dashboards atuais. A especificação sugere Recharts "se for React". Recharts traz mais tipos de gráfico prontos (funil, heatmap, área com intervalo de cenários) mas é uma dependência com peso real. Prefiro continuar a construir à mão (consistente com o resto da app) e só trazer Recharts se algum gráfico específico (ex.: os 3 cenários de projeção) for claramente mais seguro feito numa biblioteca testada. Confirmas?
3. **`settings`**: aproveito e alargo a tabela `config` que já existe (chave/valor), ou crias mesmo uma tabela `settings` nova e separada?
4. **Agendar experimentais a partir da ficha da lead**: crio o evento na Agenda interna (já construída, mais rápida) ou tem mesmo de ir para o Google Calendar partilhado do estúdio, como os outros agendamentos?
5. **Ambiente de demonstração**: confirmas que posso usar uma branch do Supabase (ambiente separado, não o projeto de produção) para os dados de demonstração de 12 meses, em vez de os colocar no projeto real?
6. **Prioridade dentro da Fase 5**: painéis é a fase maior da especificação (6 subsecções). Depois dos alertas (Fase 4), há alguma das seis (Quadro do dia / Comercial / Clientes-retenção / Operacional / Financeiro / Timeline da empresa) que queiras ver primeiro, ou sigo pela ordem da especificação?

À espera do teu OK (e das respostas acima que fizerem sentido) para arrancar na Fase 2.
