-- Acesso temporário às câmeras para o técnico (manutenção): link com prazo, criado pelo admin no app
-- (Câmeras > "Acesso para técnico"). O técnico não tem login: a função pública (dynamic-worker)
-- confere o código e o prazo a cada imagem pedida. Só administradores leem/criam/revogam.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run.
create table if not exists public.acessos_cameras (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  nome        text,                                   -- ex.: "Técnico João"
  ate         timestamptz not null,
  criado_por  uuid default auth.uid(),
  criado_em   timestamptz not null default now(),
  revogado_em timestamptz
);
alter table public.acessos_cameras enable row level security;
drop policy if exists "acessos_cameras so admin" on public.acessos_cameras;
create policy "acessos_cameras so admin" on public.acessos_cameras for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
notify pgrst, 'reload schema';
