-- Endurecimento de segurança do Abdalla Home (auditoria de set/2026).
-- Rodar UMA vez no Supabase > SQL Editor, DEPOIS de publicar a função "controle-proxy".
-- Tudo aqui só APERTA regras (políticas "restritivas", que somam ao que já existe);
-- nada abre acesso novo. Pode rodar de novo sem problema.

-- 0) Garante a coluna de validade do visitante (caso visitante.sql não tenha rodado).
alter table public.perfis add column if not exists expira_em timestamptz;

-- 1) Funções de apoio --------------------------------------------------------
-- Equipe = administrador ou colaborador ativo (quem usa o app de tarefas).
create or replace function public.is_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.papel in ('admin', 'colaborador')
  );
$$;

-- Controle: passa a respeitar também a validade do visitante.
create or replace function public.pode_ver_controle()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and (p.pode_controle or p.pode_gerir_controle)
      and (p.expira_em is null or p.expira_em > now())
  );
$$;

create or replace function public.is_gestor_controle()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.pode_gerir_controle
      and (p.expira_em is null or p.expira_em > now())
  );
$$;

-- 2) Token do Home Assistant: só a família (administrador com controle) lê.
--    Colaborador, criança e visitante usam o intermediário "controle-proxy".
drop policy if exists "ha_config leitura autorizada" on public.ha_config;
create policy "ha_config leitura autorizada" on public.ha_config
  for select to authenticated
  using (exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.papel = 'admin'
      and (p.pode_controle or p.pode_gerir_controle)
      and (p.expira_em is null or p.expira_em > now())
  ));

-- 3) App de tarefas: só a equipe. Criança e visitante (que só usam o Controle)
--    não conseguem ler nem alterar tarefas, compras, estoque, produtos...
do $$
declare t text;
begin
  foreach t in array array['tarefas', 'compra_itens', 'conclusoes', 'estoque', 'movimentacoes', 'produtos', 'push_subs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "somente equipe" on public.%I', t);
      execute format('create policy "somente equipe" on public.%I as restrictive for all to authenticated using (public.is_equipe()) with check (public.is_equipe())', t);
    end if;
  end loop;
end $$;

-- 4) Perfis: cada um lê o próprio; a equipe lê todos; só administrador cria,
--    altera ou apaga (impede alguém de se promover a administrador sozinho).
drop policy if exists "perfis leitura restrita" on public.perfis;
create policy "perfis leitura restrita" on public.perfis as restrictive
  for select to authenticated using (public.is_equipe() or id = auth.uid());

drop policy if exists "perfis alterar so admin" on public.perfis;
create policy "perfis alterar so admin" on public.perfis as restrictive
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "perfis criar so admin" on public.perfis;
create policy "perfis criar so admin" on public.perfis as restrictive
  for insert to authenticated with check (public.is_admin());

drop policy if exists "perfis apagar so admin" on public.perfis;
create policy "perfis apagar so admin" on public.perfis as restrictive
  for delete to authenticated using (public.is_admin());

-- 5) Fotos: só a equipe envia.
drop policy if exists "fotos upload" on storage.objects;
create policy "fotos upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_equipe());

-- 6) Estoque sem perda de atualização: o movimento é feito de uma vez só no
--    banco (trava a linha), então dois celulares ao mesmo tempo não se apagam.
create or replace function public.mover_estoque(
  p_produto public.estoque.produto_id%type,
  p_tipo    text,
  p_qtd     numeric,
  p_origem  text default 'manual'
)
returns numeric language plpgsql security invoker set search_path = public as $$
declare v_ant numeric; v_novo numeric;
begin
  if p_qtd is null or p_qtd <= 0 then return null; end if;
  if p_tipo not in ('entrada', 'saida') then raise exception 'tipo inválido: %', p_tipo; end if;
  insert into public.estoque (produto_id, quantidade) values (p_produto, 0)
    on conflict (produto_id) do nothing;
  select quantidade into v_ant from public.estoque where produto_id = p_produto for update;
  v_ant  := coalesce(v_ant, 0);
  v_novo := case when p_tipo = 'saida' then greatest(0, v_ant - p_qtd) else v_ant + p_qtd end;
  update public.estoque set quantidade = v_novo where produto_id = p_produto;
  if v_novo <> v_ant then
    insert into public.movimentacoes (produto_id, tipo, qtd, origem, user_id)
    values (p_produto, p_tipo, abs(v_novo - v_ant), coalesce(p_origem, 'manual'), auth.uid());
  end if;
  return v_novo;
end $$;
