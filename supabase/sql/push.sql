-- Tabelas do web push (lembretes de tarefa com o app fechado).
-- Rodar uma vez no Supabase > SQL Editor.

-- 1) Inscrições de cada aparelho (um usuário pode ter vários celulares).
create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  criado_em  timestamptz not null default now()
);
alter table public.push_subs enable row level security;
-- Cada pessoa (logada e ativa) só mexe nas próprias inscrições.
-- A Edge Function usa a chave secreta e passa por cima disto para enviar a todos.
drop policy if exists "push_subs proprias" on public.push_subs;
create policy "push_subs proprias" on public.push_subs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_ativo());

-- 2) Trava anti-duplicado: registra que o lembrete daquela tarefa já saiu no dia.
create table if not exists public.lembretes_enviados (
  tarefa_id  uuid not null,
  data       date not null,
  enviado_em timestamptz not null default now(),
  primary key (tarefa_id, data)
);
alter table public.lembretes_enviados enable row level security;
-- Sem políticas: só a Edge Function (chave secreta) escreve aqui.
