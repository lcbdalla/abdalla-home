-- Abajures do Quarto Visitas no app:
--   Abajur Esquerdo = light.quarto_visita_abajur_lado_esquerdo (luz criada em cima da tomada L1);
--   Abajur Direito  = light.quarto_visita_abajur_esquerdo (plug Tasmota; o entity_id diz "esquerdo",
--                     mas é o da DIREITA).
-- Troca o cartão antigo da tomada (switch.tomada_abajur_visitas_l1) pela luz nova, se ele existir.
-- Rodar no Supabase > SQL Editor > New query > colar > Run. Pode rodar de novo.
update public.controle_equipamentos set entity_id = 'light.quarto_visita_abajur_lado_esquerdo'
where entity_id = 'switch.tomada_abajur_visitas_l1'
  and not exists (select 1 from public.controle_equipamentos where entity_id = 'light.quarto_visita_abajur_lado_esquerdo');
delete from public.controle_equipamentos where entity_id = 'switch.tomada_abajur_visitas_l1';

insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
select a.id, v.entidade, v.nome, 'interruptor',
       coalesce((select max(q.ordem) + 1 from public.controle_equipamentos q where q.ambiente_id = a.id), 0) + v.k
from (values
  ('light.quarto_visita_abajur_lado_esquerdo', 'Abajur Esquerdo', 0),
  ('light.quarto_visita_abajur_esquerdo',      'Abajur Direito',  1)
) as v(entidade, nome, k)
join lateral (
  select id from public.ambientes
  where translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%visita%'
  order by (lower(nome) like '%banheiro%'), ordem limit 1
) a on true
on conflict (entity_id) do update set nome = excluded.nome;

select a.nome as ambiente, e.nome as aparelho, e.entity_id
from public.controle_equipamentos e join public.ambientes a on a.id = e.ambiente_id
where e.entity_id like 'light.quarto_visita_abajur%' order by e.nome;
