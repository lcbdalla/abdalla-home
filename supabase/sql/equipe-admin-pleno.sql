-- Administrador limitado ("Pode mexer na equipe" desligado) passa a ser barrado também no BANCO,
-- não só na tela: não troca senha de ninguém, não vê os e-mails e não altera/cria/apaga perfis
-- (nem o próprio, para não religar a chave sozinho). Gerar visitante continua funcionando.
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run. Pode rodar de novo sem problema.

alter table public.perfis add column if not exists pode_gerir_equipe boolean not null default true;

-- Administrador "pleno": ativo e com "Pode mexer na equipe" ligado.
create or replace function public.is_admin_pleno()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo and p.papel = 'admin' and coalesce(p.pode_gerir_equipe, true)
  );
$$;
revoke all on function public.is_admin_pleno() from public, anon;
grant execute on function public.is_admin_pleno() to authenticated;

-- Perfis: só o administrador pleno cria, altera ou apaga.
drop policy if exists "perfis alterar so admin" on public.perfis;
create policy "perfis alterar so admin" on public.perfis as restrictive
  for update to authenticated using (public.is_admin_pleno()) with check (public.is_admin_pleno());

drop policy if exists "perfis criar so admin" on public.perfis;
create policy "perfis criar so admin" on public.perfis as restrictive
  for insert to authenticated with check (public.is_admin_pleno());

drop policy if exists "perfis apagar so admin" on public.perfis;
create policy "perfis apagar so admin" on public.perfis as restrictive
  for delete to authenticated using (public.is_admin_pleno());

-- E-mails da equipe: só o administrador pleno.
create or replace function public.emails_equipe()
returns table (id uuid, email text)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email::text from auth.users u where public.is_admin_pleno();
$$;
revoke all on function public.emails_equipe() from public, anon;
grant execute on function public.emails_equipe() to authenticated;

-- Senha nova: só o administrador pleno.
create or replace function public.definir_senha(p_user uuid, p_senha text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin_pleno() then
    raise exception 'Só o administrador pode trocar senhas.';
  end if;
  if p_senha is null or length(p_senha) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;
  if not found then
    raise exception 'Pessoa não encontrada.';
  end if;
end;
$$;
revoke all on function public.definir_senha(uuid, text) from public, anon;
grant execute on function public.definir_senha(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Conferência: quem é administrador e se mexe na equipe.
select nome, papel, pode_gerir_equipe from public.perfis where ativo and papel = 'admin' order by nome;
