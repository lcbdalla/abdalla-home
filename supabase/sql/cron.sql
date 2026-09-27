-- Despertador: chama a função de lembretes de minuto em minuto.
-- Rodar uma vez no Supabase > SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Se já existir um agendamento com esse nome, remove antes de recriar.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'lembretes-abdalla') then
    perform cron.unschedule('lembretes-abdalla');
  end if;
end $$;

select cron.schedule(
  'lembretes-abdalla',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hsfnreiryoyenhablydm.supabase.co/functions/v1/dynamic-function',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_Zl9s3ipuB0uvns9e-a4QQw_Q-mw9qK5'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);
