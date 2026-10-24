-- Aparelhos novos do HA (24/10/2026) no Controle da Casa:
--   Quarto Visitas: Cortina (motor Tuya), Persiana (RF) e Abajur Direito (plug Tasmota);
--   Sala TV: Abajur pelo light.sala_de_tv_abajur (troca o switch.tomada_salatv_l1, se existir);
--   sai do app: os 6 ares do subsolo removidos do HA (serão recadastrados pelo MSmartHome).
-- Rodar no Supabase > SQL Editor > New query > colar > Run. Pode rodar de novo sem duplicar.

-- Abajur da Sala TV: o cartão antigo (switch da tomada) passa a usar a luz nova.
update public.controle_equipamentos set entity_id = 'light.sala_de_tv_abajur'
where entity_id = 'switch.tomada_salatv_l1'
  and not exists (select 1 from public.controle_equipamentos where entity_id = 'light.sala_de_tv_abajur');
delete from public.controle_equipamentos where entity_id = 'switch.tomada_salatv_l1';

insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
select a.id, v.entidade, v.nome, v.tipo,
       coalesce((select max(q.ordem) + 1 from public.controle_equipamentos q where q.ambiente_id = a.id), 0) + v.k
from (values
  ('cover.cortina_visitas',               'Cortina',         'persiana',    '%visita%',  0),
  ('cover.persiana_visitas',              'Persiana',        'persiana',    '%visita%',  1),
  ('light.quarto_visita_abajur_esquerdo', 'Abajur Direito', 'interruptor', '%visita%',  2),
  ('light.sala_de_tv_abajur',             'Abajur',          'interruptor', '%sala%tv%', 0)
) as v(entidade, nome, tipo, padrao, k)
join lateral (
  select id from public.ambientes
  where translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like v.padrao
  order by (lower(nome) like '%banheiro%'), ordem limit 1
) a on true
on conflict (entity_id) do update set ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo;

delete from public.controle_equipamentos
where entity_id in ('climate.ar_bar', 'climate.ar_escritorio', 'climate.ar_estande', 'climate.ar_lareira', 'climate.ar_pescaria', 'climate.ar_quarto_subsolo');

select a.nome as ambiente, e.nome as aparelho, e.entity_id
from public.controle_equipamentos e join public.ambientes a on a.id = e.ambiente_id
where e.entity_id in ('cover.cortina_visitas', 'cover.persiana_visitas', 'light.quarto_visita_abajur_esquerdo', 'light.sala_de_tv_abajur')
order by a.nome, e.nome;
