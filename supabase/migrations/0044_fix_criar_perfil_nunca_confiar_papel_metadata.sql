-- CRÍTICO: a função que cria o perfil ao registar uma conta nova lia o
-- "papel" diretamente dos metadados enviados no registo
-- (raw_user_meta_data). Esses metadados são controlados por quem se
-- regista e podem ser manipulados diretamente na API de autenticação da
-- Supabase (com a anon key, que é pública), completamente fora desta
-- app — permitindo a qualquer pessoa registar-se já como "admin".
-- A app em si nunca enviou "papel" no registo (só "nome"), por isso
-- esta correção não muda nada do comportamento normal: toda a conta
-- nova passa sempre a entrar como 'pt' (o papel menos privilegiado);
-- promoções continuam a fazer-se à mão, em Equipa, por alguém com
-- e_gestao() — já protegido por RLS (editar_proprio_perfil/gerir_perfis).
create or replace function public.criar_perfil_novo_utilizador()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    'pt'
  );
  return new;
end;
$function$;

-- WARN do linter: funções SECURITY DEFINER sem search_path fixo podem
-- ser enganadas por um esquema malicioso que sombreie uma tabela/função
-- usada lá dentro. Fixa explicitamente a 'public' em todas.
alter function public.treinos_previstos(freq smallint, ano integer, mes integer) set search_path = public;
alter function public.resumo_presencas(ano integer, mes integer) set search_path = public;
alter function public.quadro_do_dia(p_estudio smallint, p_dia date) set search_path = public;
alter function public.limite_pt_por_hora() set search_path = public;
alter function public.resumo_mensal_pt(p_estudio smallint, p_ano integer, p_mes integer) set search_path = public;
alter function public.aniversarios_do_mes(p_estudio smallint, p_mes integer) set search_path = public;
