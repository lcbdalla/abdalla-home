// Edge Function: convite
// -----------------------------------------------------------------------------
// Página do convidado (link do WhatsApp, sem login). Com o código do convite:
//   "ver"   → diz se o convite está valendo, quem convidou e onde fica o portão;
//   "abrir" → confere horário (do início até 5 h depois), se ainda não foi usado e se o
//             celular está a até 500 m do portão; abre o Portão Principal e, em segundo plano:
//             quando o portão aparece aberto, destranca a porta da frente da Casa Alta; 45 s
//             depois fecha o portão; 10 s depois desativa o link.
// O token do Home Assistant fica só aqui (tabela ha_config, lida com a chave secreta).
//
// Deploy: painel do Supabase > Edge Functions > Deploy a new function > Via Editor.
// Digite o NOME "convite" ANTES de publicar e cole este arquivo.
// Depois, em Settings da função, DESLIGUE "Verify JWT" (o convidado não tem login).
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PORTAO = "cover.portao_garagem";        // Portão Principal
const PORTA = "lock.fechadura_porta_frente";  // porta da frente da Casa Alta
const RAIO_M = 500;
const DURACAO_MS = 5 * 3600 * 1000;
// Onde fica o portão (latitude, longitude). Sem valor, usa a localização da casa no Home Assistant.
// ponytail: se o portão ficar longe da casa, preencher aqui para o raio de 500 m valer no portão.
const PORTAO_LAT: number | null = null;
const PORTAO_LON: number | null = null;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try { serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || serviceKey; } catch { /* usa o legado */ }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const token = String(body?.token || "");
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return json({ error: "Convite não encontrado." }, 404);

  const { data: c } = await admin.from("convites").select("*").eq("token", token).maybeSingle();
  if (!c) return json({ error: "Convite não encontrado." }, 404);

  const { data: cfg } = await admin.from("ha_config").select("base_url, token").eq("id", "default").maybeSingle();
  if (!cfg?.base_url || !cfg?.token) return json({ error: "O rancho ainda não configurou o acesso." }, 500);
  const base = String(cfg.base_url).replace(/\/+$/, "");
  const cab = { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" };
  const servico = (dominio: string, nome: string, entity_id: string) =>
    fetch(`${base}/api/services/${dominio}/${nome}`, { method: "POST", headers: cab, body: JSON.stringify({ entity_id }) });

  let lat = PORTAO_LAT, lon = PORTAO_LON;
  if (lat == null || lon == null) {
    const r = await fetch(`${base}/api/config`, { headers: cab }).catch(() => null);
    const conf = r && r.ok ? await r.json() : {};
    lat = conf.latitude ?? null; lon = conf.longitude ?? null;
  }

  const agora = Date.now(), ini = Date.parse(c.inicio), fim = ini + DURACAO_MS;
  const estado = c.encerrado_em ? "encerrado" : agora < ini ? "cedo" : agora > fim ? "expirado" : c.usado_em ? "usado" : "ativo";

  if (body.acao === "ver") {
    return json({ estado, inicio: c.inicio, fim: new Date(fim).toISOString(), convidadoPor: c.nome_criador, convidado: c.convidado, lat, lon });
  }

  if (body.acao === "abrir") {
    if (estado === "cedo") return json({ error: "Seu convite ainda não começou." }, 403);
    if (estado !== "ativo") return json({ error: "Este convite já foi usado ou encerrado." }, 403);
    const meuLat = Number(body.lat), meuLon = Number(body.lon), precisao = Math.min(Math.max(Number(body.precisao) || 0, 0), 100);
    if (!Number.isFinite(meuLat) || !Number.isFinite(meuLon)) return json({ error: "Não deu para saber onde você está. Ligue a localização do celular." }, 400);
    if (lat == null || lon == null) return json({ error: "O rancho ainda não tem a localização do portão." }, 500);
    const d = distanciaM(meuLat, meuLon, lat, lon);
    if (d - precisao > RAIO_M) return json({ error: `Você está a ${(d / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km do portão. O botão funciona quando você estiver a até ${RAIO_M} m.`, longe: true }, 403);

    // Um uso só: marca antes de abrir (dois toques seguidos não abrem duas vezes).
    const { data: marcado } = await admin.from("convites").update({ usado_em: new Date().toISOString() }).eq("id", c.id).is("usado_em", null).is("encerrado_em", null).select("id");
    if (!marcado?.length) return json({ error: "Este convite já foi usado." }, 409);

    const r = await servico("cover", "open_cover", PORTAO);
    if (!r.ok) {
      await admin.from("convites").update({ usado_em: null }).eq("id", c.id); // deixa tentar de novo
      return json({ error: "O portão não respondeu. Tente de novo em instantes." }, 502);
    }

    EdgeRuntime.waitUntil((async () => {
      // Espera o portão aparecer aberto (até 60 s).
      let abriu = false;
      for (let i = 0; i < 30 && !abriu; i++) {
        await esperar(2000);
        const rs = await fetch(`${base}/api/states/${PORTAO}`, { headers: cab }).catch(() => null);
        const st = rs && rs.ok ? (await rs.json()).state : "";
        abriu = st === "open" || st === "opening";
      }
      if (!abriu) { await admin.from("convites").update({ usado_em: null }).eq("id", c.id); return; } // não abriu: pode tentar de novo
      await servico("lock", "unlock", PORTA);
      await esperar(45000);
      await servico("cover", "close_cover", PORTAO);
      await esperar(10000);
      await admin.from("convites").update({ encerrado_em: new Date().toISOString() }).eq("id", c.id);
    })());
    return json({ ok: true });
  }

  return json({ error: "Pedido inválido." }, 400);
});
