-- Equipe: ver o e-mail de cada pessoa e cadastrar uma senha nova (só administrador).
-- Rodar uma vez no Supabase: SQL Editor > New query > colar > Run.
--
-- O e-mail e a senha ficam no Auth (auth.users), que o app não lê direto. Estas duas funções
-- rodam com permissão do banco, mas só respondem para quem é administrador ativo (is_admin()).

-- 1) E-mail de cada pessoa (para mostrar no cartão da Equipe).
create or replace function public.emails_equipe()
returns table (id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text from auth.users u where public.is_admin();
$$;
revoke all on function public.emails_equipe() from public, anon;
grant execute on function public.emails_equipe() to authenticated;

-- 2) Senha nova para uma pessoa (o administrador escolhe ou usa a sugerida pelo app).
create or replace function public.definir_senha(p_user uuid, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
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
