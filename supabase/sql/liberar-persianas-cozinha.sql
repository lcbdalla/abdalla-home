-- Libera as persianas da Varanda (todas, 1 a 11), da Churrasqueira e da Sala TV para quem NÃO é
-- administrador e tem o ambiente Cozinha liberado em Equipe > "O que pode controlar".
-- Soma aos aparelhos que a pessoa já tinha (não tira nada). Pode rodar de novo sem duplicar.
-- Rodar no Supabase > SQL Editor > New query > colar > Run. O resultado mostra quem recebeu.
with coz as (
  select id from public.ambientes
  where translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like '%cozinha%'
  order by ordem limit 1
),
alvo as (
  select array_agg(id) as ids from public.controle_equipamentos
  where entity_id like 'cover.persiana_varanda%' or entity_id like 'cover.persiana_salatv%' or entity_id = 'cover.persiana_churrasqueira'
),
upd as (
  update public.perfis p
  set equipamentos_controle = (select array_agg(distinct x) from unnest(coalesce(p.equipamentos_controle, '{}') || (select ids from alvo)) as x)
  where p.papel <> 'admin' and p.ativo and p.pode_controle
    and p.ambientes_controle is not null and p.ambientes_controle @> array[(select id from coz)]
  returning p.nome
)
select case
  when not exists (select 1 from coz) then 'ambiente Cozinha não encontrado'
  when (select ids from alvo) is null then 'nenhuma persiana encontrada'
  else coalesce('liberado para: ' || (select string_agg(nome, ', ' order by nome) from upd), 'ninguém com a Cozinha liberada (nada mudou)')
    || ' · ' || (select cardinality(ids) from alvo) || ' persianas'
end as resultado;
