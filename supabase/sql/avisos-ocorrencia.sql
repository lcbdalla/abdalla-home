-- Avisos com "ocorrência" (ex.: caixa d'água abaixo de 55%): cada pessoa fecha o SEU aviso, e
-- quem fechou não vê de novo enquanto for a mesma ocorrência. Uma ocorrência nova só começa
-- quando o problema se resolve (ex.: caixa acima de 60%) e volta a acontecer.
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.

create table if not exists public.avisos_ocorrencia (
  tipo       text primary key,                       -- ex.: 'caixa_agua'
  ocorrencia uuid not null default gen_random_uuid(),
  ativo      boolean not null default true,
  desde      timestamptz not null default now()
);
create table if not exists public.avisos_dispensa (
  ocorrencia uuid not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  em         timestamptz not null default now(),
  primary key (ocorrencia, user_id)
);
alter table public.avisos_ocorrencia enable row level security;
alter table public.avisos_dispensa enable row level security;
drop policy if exists "avisos_ocorrencia leitura" on public.avisos_ocorrencia;
create policy "avisos_ocorrencia leitura" on public.avisos_ocorrencia for select to authenticated using (public.is_ativo());
drop policy if exists "avisos_dispensa minhas" on public.avisos_dispensa;
create policy "avisos_dispensa minhas" on public.avisos_dispensa for all to authenticated
  using (user_id = auth.uid() and public.is_ativo()) with check (user_id = auth.uid() and public.is_ativo());

-- Abre (ou continua) a ocorrência do tipo e devolve o id dela.
create or replace function public.abrir_ocorrencia(p_tipo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_ativo() then raise exception 'Sem acesso.'; end if;
  insert into public.avisos_ocorrencia (tipo) values (p_tipo)
  on conflict (tipo) do update set
    ocorrencia = case when avisos_ocorrencia.ativo then avisos_ocorrencia.ocorrencia else gen_random_uuid() end,
    desde      = case when avisos_ocorrencia.ativo then avisos_ocorrencia.desde else now() end,
    ativo      = true
  returning ocorrencia into v;
  return v;
end $$;

-- Encerra a ocorrência (o problema se resolveu); a próxima vez abre uma nova.
create or replace function public.fechar_ocorrencia(p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_ativo() then raise exception 'Sem acesso.'; end if;
  update public.avisos_ocorrencia set ativo = false where tipo = p_tipo and ativo;
end $$;

revoke all on function public.abrir_ocorrencia(text) from public, anon;
revoke all on function public.fechar_ocorrencia(text) from public, anon;
grant execute on function public.abrir_ocorrencia(text) to authenticated;
grant execute on function public.fechar_ocorrencia(text) to authenticated;
notify pgrst, 'reload schema';
