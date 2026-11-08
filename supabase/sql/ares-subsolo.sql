-- Os 6 ares Midea novos do Subsolo (midea_ac_lan) no Controle da Casa.
-- Cada ar vai para o cômodo DO SUBSOLO com o nome parecido (Pescaria, Bar, Estande, Lareira, Hall, Escritório);
-- se não houver, vai para o primeiro cômodo do pavimento Subsolo.
-- Rodar no Supabase > SQL Editor > New query > colar > Run. Pode rodar de novo sem duplicar.
insert into public.controle_equipamentos (ambiente_id, entity_id, nome, tipo, ordem)
select a.id, v.entidade, v.nome, 'ar',
       coalesce((select max(q.ordem) + 1 from public.controle_equipamentos q where q.ambiente_id = a.id), 0) + v.k
from (values
  ('climate.150633096196295_climate', 'Ar Pescaria',        '%pescaria%', 0),
  ('climate.151732607838797_climate', 'Ar Bar',             '%bar%',      1),
  ('climate.151732607838801_climate', 'Ar Estande de Tiro', '%estande%',  2),
  ('climate.150633096214609_climate', 'Ar Lareira',         '%lareira%',  3),
  ('climate.150633096230025_climate', 'Ar Hall de Entrada', '%hall%',     4),
  ('climate.150633096214638_climate', 'Ar Escritório',      '%escritorio%', 5)
) as v(entidade, nome, padrao, k)
join lateral (
  select am.id from public.ambientes am
  left join public.pavimentos pv on pv.id = am.pavimento_id
  -- só cômodos do Subsolo (o "Hall de Entrada" do Térreo não conta)
  where translate(lower(coalesce(pv.nome, '') || ' ' || am.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%subsolo%'
  order by (translate(lower(am.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like v.padrao) desc, am.ordem
  limit 1
) a on true
on conflict (entity_id) do update set ambiente_id = excluded.ambiente_id, nome = excluded.nome, tipo = excluded.tipo;

select a.nome as ambiente, e.nome as aparelho, e.entity_id
from public.controle_equipamentos e join public.ambientes a on a.id = e.ambiente_id
where e.entity_id in ('climate.150633096196295_climate', 'climate.151732607838797_climate', 'climate.151732607838801_climate', 'climate.150633096214609_climate', 'climate.150633096230025_climate', 'climate.150633096214638_climate')
order by a.nome, e.nome;
