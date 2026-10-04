-- Equipe: chave "Pode gerar acesso de visitante" (para quem não é administrador).
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.
alter table public.perfis add column if not exists pode_gerar_visitante boolean not null default false;
