-- Libera enviar/ler fotos no bucket "fotos" para quem está logado e ativo.
-- Rodar uma vez no Supabase > SQL Editor.

-- Enviar (upload):
drop policy if exists "fotos upload" on storage.objects;
create policy "fotos upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_ativo());

-- Ler (o app mostra as fotos pela URL pública, mas garante o acesso logado):
drop policy if exists "fotos leitura" on storage.objects;
create policy "fotos leitura" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos');
