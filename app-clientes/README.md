# App do cliente — RC Private Fitness Studio

Projeto **separado** da gestão:

| | Gestão (`/`) | App do cliente (`app-clientes/`) |
|---|---|---|
| Vercel | `rc-gest-o` | `rc-clientes` (Root Directory = `app-clientes`) |
| Supabase | `rc-gestao` | `rc-clientes` |
| Chaves | as da gestão | **só** a chave pública do `rc-clientes` |

A app do cliente não tem nenhuma chave, endereço ou permissão da gestão.
A ponte é só a sincronização que corre no servidor da gestão
(`/api/cron/app-clientes`, chamada pelo pg_cron de 20 em 20 s):

1. lê os **pedidos** (reservar/cancelar aula, pedir desmarcação de treino),
   valida-os com as regras da gestão e responde;
2. copia para cá, de cada cliente com conta, **só** os seus dados
   (aulas do estúdio com vagas, os seus treinos, presenças e avaliações).

Na base `rc-clientes` cada pessoa só lê as suas linhas (RLS), só pode
criar pedidos, e não há registo público (as contas são criadas pela
gestão, por convite SMS). As funções `sync_*` exigem um token que só o
servidor da gestão tem (`APP_CLIENTES_SYNC_TOKEN`).

Variáveis (Vercel, projeto `rc-clientes`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Esquema da base de dados: `supabase/migrations/`.
