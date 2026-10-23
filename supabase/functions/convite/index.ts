// Edge Function: convite
// -----------------------------------------------------------------------------
// Página do convidado (link do WhatsApp, sem login). Com o código do convite:
//   "ver"   → diz se o convite está valendo, quem convidou e onde fica o portão;
//   (também, sem convite: "clima_publico" = números da estação; "tv_acesso" = QR do visitante da TV)
//   "abrir" → confere horário (do início até 5 h depois), se ainda não foi usado e se o
//             celular está a até 500 m do portão; abre o Portão Principal e, em segundo plano:
//             quando o portão aparece aberto, destranca a porta da frente da Casa Alta; 45 s
//             depois fecha o portão; 10 s depois desativa o link.
// O token do Home Assistant fica só aqui (tabela ha_config, lida com a chave secreta).
//
// Deploy: painel do Supabase > Edge Functions > Deploy a new function > Via Editor.
// Digite o NOME "convite" ANTES de publicar e cole este arquivo. (Publicada com o endereço
// "dynamic-worker": é esse que o app chama.)
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
// Onde fica o Portão Principal (10°02'15.23"S 48°19'00.95"W, passado pelo Leonardo). Também é o destino do Maps.
const PORTAO_LAT: number | null = -10.037564;
const PORTAO_LON: number | null = -48.316931;

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

  // ---- Tela de boas-vindas da TV (sem login) ----
  const haCfg = async () => {
    const { data } = await admin.from("ha_config").select("base_url, token").eq("id", "default").maybeSingle();
    return data?.base_url && data?.token ? { base: String(data.base_url).replace(/\/+$/, ""), cab: { Authorization: "Bearer " + data.token } } : null;
  };
  // Clima da estação Ecowitt (GW3000C): só os números, só leitura.
  if (body?.acao === "clima_publico") {
    const ha = await haCfg();
    if (!ha) return json({ error: "Sem configuração." }, 500);
    const rs = await fetch(ha.base + "/api/states", { headers: ha.cab }).catch(() => null);
    if (!rs || !rs.ok) return json({ error: "A estação não respondeu." }, 502);
    const todos: any[] = await rs.json();
    const est = todos.filter((x) => String(x.entity_id).startsWith("sensor.gw3000c_") || (String(x.entity_id).startsWith("sensor.") && /^gw3000c/i.test(String(x.attributes?.friendly_name || ""))));
    const texto = (x: any) => String(x.entity_id).replace(/^sensor\./, "").replace(/_/g, " ");
    const usados = new Set<string>();
    const achar = (re: RegExp) => {
      const s = est.find((x) => !usados.has(x.entity_id) && !["unknown", "unavailable", ""].includes(x.state) && re.test(texto(x)));
      if (!s) return null;
      usados.add(s.entity_id);
      const n = Number(s.state);
      return Number.isFinite(n) ? n : null;
    };
    // Mesma ordem do app (a rajada máxima antes da rajada, para não confundir).
    const temperatura = achar(/outdoor temp/), sensacao = achar(/feels like/), umidade = achar(/^gw3000c (outdoor )?humidity$/);
    achar(/max.*gust|gust.*max/);
    const rajada = achar(/gust/), vento = achar(/wind speed/), direcao = achar(/wind dir/), uv = achar(/\buv\b/);
    const chuvaHoje = achar(/daily rain|rain daily|24h rain/);
    return json({ temperatura_c: temperatura, sensacao_c: sensacao, umidade_pct: umidade, vento_kmh: vento, rajada_kmh: rajada, direcao_graus: direcao, chuva_hoje_mm: chuvaHoje, uv, lido_em: new Date().toISOString() });
  }
  // QR do visitante para a TV: a TV manda a sua chave secreta e recebe o link de visitante que vale
  // agora (gerado pelo dono na Equipe; trocar o QR lá desliga o antigo).
  if (body?.acao === "tv_acesso") {
    const { data: tv } = await admin.from("tv_acessos").select("chave, link, ate").eq("id", String(body.tv || "")).maybeSingle();
    if (!tv || !tv.chave || String(body.chave || "") !== tv.chave) return json({ error: "Acesso negado." }, 403);
    if (!tv.link || (tv.ate && Date.parse(tv.ate) <= Date.now())) return json({ link: null, ate: tv.ate || null });
    return json({ link: tv.link, ate: tv.ate });
  }

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
