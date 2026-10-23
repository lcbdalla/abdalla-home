-- QR do visitante mostrado na TV (tela de boas-vindas do Quarto Visita).
-- O dono gera/troca o QR na Equipe; a TV pede o link atual à função pública (dynamic-worker,
-- acao "tv_acesso") mandando a sua chave secreta. Só administradores leem/alteram esta tabela.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run.
create table if not exists public.tv_acessos (
  id            text primary key,          -- ex.: 'quarto_visita'
  nome          text not null,
  chave         text not null,             -- segredo da TV (fica só na TV e aqui)
  link          text,                      -- link de visitante que vale agora (null = desligado)
  perfil_id     uuid,                      -- conta de visitante por trás do link
  ate           timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.tv_acessos enable row level security;
drop policy if exists "tv_acessos so admin" on public.tv_acessos;
create policy "tv_acessos so admin" on public.tv_acessos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
notify pgrst, 'reload schema';
