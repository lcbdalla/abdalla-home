-- Permite várias fotos por tarefa/compra (antes era só uma em imagem_url).
-- A coluna imagem_url continua existindo e guarda a primeira foto (retrocompat).
-- Rodar uma vez no Supabase > SQL Editor.
alter table public.tarefas
  add column if not exists imagens text[] not null default '{}';
