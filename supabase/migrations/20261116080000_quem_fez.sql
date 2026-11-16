-- Quem fez (a pessoa, não a conta).
--
-- Nos estúdios trabalha-se numa conta partilhada (o tablet), por isso
-- "registado_por" diz só de que conta veio. Estas colunas guardam o nome
-- escolhido por quem resolve um alerta, regista um pagamento, faz o
-- fecho de caixa ou regista um contacto a uma lead — como "feita_por"
-- nas tarefas. Se a pessoa for eliminada, o registo fica sem o nome.
alter table public.alerts add column if not exists quem_fez uuid references public.perfis(id) on delete set null;
alter table public.pagamentos add column if not exists quem_fez uuid references public.perfis(id) on delete set null;
alter table public.fechos_caixa add column if not exists quem_fez uuid references public.perfis(id) on delete set null;
alter table public.lead_contactos add column if not exists quem_fez uuid references public.perfis(id) on delete set null;
create index if not exists alerts_quem_fez_idx on public.alerts (quem_fez) where quem_fez is not null;
create index if not exists pagamentos_quem_fez_idx on public.pagamentos (quem_fez) where quem_fez is not null;
create index if not exists fechos_caixa_quem_fez_idx on public.fechos_caixa (quem_fez) where quem_fez is not null;
create index if not exists lead_contactos_quem_fez_idx on public.lead_contactos (quem_fez) where quem_fez is not null;
