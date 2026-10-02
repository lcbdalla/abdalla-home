-- Cadastra o cartão "Alexa" (toca/pausa o Spotify na Alexa do quarto) no cômodo Quarto Leo e Pri.
-- Pode rodar de novo: se já existir, só confirma o cômodo, o nome e o tipo.
with comodo as (
  select a.id from public.ambientes a
  where lower(a.nome) = 'quarto leo e pri'
  order by a.ordem limit 1
),
ins as (
  insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
  select c.id, 'alexa.quarto_leo_e_pri', 'Alexa', 'alexa',
         coalesce((select max(e.ordem) + 1 from public.controle_equipamentos e where e.ambiente_id = c.id), 0)
  from comodo c
  on conflict (entity_id) do update set ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo
  returning entity_id, (xmax = 0) as novo
)
select case when not exists (select 1 from comodo) then 'cômodo "Quarto Leo e Pri" não encontrado'
            when (select novo from ins) then 'cartão Alexa cadastrado'
            else 'cartão Alexa já existia (atualizado)' end as resultado;
