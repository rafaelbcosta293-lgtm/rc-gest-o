# Verificação de qualidade (secção 9)

## Testes unitários às fórmulas

145 testes (`npm run test`, Vitest) em 14 ficheiros, um por módulo de
`lib/data/`: `funil`, `comercial`, `retencao`, `operacional`,
`financeiro`, `objetivos`, `simulador`, `alertas`, `auditoria`, `csv`,
além dos módulos mais antigos (`presencas`, `agenda`, `marketing`,
`clientes`). Todas as fórmulas listadas em `docs/FORMULAS_KPIS.md`
têm pelo menos um teste a cobrir o caso normal e os casos limite
(divisão por zero, listas vazias, valores nulos).

## "Um PT nunca recebe valores em €, nem pela API"

Verificado empiricamente (não é um teste automático — fica aqui o
comando para repetir sempre que uma tabela financeira nova for
criada), simulando a sessão de um PT real e contando quantas linhas
cada tabela sensível devolve:

```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<id de um PT>', 'role','authenticated')::text, true);
select count(*) from public.pagamentos;        -- 0
select count(*) from public.planos;             -- 0
select count(*) from public.marketing_costs;    -- 0
select count(*) from public.cenarios_simulador; -- 0
select count(*) from public.auditoria;          -- 0
```

Resultado em 2026-10-30: **0 linhas em todas**, confirmando que
`admin_pagamentos`/`admin_planos`/`admin_marketing_costs`/
`admin_cenarios_simulador`/`admin_auditoria` (todas `using
(e_admin())`) bloqueiam mesmo um PT real, não só na UI.

Verificado também que nenhuma linha de `activities` (a timeline
partilhada entre leads/clientes, visível a toda a equipa do estúdio)
guarda a chave `valor` em `metadados`:

```sql
select count(*) from public.activities where metadados ? 'valor'; -- 0
```

**Atenção ao repetir isto com o cliente de serviço (service role)
em vez de uma sessão real**: `v_estado_pagamento` chama
`tenho_estudio()`, que depende de `auth.uid()` — com o service role
(sem sessão) devolve sempre 0 linhas, por qualquer papel, o que
pareceria "seguro" mas é só a view a falhar silenciosamente. Ver
`docs/MODELO_DE_DADOS.md` para o detalhe.

## Validação dos KPIs com dados de demonstração

A especificação pede uma tabela "valor esperado vs calculado" sobre
dados de demonstração, usando uma branch de desenvolvimento do
Supabase para não misturar dados falsos com os dados reais do
negócio. **Decisão do dono (2026-10-30): não avançar com isto.**

A causa raiz só ficou clara ao tentar criar a branch a sério: não é
uma questão de aprovar um custo (branching do Supabase cobra por
hora de computação) — o plano atual do projeto Supabase nem sequer
suporta branches (`PaymentRequiredException: Branching is supported
only on the Pro plan or above`). Faria falta um upgrade do projeto
para o plano Pro, com custo mensal fixo, só para este teste. O dono
optou por não o fazer e deixar este ponto documentado como bloqueado,
em vez de gerar os dados de demonstração diretamente na produção
(opção que também foi oferecida e recusada, por misturar dados falsos
com os dados reais do negócio, mesmo que temporariamente).

Sem dados de demonstração, a validação real feita até agora foi:
- os 145 testes unitários (acima), que cobrem a lógica de cada
  fórmula isoladamente, com números inventados mas conhecidos;
- verificação manual dos ecrãs com os dados reais da app em produção
  (poucos registos, por ser um negócio real, não uma demonstração).

Se um dia o projeto Supabase passar a Pro por outro motivo, este
ponto pode ser retomado: criar a branch, gerar 12 meses de dados
variados nos dois estúdios, e construir a tabela de verificação.

## Build e lint

`npm run build` e `npm run lint` sem erros em cada commit desta fase
— confirmado antes de cada push ao longo de toda a sessão.
