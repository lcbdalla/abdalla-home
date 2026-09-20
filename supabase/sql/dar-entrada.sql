-- Marca se uma compra deve dar entrada no estoque ao ser concluída.
-- Ligado por padrão (compras antigas continuam entrando no estoque).
-- Rodar uma vez no Supabase > SQL Editor.
alter table public.tarefas
  add column if not exists dar_entrada boolean not null default true;
