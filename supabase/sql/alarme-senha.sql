-- Senha das centrais de alarme guardada SÓ no servidor (o app nunca lê).
-- Quem arma/desarma pelo app manda o pedido ao intermediário (controle-proxy), que busca a senha
-- aqui com a chave secreta e repassa à central. Rodar uma vez no Supabase: SQL Editor > New query > Run.
create table if not exists public.alarme_senha (
  painel     text primary key,           -- alarm_control_panel.* da central
  senha      text not null,
  atualizado timestamptz not null default now()
);
alter table public.alarme_senha enable row level security;
-- Sem nenhuma política: ninguém do app lê nem grava direto. Só as funções abaixo e o servidor.

-- O administrador cadastra/troca a senha de uma central (o app só escreve, nunca lê).
create or replace function public.definir_senha_alarme(p_painel text, p_senha text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Só o administrador pode cadastrar a senha do alarme.'; end if;
  if p_painel !~ '^alarm_control_panel\.' then raise exception 'Central inválida.'; end if;
  if p_senha is null or length(trim(p_senha)) = 0 then
    delete from public.alarme_senha where painel = p_painel;  -- senha vazia = apagar
  else
    insert into public.alarme_senha (painel, senha) values (p_painel, trim(p_senha))
    on conflict (painel) do update set senha = excluded.senha, atualizado = now();
  end if;
end $$;
revoke all on function public.definir_senha_alarme(text, text) from public, anon;
grant execute on function public.definir_senha_alarme(text, text) to authenticated;

-- Quais centrais já têm senha salva (só o nome da central, nunca a senha).
create or replace function public.alarmes_com_senha()
returns setof text language sql security definer set search_path = public as $$
  select painel from public.alarme_senha where public.is_ativo();
$$;
revoke all on function public.alarmes_com_senha() from public, anon;
grant execute on function public.alarmes_com_senha() to authenticated;
