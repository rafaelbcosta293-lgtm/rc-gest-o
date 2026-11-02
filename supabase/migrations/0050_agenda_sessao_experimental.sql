-- "Sessão experimental": tipo de evento novo, para quando uma lead vem
-- experimentar o estúdio antes de ser cliente. Mostra-se na agenda
-- como "SE - Nome" (o "SE - " é só uma convenção de apresentação,
-- calculada ao mostrar o evento — o campo "titulo" guarda só o nome).
--
-- Como a pessoa ainda não é cliente, o evento não tem cliente_id —
-- fica ligado à lead (lead_id, para reaproveitar os dados dela) e
-- guarda o telemóvel diretamente (telefone), para o lembrete SMS do
-- dia seguinte saber para onde enviar sem precisar de uma ficha de
-- cliente.
alter type tipo_evento_agenda add value 'Sessão experimental';

alter table public.agenda_eventos
  add column telefone text,
  add column lead_id uuid references public.leads(id) on delete set null;

create index on public.agenda_eventos (lead_id);
