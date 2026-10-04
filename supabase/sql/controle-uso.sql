-- Quem está usando cada cartão de som/TV do Controle (para "dividir" com quem chegar depois).
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.
--
-- chave = id do cartão (controle_equipamentos.id). Quem liga vira "dono"; quem aceita dividir entra
-- em "participantes". Quando o aparelho desliga, o app apaga a linha.
create table if not exists public.controle_uso (
  chave         text primary key,
  dono          uuid not null references auth.users (id) on delete cascade,
  dono_nome     text,
  participantes uuid[] not null default '{}',
  desde         timestamptz not null default now()
);
alter table public.controle_uso enable row level security;
drop policy if exists "controle_uso ativos" on public.controle_uso;
create policy "controle_uso ativos" on public.controle_uso
  for all to authenticated using (public.is_ativo()) with check (public.is_ativo());
-- Tempo real: os outros celulares veem na hora quem ligou.
do $$ begin
  alter publication supabase_realtime add table public.controle_uso;
exception when duplicate_object then null; end $$;
