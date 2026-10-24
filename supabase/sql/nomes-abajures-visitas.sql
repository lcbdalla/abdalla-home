-- Nomes certos dos abajures do Quarto Visitas no app (o entity_id do plug Tasmota diz "esquerdo",
-- mas é o abajur da DIREITA). Rodar no Supabase > SQL Editor > New query > colar > Run.
update public.controle_equipamentos set nome = 'Abajur Esquerdo' where entity_id = 'switch.tomada_abajur_visitas_l1';
update public.controle_equipamentos set nome = 'Abajur Direito'  where entity_id = 'light.quarto_visita_abajur_esquerdo';
select nome, entity_id from public.controle_equipamentos
where entity_id in ('switch.tomada_abajur_visitas_l1', 'light.quarto_visita_abajur_esquerdo');
