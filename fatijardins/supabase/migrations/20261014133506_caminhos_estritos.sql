-- =====================================================================
-- Fatijardins — fase 2: caminhos de fotos e assinaturas sempre no formato
-- "trabalhos/<id do trabalho>/<ficheiro>". Antes, um caminho fora do
-- formato (ex.: com "../" ou noutra pasta) passava na verificação,
-- porque app.trabalho_do_caminho devolve null e um CHECK aceita null.
-- =====================================================================

alter table public.fotos drop constraint fotos_caminho_do_trabalho;
alter table public.fotos
  add constraint fotos_caminho_do_trabalho
  check (
    trabalho_id is null
    or (coalesce(app.trabalho_do_caminho(caminho) = trabalho_id, false) and position('..' in caminho) = 0)
  );

alter table public.registos_trabalho drop constraint registos_assinatura_do_trabalho;
alter table public.registos_trabalho
  add constraint registos_assinatura_do_trabalho
  check (
    assinatura_caminho is null
    or (coalesce(app.trabalho_do_caminho(assinatura_caminho) = trabalho_id, false)
        and position('..' in assinatura_caminho) = 0)
  );
