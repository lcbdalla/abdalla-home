-- Pasta PRIVADA no Storage ("privado") para arquivos que não podem ficar abertos na internet,
-- como o mapa das câmeras (mapa-cameras.jpg). Só quem está logado e ativo no app consegue abrir.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run.
insert into storage.buckets (id, name, public)
values ('privado', 'privado', false)
on conflict (id) do update set public = false;

drop policy if exists "privado leitura quem esta ativo" on storage.objects;
create policy "privado leitura quem esta ativo" on storage.objects for select to authenticated
  using (bucket_id = 'privado' and public.is_ativo());
