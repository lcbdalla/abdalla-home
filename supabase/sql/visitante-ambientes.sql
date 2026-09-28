-- Escolher quais cômodos (ambientes) o VISITANTE pode usar no Controle da Casa.
-- Cada cômodo ganha a chave "Visitantes podem usar" (começa ligada em todos).
-- Rodar UMA vez no Supabase > SQL Editor, ANTES de publicar de novo o "controle-proxy".
alter table public.ambientes add column if not exists visitante boolean not null default true;

create or replace function public.is_visitante()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'visitante');
$$;

-- Visitante só enxerga os cômodos liberados e os aparelhos deles.
drop policy if exists "ambientes visitante so liberados" on public.ambientes;
create policy "ambientes visitante so liberados" on public.ambientes as restrictive
  for select to authenticated using (not public.is_visitante() or visitante);

drop policy if exists "equipamentos visitante so liberados" on public.controle_equipamentos;
create policy "equipamentos visitante so liberados" on public.controle_equipamentos as restrictive
  for select to authenticated using (
    not public.is_visitante()
    or exists (select 1 from public.ambientes a where a.id = ambiente_id and a.visitante)
  );
