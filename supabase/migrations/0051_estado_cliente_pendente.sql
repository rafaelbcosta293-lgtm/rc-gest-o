-- Novo estado "Pendente": cliente sem pagamento válido (a partir do
-- primeiro dia em atraso) até aos 60 dias, ponto em que passa a
-- "Inativo" (renomeado de "Ex-cliente" — já era assim que aparecia na
-- interface, ver lib/data/constantes.ts). "Suspenso" deixa de ser
-- atribuído automaticamente pelo cron: passa a ser só para casos
-- específicos (saúde ou outras), ativado/desativado sempre à mão. Nem
-- Pendente nem Inativo impedem agendamentos ou o envio de mensagens —
-- isso nunca dependeu do estado do cliente.
alter type estado_cliente add value 'Pendente';
alter type estado_cliente rename value 'Ex-cliente' to 'Inativo';

-- A função do trigger de atividades guardava os valores antigos como
-- literais de texto — o valor enum já foi renomeado acima, mas o
-- literal 'Ex-cliente' no código também tem de ser atualizado, senão
-- deixa de ser um valor válido do tipo e qualquer UPDATE em "clientes"
-- passa a falhar. Também passa a reconhecer regressos a Ativo a
-- partir de Pendente/Inativo como "Reativação" (antes só contava a
-- partir de Suspenso, que era a única transição automática que
-- existia).
create or replace function public.atividade_de_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo tipo_atividade;
begin
  if (tg_op = 'UPDATE' and new.estado is distinct from old.estado) then
    v_tipo := case
      when new.estado = 'Suspenso' then 'Suspensão'
      when new.estado = 'Inativo' then 'Cancelamento'
      when old.estado in ('Suspenso', 'Pendente', 'Inativo') and new.estado = 'Ativo' then 'Reativação'
      else null
    end;
    if v_tipo is not null then
      insert into activities (estudio_id, cliente_id, tipo, descricao, criado_por)
      values (new.estudio_id, new.id, v_tipo, old.estado || ' → ' || new.estado, auth.uid());
    end if;
  end if;
  return new;
end;
$$;
