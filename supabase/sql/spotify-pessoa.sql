-- Spotify de cada pessoa: qual conta do Spotify (no Home Assistant) é de cada pessoa do app.
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.
alter table public.perfis add column if not exists spotify_entity text;
