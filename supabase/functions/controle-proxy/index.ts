// Edge Function: controle-proxy
// -----------------------------------------------------------------------------
// Intermediário do Controle da Casa. Colaboradores, crianças e visitantes NÃO
// recebem o token do Home Assistant (que dá acesso total à casa, câmeras e
// configurações). O app pede a esta função, que:
//   1. confere quem chamou (login do app) e se ainda pode controlar: ativo, com
//      permissão e — no caso de visitante — dentro da validade;
//   2. só devolve/aciona os aparelhos cadastrados no Controle (controle_equipamentos),
//      com comandos do próprio tipo do aparelho, e trava o alvo aqui no servidor;
//   3. usa o token guardado em ha_config, lido com a chave secreta (nunca sai daqui).
//
// Deploy: painel do Supabase > Edge Functions > Deploy a new function > Via Editor.
// Digite o NOME "controle-proxy" ANTES de publicar e cole este arquivo.
// Depois, em Settings da função, DESLIGUE "Verify JWT" (a checagem é feita aqui).
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const NOME = /^[a-z0-9_]+$/;
const ENTIDADE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const GENERICOS = ["toggle", "turn_on", "turn_off"]; // homeassistant.* permitidos
// Aparelhos que vêm junto com um cadastrado: o cartão "TV Sala" (Chromecast da TV) comanda a
// Android TV, o controle remoto dela e o receiver Denon (volume da sala).
const VINCULADOS: Record<string, string[]> = {
  "media_player.tv_sala": ["media_player.smarttv_4k_ffm", "remote.smarttv_4k_ffm", "media_player.denon_avr_s770h"],
  "media_player.smarttv_4k_ffm": ["remote.smarttv_4k_ffm", "media_player.denon_avr_s770h"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  // Chave secreta: formato novo (SUPABASE_SECRET_KEYS) ou o legado (SUPABASE_SERVICE_ROLE_KEY).
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try { serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || serviceKey; } catch { /* usa o legado */ }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Quem chamou e se ainda pode controlar a casa.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: quem, error: errQuem } = await admin.auth.getUser(jwt);
  if (errQuem || !quem?.user) return json({ error: "Sua sessão expirou. Saia e entre de novo no app." }, 401);
  const { data: p } = await admin
    .from("perfis")
    .select("ativo, papel, pode_controle, pode_gerir_controle, expira_em")
    .eq("id", quem.user.id)
    .maybeSingle();
  if (!p || p.ativo === false) return json({ error: "Seu acesso ao app foi removido." }, 403);
  if (p.expira_em && new Date(p.expira_em).getTime() <= Date.now()) {
    return json({ error: "Seu acesso de visitante expirou. Peça um novo QR Code." }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }

  // 1b) Tempo: qualquer pessoa ativa do app pode LER a estação meteorológica (nada é comandado).
  if (body?.acao === "clima") {
    const { data: cfgC } = await admin.from("ha_config").select("base_url, token").eq("id", "default").maybeSingle();
    if (!cfgC?.base_url || !cfgC?.token) return json({ error: "O controle da casa ainda não foi configurado." }, 500);
    const baseC = String(cfgC.base_url).replace(/\/+$/, "");
    const cab = { Authorization: "Bearer " + cfgC.token };
    const [rs, rc] = await Promise.all([fetch(baseC + "/api/states", { headers: cab }), fetch(baseC + "/api/config", { headers: cab })]);
    if (!rs.ok) return json({ error: `O Home Assistant não respondeu (${rs.status}).` }, 502);
    const todos = await rs.json();
    const conf = rc.ok ? await rc.json() : {};
    // Só os sensores da estação Ecowitt (GW3000C): nome, valor e unidade. Pelo identificador
    // (sensor.gw3000c_…), que não muda quando alguém renomeia o sensor no HA.
    const sensores = (Array.isArray(todos) ? todos : [])
      .filter((x: any) => String(x.entity_id).startsWith("sensor.gw3000c_") || (String(x.entity_id).startsWith("sensor.") && /^gw3000c/i.test(String(x.attributes?.friendly_name || ""))))
      .map((x: any) => ({ id: x.entity_id, nome: x.attributes?.friendly_name || x.entity_id, state: x.state, unidade: x.attributes?.unit_of_measurement || "", tipo: x.attributes?.device_class || "", mudou: x.last_changed }));
    return json({ sensores, lat: conf.latitude ?? null, lon: conf.longitude ?? null });
  }

  // Daqui para baixo é o Controle da Casa: precisa da permissão de controle.
  if (!(p.pode_controle || p.pode_gerir_controle)) return json({ error: "Você não tem acesso ao controle da casa." }, 403);

  // 2) Configuração do Home Assistant e lista de aparelhos cadastrados.
  const { data: cfg } = await admin.from("ha_config").select("base_url, token").eq("id", "default").maybeSingle();
  if (!cfg?.base_url || !cfg?.token) return json({ error: "O controle da casa ainda não foi configurado." }, 500);
  const base = String(cfg.base_url).replace(/\/+$/, "");
  const cabecalho = { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" };
  const { data: eqs } = await admin.from("controle_equipamentos").select("entity_id, ambiente_id");
  let lista = eqs || [];
  if (p.papel === "visitante") {
    // Visitante: só os cômodos com "Visitantes podem usar" ligado.
    const { data: ambs, error: errAmb } = await admin.from("ambientes").select("id").eq("visitante", true);
    if (errAmb) return json({ error: "Falta rodar o SQL visitante-ambientes.sql no Supabase." }, 500);
    const liberados = new Set((ambs || []).map((a: { id: string }) => a.id));
    lista = lista.filter((q: { ambiente_id: string }) => liberados.has(q.ambiente_id));
  }
  const cadastrados = new Set(lista.map((q: { entity_id: string }) => q.entity_id));
  for (const id of [...cadastrados]) for (const v of VINCULADOS[id] || []) cadastrados.add(v);
  // Zonas do AAT: agudo, grave e balanço da zona (number.aat_pmr7_zona_N_…).
  for (const id of [...cadastrados]) {
    const z = id.match(/^media_player\.aat_pmr7_zona_(\d+)$/);
    if (z) for (const k of ["graves", "agudos", "balanco"]) cadastrados.add(`number.aat_pmr7_zona_${z[1]}_${k}`);
  }
  // Mesa de som da fonte TV do AAT (plug + canais 1, 4 e Main).
  if ([...cadastrados].some((id) => /^media_player\.aat_pmr7_zona_\d+$/.test(id))) {
    for (const id of ["switch.plug_mesa_de_som_behring", "number.channel_1_fader", "switch.channel_1_on", "number.channel_4_fader", "switch.channel_4_on", "number.main_fader", "switch.main_on"]) cadastrados.add(id);
  }

  // 3a) Estados atuais — só dos aparelhos cadastrados.
  if (body?.acao === "estados") {
    const r = await fetch(base + "/api/states", { headers: cabecalho });
    if (!r.ok) return json({ error: `O Home Assistant não respondeu (${r.status}).` }, 502);
    const todos = await r.json();
    const estados = (Array.isArray(todos) ? todos : [])
      .filter((s: any) => cadastrados.has(s.entity_id))
      .map((s: any) => {
        const a = { ...(s.attributes || {}) };
        delete a.access_token; // nunca expor tokens de câmera/mídia
        if (typeof a.entity_picture === "string" && a.entity_picture.includes("token=")) delete a.entity_picture;
        return { entity_id: s.entity_id, state: s.state, attributes: a };
      });
    return json({ estados });
  }

  // 3b) Comando — só no aparelho cadastrado e com serviço do próprio tipo dele.
  if (body?.acao === "servico") {
    const entity = String(body.entity_id || ""), domain = String(body.domain || ""), service = String(body.service || "");
    if (!ENTIDADE.test(entity) || !NOME.test(domain) || !NOME.test(service)) return json({ error: "Comando inválido." }, 400);
    if (!cadastrados.has(entity)) return json({ error: "Este aparelho não está liberado no controle." }, 403);
    const doProprioTipo = domain === entity.split(".")[0];
    const generico = domain === "homeassistant" && GENERICOS.includes(service);
    if (!doProprioTipo && !generico) return json({ error: "Comando não permitido para este aparelho." }, 403);

    const dados = (body.data && typeof body.data === "object" && !Array.isArray(body.data)) ? { ...body.data } : {};
    for (const k of ["entity_id", "device_id", "area_id", "floor_id", "label_id", "target"]) delete dados[k]; // alvo travado
    const r = await fetch(`${base}/api/services/${domain}/${service}`, {
      method: "POST",
      headers: cabecalho,
      body: JSON.stringify({ ...dados, entity_id: entity }),
    });
    if (!r.ok) return json({ error: `O Home Assistant recusou o comando (${r.status}).` }, 502);
    return json({ ok: true });
  }

  return json({ error: "Ação desconhecida." }, 400);
});
