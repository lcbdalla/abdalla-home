-- Escolher quais cômodos (ambientes) cada pessoa (não administrador) pode usar no Controle da Casa.
-- perfis.ambientes_controle: vazio (null) = todos os cômodos; com uma lista = só esses.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run.
alter table public.perfis add column if not exists ambientes_controle uuid[];

-- Lista de cômodos liberados de quem está usando o app (null = todos; administrador = sempre todos).
create or replace function public.ambientes_liberados()
returns uuid[] language sql stable security definer set search_path = public as $$
  select p.ambientes_controle from public.perfis p where p.id = auth.uid() and p.papel <> 'admin';
$$;

-- A pessoa só enxerga os cômodos liberados e os aparelhos deles (o controle-proxy também barra).
drop policy if exists "ambientes so os liberados da pessoa" on public.ambientes;
create policy "ambientes so os liberados da pessoa" on public.ambientes as restrictive
  for select to authenticated using (public.ambientes_liberados() is null or id = any (public.ambientes_liberados()));

drop policy if exists "equipamentos so os liberados da pessoa" on public.controle_equipamentos;
create policy "equipamentos so os liberados da pessoa" on public.controle_equipamentos as restrictive
  for select to authenticated using (public.ambientes_liberados() is null or ambiente_id = any (public.ambientes_liberados()));

notify pgrst, 'reload schema';
