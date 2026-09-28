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
  if (!p || p.ativo === false || !(p.pode_controle || p.pode_gerir_controle)) {
    return json({ error: "Você não tem acesso ao controle da casa." }, 403);
  }
  if (p.expira_em && new Date(p.expira_em).getTime() <= Date.now()) {
    return json({ error: "Seu acesso de visitante expirou. Peça um novo QR Code." }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }

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
