-- Tarefas: colaborador só edita/exclui o que ELE criou (administrador pode tudo).
-- Compras: tabela da "lista padrão" (modelo de compra).
-- Rodar UMA vez no Supabase > SQL Editor. Pode rodar de novo sem problema.

-- 1) Excluir tarefa: só administrador ou quem criou.
drop policy if exists "tarefas apagar so criador" on public.tarefas;
create policy "tarefas apagar so criador" on public.tarefas as restrictive
  for delete to authenticated using (public.is_admin() or criado_por_id = auth.uid());

-- 2) Editar tarefa de outra pessoa: bloqueado, EXCETO o que todo mundo pode fazer
--    no dia a dia (concluir, reabrir, foto da conclusão, trocar o responsável).
create or replace function public.tarefas_trava_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  livres text[] := array['status', 'concluida_em', 'foto_conclusao_url', 'concluida_por_id',
                         'estoque_aplicado', 'responsavel_id', 'atualizado_em', 'updated_at'];
begin
  -- auth.uid() nulo = funções do servidor (lembretes etc.)
  if auth.uid() is null or public.is_admin() or old.criado_por_id = auth.uid() then return new; end if;
  if (to_jsonb(new) - livres) is distinct from (to_jsonb(old) - livres) then
    raise exception 'Só quem criou a tarefa (ou um administrador) pode editá-la.';
  end if;
  return new;
end $$;
drop trigger if exists tarefas_trava_edicao on public.tarefas;
create trigger tarefas_trava_edicao before update on public.tarefas
  for each row execute function public.tarefas_trava_edicao();

-- 3) Itens de uma compra: só administrador ou quem criou a compra mexe.
do $$
declare op text;
begin
  foreach op in array array['insert', 'update', 'delete'] loop
    execute format('drop policy if exists "itens so criador %s" on public.compra_itens', op);
    execute format(
      'create policy "itens so criador %1$s" on public.compra_itens as restrictive for %1$s to authenticated %2$s',
      op,
      case op
        when 'insert' then 'with check (public.is_admin() or exists (select 1 from public.tarefas t where t.id = tarefa_id and t.criado_por_id = auth.uid()))'
        else 'using (public.is_admin() or exists (select 1 from public.tarefas t where t.id = tarefa_id and t.criado_por_id = auth.uid()))'
      end);
  end loop;
end $$;

-- 4) Lista padrão de compras. A equipe lê; só administrador altera.
do $$
declare tp text;
begin
  select format_type(atttypid, atttypmod) into tp
    from pg_attribute where attrelid = 'public.produtos'::regclass and attname = 'id';
  execute format('create table if not exists public.compra_padrao (
    produto_id %s primary key references public.produtos(id) on delete cascade,
    quantidade numeric not null check (quantidade > 0))', tp);
end $$;
alter table public.compra_padrao enable row level security;

drop policy if exists "compra_padrao ler" on public.compra_padrao;
create policy "compra_padrao ler" on public.compra_padrao
  for select to authenticated using (public.is_equipe());

drop policy if exists "compra_padrao alterar" on public.compra_padrao;
create policy "compra_padrao alterar" on public.compra_padrao
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
