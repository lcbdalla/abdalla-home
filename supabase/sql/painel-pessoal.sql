-- Painel pessoal do Controle: o administrador autoriza quem pode montar o próprio painel.
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.
-- (Os painéis em si ficam guardados no celular de cada pessoa; aqui é só a autorização.)
alter table public.perfis add column if not exists pode_personalizar boolean not null default false;
