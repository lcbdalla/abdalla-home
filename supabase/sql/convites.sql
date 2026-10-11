-- Convites para visitante (link pelo WhatsApp): abre o Portão Principal uma vez, no dia e horário
-- marcados (vale por 5 horas), só perto do portão. Quem pode criar: admin ou quem tem
-- "Pode gerar acesso de visitante". O convidado NÃO tem login: a função "convite" lê esta tabela.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run.
create table if not exists public.convites (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  criado_por   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome_criador text not null,
  convidado    text,
  inicio       timestamptz not null,
  usado_em     timestamptz,   -- tocou em "Abrir o portão"
  encerrado_em timestamptz,   -- link desativado (usado ou cancelado)
  criado_em    timestamptz not null default now()
);
alter table public.convites enable row level security;

create or replace function public.pode_convidar()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.ativo
                 and (p.papel = 'admin' or p.pode_gerar_visitante = true));
$$;

drop policy if exists "convites ver os meus" on public.convites;
create policy "convites ver os meus" on public.convites for select to authenticated
  using (public.pode_convidar() and (criado_por = auth.uid() or public.is_admin()));
drop policy if exists "convites criar" on public.convites;
create policy "convites criar" on public.convites for insert to authenticated
  with check (public.pode_convidar() and criado_por = auth.uid());
drop policy if exists "convites cancelar" on public.convites;
create policy "convites cancelar" on public.convites for update to authenticated
  using (public.pode_convidar() and (criado_por = auth.uid() or public.is_admin()))
  with check (public.pode_convidar() and (criado_por = auth.uid() or public.is_admin()));

notify pgrst, 'reload schema';
