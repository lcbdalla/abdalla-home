-- Libera os 4 papéis do app na tabela perfis (antes só aceitava admin/colaborador,
-- e o QR Code de visitante falhava com "perfis_papel_check").
-- Rodar UMA vez no Supabase > SQL Editor. Pode rodar de novo sem problema.
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check
  check (papel in ('admin', 'colaborador', 'crianca', 'visitante'));

-- Desativa as contas "Visitante" que ficaram pela metade (criadas como colaborador
-- quando o QR Code falhou).
update public.perfis set ativo = false
  where nome = 'Visitante' and papel = 'colaborador' and expira_em is null;
