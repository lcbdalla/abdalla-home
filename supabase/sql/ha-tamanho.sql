-- Tamanho do card de cada aparelho no Controle: 'p' (pequeno, 1 coluna) ou 'g' (grande, 2 colunas).
-- Rodar uma vez no Supabase > SQL Editor.
alter table public.controle_equipamentos
  add column if not exists tamanho text not null default 'p';
