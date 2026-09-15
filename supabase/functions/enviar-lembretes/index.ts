// Edge Function: enviar-lembretes
// -----------------------------------------------------------------------------
// Roda de minuto em minuto (chamada pelo agendador pg_cron do banco).
// Acha as tarefas que começam em 15 minutos e envia um web push para o
// responsável, mesmo com o app fechado.
//
// Fuso: Tocantins é UTC-3 o ano todo (sem horário de verão), então basta
// tirar 3h do relógio UTC e ler os campos como se fossem locais.
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   VAPID_PRIVATE_KEY  -> a chave privada gerada junto com a pública do app.
// (SUPABASE_URL e a chave secreta do banco já existem no ambiente.)
//
// Deploy: painel do Supabase > Edge Functions > colar este arquivo.
// Deixe "Verify JWT" DESLIGADO (quem chama é o agendador do banco).
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC = "BHJJ9Z4wQeZHuWbocTCz1jtm30KDpAEhifbV0oCC4FIdpZMw4JY_2x9TEUjkeJZhSLhVt975qSeT7l3cs_t_RXw";
const OFFSET_H = 3; // Tocantins = UTC-3

const weekIndex = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d, 12) - Date.UTC(1970, 0, 5, 12)) / 604800000);
};

// Mesma regra do app: a tarefa acontece nesta data?
function aplicaHoje(t: any, iso: string, dow: number): boolean {
  if (t.tipo === "unica") return t.data === iso;
  if (t.data_inicio && iso < t.data_inicio) return false;
  if (t.freq === "diaria") return true;
  if (t.freq === "semanal") {
    if (!(t.dias || []).includes(dow)) return false;
    const n = Math.max(1, parseInt(t.intervalo_semanas) || 1);
    if (n === 1) return true;
    const base = t.data_inicio || iso;
    return ((weekIndex(iso) - weekIndex(base)) % n) === 0;
  }
  return false;
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try { serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || serviceKey; } catch { /* legado */ }
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!priv) return new Response(JSON.stringify({ error: "Falta o segredo VAPID_PRIVATE_KEY" }), { status: 500 });
  webpush.setVapidDetails("mailto:ranchoabdalla@gmail.com", VAPID_PUBLIC, priv);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Relógio local de Tocantins.
  const local = new Date(Date.now() - OFFSET_H * 3600000);
  const iso = local.toISOString().slice(0, 10);
  const dow = local.getUTCDay();
  const minutosAgora = local.getUTCHours() * 60 + local.getUTCMinutes();

  // Tarefas com horário marcado (compras não têm lembrete).
  const { data: tarefas, error } = await admin
    .from("tarefas")
    .select("id, titulo, tipo, freq, dias, intervalo_semanas, data, data_inicio, hora_inicio, status, responsavel_id")
    .not("hora_inicio", "is", null)
    .or("eh_compra.is.null,eh_compra.eq.false");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Vencem em 15 min e valem para hoje.
  const doDia = (tarefas || []).filter((t) => {
    if (!t.responsavel_id || !t.hora_inicio) return false;
    const [h, m] = String(t.hora_inicio).split(":").map(Number);
    if ((h * 60 + m) - minutosAgora !== 15) return false;
    return aplicaHoje(t, iso, dow);
  });

  let enviados = 0;
  for (const t of doDia) {
    // Recorrente já concluída hoje? Única já concluída?
    if (t.tipo === "unica") { if (t.status === "concluida") continue; }
    else {
      const { data: c } = await admin.from("conclusoes").select("id").eq("tarefa_id", t.id).eq("data", iso).maybeSingle();
      if (c) continue;
    }
    // Trava anti-duplicado: só o primeiro insert (tarefa+data) segue com o envio.
    const { data: lock } = await admin
      .from("lembretes_enviados")
      .upsert({ tarefa_id: t.id, data: iso }, { onConflict: "tarefa_id,data", ignoreDuplicates: true })
      .select();
    if (!lock || lock.length === 0) continue;

    const { data: subs } = await admin.from("push_subs").select("endpoint, p256dh, auth").eq("user_id", t.responsavel_id);
    const payload = JSON.stringify({ titulo: "Tarefa em 15 minutos", corpo: `${t.titulo} — às ${String(t.hora_inicio).slice(0, 5)}`, tag: "tarefa-" + t.id });
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        enviados++;
      } catch (e: any) {
        // Inscrição expirada/cancelada: remove para não tentar de novo.
        if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, verificadas: doDia.length, enviados }), { headers: { "Content-Type": "application/json" } });
});
