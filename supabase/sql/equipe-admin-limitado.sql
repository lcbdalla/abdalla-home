-- Equipe: administrador que só gera acesso de visitante (sem mexer nas pessoas).
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.
alter table public.perfis add column if not exists pode_gerir_equipe boolean not null default true;
