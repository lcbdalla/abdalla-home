-- Nomes personalizados dos botões de ação de cada aparelho do Controle
-- (ex.: persiana → Abrir/Parar/Fechar). Guardados como JSON.
-- Rodar uma vez no Supabase > SQL Editor.
alter table public.controle_equipamentos
  add column if not exists rotulos jsonb not null default '{}'::jsonb;
