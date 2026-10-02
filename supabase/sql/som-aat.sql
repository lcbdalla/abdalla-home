-- Cadastra o som (zonas do amplificador AAT PMR7) dentro de cada cômodo do Controle.
-- Acha o cômodo pelo nome: primeiro o nome exato, senão o que começa igual (o mais curto).
-- A Churrasqueira (zona 1) fica junto da Varanda e o Ofurô (zona 6) dentro da Piscina.
-- Pode rodar de novo: se a zona já estiver cadastrada, ela é movida para o cômodo certo.
-- No fim mostra uma tabela com o resultado de cada zona.
with mapa(ord, entity_id, chave, nome) as (values
  (1, 'media_player.aat_pmr7_zona_1', 'varanda',       'Som Churrasqueira'),
  (2, 'media_player.aat_pmr7_zona_2', 'varanda',       'Som'),
  (3, 'media_player.aat_pmr7_zona_3', 'living',        'Som'),
  (4, 'media_player.aat_pmr7_zona_4', 'cozinha',       'Som'),
  (5, 'media_player.aat_pmr7_zona_5', 'piscina',       'Som'),
  (6, 'media_player.aat_pmr7_zona_6', 'piscina',       'Som Ofurô')
),
cand as (
  select m.entity_id, m.nome, a.id as ambiente_id, a.nome as ambiente,
         row_number() over (partition by m.entity_id order by (lower(a.nome) = m.chave) desc, length(a.nome)) as rn
  from mapa m
  join public.ambientes a on lower(a.nome) like m.chave || '%'
),
ins as (
  insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
  select c.ambiente_id, c.entity_id, c.nome, 'tv',
         coalesce((select max(e.ordem) + 1 from public.controle_equipamentos e where e.ambiente_id = c.ambiente_id), 0)
  from cand c
  where c.rn = 1
  on conflict (entity_id) do update set
    ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo,
    ordem = case when public.controle_equipamentos.ambiente_id <> excluded.ambiente_id then excluded.ordem else public.controle_equipamentos.ordem end
  returning entity_id, (xmax = 0) as novo
)
select m.ord as zona, m.nome, c.ambiente as comodo,
       case when c.ambiente is null then 'cômodo não encontrado'
            when i.novo then 'cadastrado'
            else 'atualizado' end as resultado
from mapa m
left join cand c on c.entity_id = m.entity_id and c.rn = 1
left join ins i on i.entity_id = m.entity_id
order by m.ord;
