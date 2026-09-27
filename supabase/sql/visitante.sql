-- Validade do acesso de visitante (perfil temporário). Rodar uma vez no SQL Editor.
alter table public.perfis
  add column if not exists expira_em timestamptz;
