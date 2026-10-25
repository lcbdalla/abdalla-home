-- QR do visitante na TV do Quarto Visita (opção A):
--  * ao gerar um acesso de visitante no app (caixinha "Mostrar na TV do Quarto Visita"), o link e o
--    nome do visitante vão para tv_qr (1 linha por TV; o último gerado substitui o anterior);
--  * a TV (usuário marcado com eh_tv) pede o link pelo controle-proxy (acao "qr_tv"), que só devolve
--    se o visitante ainda estiver ativo e no prazo. Ninguém mais lê esta tabela.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run (depois do convites.sql).
alter table public.perfis add column if not exists eh_tv boolean not null default false;

create table if not exists public.tv_qr (
  id            text primary key,           -- 'quarto_visita'
  visitante_id  uuid,
  nome          text,                       -- nome do visitante ("Bem-vindo, Maria")
  link          text,                       -- #v=… (credencial de visitante)
  atualizado_em timestamptz not null default now()
);
alter table public.tv_qr enable row level security;
-- Grava quem pode gerar visitante (admin ou "Pode gerar acesso de visitante"); só admin consulta.
drop policy if exists "tv_qr gravar" on public.tv_qr;
create policy "tv_qr gravar" on public.tv_qr for insert to authenticated with check (public.pode_convidar());
drop policy if exists "tv_qr atualizar" on public.tv_qr;
create policy "tv_qr atualizar" on public.tv_qr for update to authenticated using (public.pode_convidar()) with check (public.pode_convidar());
drop policy if exists "tv_qr ver" on public.tv_qr;
create policy "tv_qr ver" on public.tv_qr for select to authenticated using (public.is_admin() or public.pode_convidar());
notify pgrst, 'reload schema';
