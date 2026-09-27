-- Ambientes do Controle da Casa + vínculo de equipamentos.
-- Rodar UMA vez no Supabase > SQL Editor (cole tudo e clique em RUN).
--
-- O que este roteiro faz:
--  * Cria a permissão "gestor do controle" (só quem tem isso cria ambientes
--    e vincula aparelhos). Isso é diferente de "pode_controle" (que apenas usa).
--  * Cria as tabelas "ambientes" e "controle_equipamentos".
--  * Liga a segurança (RLS): quem controla a casa LÊ; só o gestor MEXE.
--  * Concede o papel de gestor às duas contas do dono.

-- 1) Permissão de GESTOR do controle (quem pode organizar ambientes/aparelhos).
alter table public.perfis
  add column if not exists pode_gerir_controle boolean not null default false;

-- Função de apoio: a pessoa está logada, ativa e é gestora do controle?
create or replace function public.is_gestor_controle()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.pode_gerir_controle
  );
$$;

-- Quem pode VER os ambientes/aparelhos (ativo e com controle OU gestor).
create or replace function public.pode_ver_controle()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and (p.pode_controle or p.pode_gerir_controle)
  );
$$;

-- 2a) Tabela de PAVIMENTOS (andares: Térreo, 1º Pavimento, Subsolo, Área Externa).
create table if not exists public.pavimentos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ordem      int  not null default 0,
  criado_em  timestamptz not null default now()
);
alter table public.pavimentos enable row level security;

drop policy if exists "pavimentos leitura" on public.pavimentos;
create policy "pavimentos leitura" on public.pavimentos
  for select to authenticated using (public.pode_ver_controle());

drop policy if exists "pavimentos gestor escreve" on public.pavimentos;
create policy "pavimentos gestor escreve" on public.pavimentos
  for all to authenticated
  using (public.is_gestor_controle()) with check (public.is_gestor_controle());

-- 2b) Tabela de AMBIENTES (cômodos: Sala, Quarto, Varanda...), dentro de um pavimento.
create table if not exists public.ambientes (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  pavimento_id uuid references public.pavimentos(id) on delete set null,
  icone        text,
  ordem        int  not null default 0,
  criado_em    timestamptz not null default now()
);
alter table public.ambientes enable row level security;
-- (caso a tabela já exista de uma versão anterior, garante a coluna do pavimento)
alter table public.ambientes add column if not exists pavimento_id uuid references public.pavimentos(id) on delete set null;

drop policy if exists "ambientes leitura" on public.ambientes;
create policy "ambientes leitura" on public.ambientes
  for select to authenticated using (public.pode_ver_controle());

drop policy if exists "ambientes gestor escreve" on public.ambientes;
create policy "ambientes gestor escreve" on public.ambientes
  for all to authenticated
  using (public.is_gestor_controle()) with check (public.is_gestor_controle());

-- 3) Tabela de EQUIPAMENTOS vinculados a um ambiente.
--    entity_id = o identificador do aparelho no Home Assistant (ex.: climate.sala).
--    tipo      = como o app controla: interruptor | persiana | ar | tv | fechadura | sensor
create table if not exists public.controle_equipamentos (
  id           uuid primary key default gen_random_uuid(),
  ambiente_id  uuid not null references public.ambientes(id) on delete cascade,
  entity_id    text not null unique,
  nome         text,
  tipo         text not null default 'interruptor',
  ordem        int  not null default 0,
  criado_em    timestamptz not null default now()
);
alter table public.controle_equipamentos enable row level security;

drop policy if exists "equipamentos leitura" on public.controle_equipamentos;
create policy "equipamentos leitura" on public.controle_equipamentos
  for select to authenticated using (public.pode_ver_controle());

drop policy if exists "equipamentos gestor escreve" on public.controle_equipamentos;
create policy "equipamentos gestor escreve" on public.controle_equipamentos
  for all to authenticated
  using (public.is_gestor_controle()) with check (public.is_gestor_controle());

-- 4) Tempo real (o app atualiza sozinho quando algo muda). Ignora se já estiver ligado.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.pavimentos'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.ambientes'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.controle_equipamentos'; exception when others then null; end;
end $$;

-- 4b) Já deixa os PAVIMENTOS do Rancho criados (só na primeira vez, se estiver vazio).
insert into public.pavimentos (nome, ordem)
select v.nome, v.ordem
from (values ('1º Pavimento', 1), ('Térreo', 2), ('Subsolo', 3), ('Área Externa', 4)) as v(nome, ordem)
where not exists (select 1 from public.pavimentos);

-- 5) Concede o papel de GESTOR às duas contas do dono (Leonardo).
--    (Só funciona para contas que já existem no login.)
update public.perfis set pode_gerir_controle = true
where id in (
  select id from auth.users
  where lower(email) in ('ranchoabdalla@gmail.com', 'lcbdalla@gmail.com')
);

-- Garante também que essas contas conseguem USAR o controle.
update public.perfis set pode_controle = true
where id in (
  select id from auth.users
  where lower(email) in ('ranchoabdalla@gmail.com', 'lcbdalla@gmail.com')
);
