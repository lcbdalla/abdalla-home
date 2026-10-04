-- Cadastra o cartão "Alexa" (Quarto e Banheiro pelo Spotify) no quarto da Lele e Lala.
-- Acha o cômodo pelo nome sem acento e sem diferença de maiúsculas ("Lelê", "Lalá"...),
-- preferindo o que não é banheiro. Se não achar, mostra a lista de cômodos para conferir.
-- Pode rodar de novo: se já existir, só confirma o cômodo, o nome e o tipo.
with base as (
  select a.id, a.nome, a.ordem,
         translate(lower(a.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as n
  from public.ambientes a
),
comodo as (
  select id from base
  where (n like '%lele%' or n like '%lala%')
  order by (n like '%banheiro%'), (n like 'quarto%') desc, ordem
  limit 1
),
ins as (
  insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
  select c.id, 'alexa.quarto_lele_e_lala', 'Alexa', 'alexa',
         coalesce((select max(e.ordem) + 1 from public.controle_equipamentos e where e.ambiente_id = c.id), 0)
  from comodo c
  on conflict (entity_id) do update set ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo
  returning entity_id, ambiente_id, (xmax = 0) as novo
)
select case
  when not exists (select 1 from comodo)
    then 'cômodo não encontrado. Cômodos que existem: ' || (select string_agg(nome, ', ' order by nome) from base)
  when (select novo from ins) then 'cartão Alexa cadastrado em: ' || (select b.nome from base b join ins i on i.ambiente_id = b.id)
  else 'cartão Alexa já existia (atualizado) em: ' || (select b.nome from base b join ins i on i.ambiente_id = b.id)
end as resultado;
