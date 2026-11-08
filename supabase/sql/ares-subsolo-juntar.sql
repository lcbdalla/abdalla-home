-- Move os 5 ares do Subsolo (Bar, Escritório, Estande de Tiro, Hall de Entrada, Lareira) para o
-- MESMO cômodo do Ar Pescaria (onde também está a Lareira).
-- Rodar no Supabase > SQL Editor > New query > colar > Run.
update public.controle_equipamentos
set ambiente_id = (select ambiente_id from public.controle_equipamentos where entity_id = 'climate.150633096196295_climate')
where entity_id in ('climate.151732607838797_climate', 'climate.150633096214638_climate', 'climate.151732607838801_climate',
                    'climate.150633096230025_climate', 'climate.150633096214609_climate');

select a.nome as ambiente, e.nome as aparelho
from public.controle_equipamentos e join public.ambientes a on a.id = e.ambiente_id
where e.entity_id like 'climate.15%' and a.id = (select ambiente_id from public.controle_equipamentos where entity_id = 'climate.150633096196295_climate')
order by e.nome;
