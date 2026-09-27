-- Ajuste de segurança do Controle da Casa.
-- Rodar uma vez no Supabase > SQL Editor.

-- Ana Carolina não controla a casa, mesmo sendo administradora.
update public.perfis set pode_controle = false where nome = 'Ana Carolina';

-- Ler o token do HA passa a exigir a permissão "pode_controle" (ser admin NÃO basta).
drop policy if exists "ha_config leitura autorizada" on public.ha_config;
create policy "ha_config leitura autorizada" on public.ha_config
  for select to authenticated
  using (exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.pode_controle
  ));

-- Guardar/trocar o token continua só de administrador — mas isso NÃO concede leitura.
drop policy if exists "ha_config admin escreve" on public.ha_config;
create policy "ha_config admin insert" on public.ha_config for insert to authenticated with check (public.is_admin());
create policy "ha_config admin update" on public.ha_config for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ha_config admin delete" on public.ha_config for delete to authenticated using (public.is_admin());
