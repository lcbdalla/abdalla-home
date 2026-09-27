-- Base da integração com o Home Assistant.
-- Rodar uma vez no Supabase > SQL Editor.

-- 1) Permissão "pode controlar a casa" em cada perfil.
alter table public.perfis
  add column if not exists pode_controle boolean not null default false;

-- 2) Configuração do HA (endereço + token). Fica protegida: só quem pode controlar lê.
create table if not exists public.ha_config (
  id            text primary key default 'default',
  base_url      text,
  token         text,
  atualizado_em timestamptz not null default now()
);
alter table public.ha_config enable row level security;

-- Leitura: apenas quem está ativo E (pode_controle OU é admin).
drop policy if exists "ha_config leitura autorizada" on public.ha_config;
create policy "ha_config leitura autorizada" on public.ha_config
  for select to authenticated
  using (exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and (p.pode_controle or p.papel = 'admin')
  ));

-- Escrita (guardar/trocar o token): apenas administradores.
drop policy if exists "ha_config admin escreve" on public.ha_config;
create policy "ha_config admin escreve" on public.ha_config
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3) Já libera o controle para o admin dono.
update public.perfis set pode_controle = true
where id = (select id from auth.users where email = 'ranchoabdalla@gmail.com');
