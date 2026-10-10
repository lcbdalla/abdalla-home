-- Liberar só alguns APARELHOS (não o cômodo inteiro) para cada pessoa (não administrador).
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run (depois do colaborador-ambientes.sql).
-- Regra: sem nada escolhido = tudo. Com escolha: vale o cômodo inteiro (ambientes_controle) e/ou
-- aparelhos soltos (equipamentos_controle, ids da tabela controle_equipamentos).
alter table public.perfis add column if not exists ambientes_controle uuid[];
alter table public.perfis add column if not exists equipamentos_controle uuid[];

create or replace function public.ambientes_liberados()
returns uuid[] language sql stable security definer set search_path = public as $$
  select p.ambientes_controle from public.perfis p where p.id = auth.uid() and p.papel <> 'admin';
$$;
create or replace function public.equipamentos_liberados()
returns uuid[] language sql stable security definer set search_path = public as $$
  select p.equipamentos_controle from public.perfis p where p.id = auth.uid() and p.papel <> 'admin';
$$;
-- A pessoa tem alguma restrição (administrador nunca tem).
create or replace function public.controle_restrito()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.ambientes_controle is not null or p.equipamentos_controle is not null
                   from public.perfis p where p.id = auth.uid() and p.papel <> 'admin'), false);
$$;
-- O cômodo tem algum aparelho liberado para a pessoa (sem passar pelas regras da tabela, para não dar laço).
create or replace function public.ambiente_tem_liberado(amb uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.controle_equipamentos q where q.ambiente_id = amb and q.id = any (coalesce(public.equipamentos_liberados(), '{}')));
$$;

drop policy if exists "ambientes so os liberados da pessoa" on public.ambientes;
create policy "ambientes so os liberados da pessoa" on public.ambientes as restrictive
  for select to authenticated using (
    not public.controle_restrito()
    or id = any (coalesce(public.ambientes_liberados(), '{}'))
    or public.ambiente_tem_liberado(id)
  );

drop policy if exists "equipamentos so os liberados da pessoa" on public.controle_equipamentos;
create policy "equipamentos so os liberados da pessoa" on public.controle_equipamentos as restrictive
  for select to authenticated using (
    not public.controle_restrito()
    or ambiente_id = any (coalesce(public.ambientes_liberados(), '{}'))
    or id = any (coalesce(public.equipamentos_liberados(), '{}'))
  );

notify pgrst, 'reload schema';
