-- Token fixo por estúdio para o código QR de check-in — basta existir
-- em "config" (mesma tabela já usada para outras definições) e ser
-- comparado em lib/data/checkin.ts. Sem custo nenhum: não são
-- segredos de autenticação, só identificam qual estúdio é.
insert into public.config (chave, valor) values
  ('qr_token_fatima', '71ed0063a0e5d6f19270bd07cd4d414b'),
  ('qr_token_leiria', '13e83114aafe2bb2790d4b54f77fa0ee')
on conflict (chave) do nothing;
