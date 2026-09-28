-- Chave "Menu ⋮ do Controle" por pessoa (tela Equipe). Quem tem desligado não vê
-- os 3 pontinhos no Controle da Casa (configuração, tema, instalar, sair).
-- Rodar UMA vez no Supabase > SQL Editor. Pode rodar de novo sem problema.
alter table public.perfis add column if not exists pode_menu_controle boolean not null default false;

-- Já liga para quem configura o controle hoje (a família), para ninguém perder o acesso.
update public.perfis set pode_menu_controle = true where pode_gerir_controle;

select nome, papel, pode_controle, pode_gerir_controle, pode_menu_controle from public.perfis where ativo order by nome;
