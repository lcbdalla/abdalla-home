-- Cadastra o cartão "TV Varanda" (Samsung, media_player.tv_varanda) no ambiente Varanda.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run. Pode rodar de novo sem duplicar.
with base as (
  select a.id, a.nome, a.ordem,
         translate(lower(a.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as n
  from public.ambientes a
),
comodo as (
  select id from base where n like '%varanda%' order by (n = 'varanda') desc, ordem limit 1
),
ins as (
  insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
  select c.id, 'media_player.tv_varanda', 'TV Varanda', 'tv',
         coalesce((select max(e.ordem) + 1 from public.controle_equipamentos e where e.ambiente_id = c.id), 0)
  from comodo c
  on conflict (entity_id) do update set ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo
  returning entity_id, ambiente_id, (xmax = 0) as novo
)
select case
  when not exists (select 1 from comodo)
    then 'ambiente Varanda não encontrado. Ambientes que existem: ' || (select string_agg(nome, ', ' order by nome) from base)
  when (select novo from ins) then 'TV Varanda cadastrada em: ' || (select b.nome from base b join ins i on i.ambiente_id = b.id)
  else 'TV Varanda já existia (atualizada) em: ' || (select b.nome from base b join ins i on i.ambiente_id = b.id)
end as resultado;
