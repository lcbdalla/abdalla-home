-- Cadastra o cartão "Abajur Esquerdo" (plug Tasmota: light.quarto_visita_abajur_esquerdo) no Quarto Visitas.
-- Rodar UMA vez no Supabase > SQL Editor > New query > colar > Run. Pode rodar de novo sem duplicar.
with base as (
  select a.id, a.nome, a.ordem,
         translate(lower(a.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as n
  from public.ambientes a
),
comodo as (
  select id from base where n like '%visita%' order by (n like '%banheiro%'), ordem limit 1
),
ins as (
  insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
  select c.id, 'light.quarto_visita_abajur_esquerdo', 'Abajur Esquerdo', 'interruptor',
         coalesce((select max(e.ordem) + 1 from public.controle_equipamentos e where e.ambiente_id = c.id), 0)
  from comodo c
  on conflict (entity_id) do update set ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo
  returning entity_id, ambiente_id, (xmax = 0) as novo
)
select case
  when not exists (select 1 from comodo)
    then 'Quarto Visitas não encontrado. Ambientes que existem: ' || (select string_agg(nome, ', ' order by nome) from base)
  when (select novo from ins) then 'Abajur Esquerdo cadastrado em: ' || (select b.nome from base b join ins i on i.ambiente_id = b.id)
  else 'Abajur Esquerdo já existia (atualizado) em: ' || (select b.nome from base b join ins i on i.ambiente_id = b.id)
end as resultado;
