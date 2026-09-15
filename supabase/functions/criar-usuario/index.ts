// Edge Function: criar-usuario
// -----------------------------------------------------------------------------
// Cria um novo usuario no Supabase Auth e o registro correspondente em "perfis".
// Roda no SERVIDOR (Deno) e usa a chave service_role, que NUNCA vai para o app.
//
// Seguranca:
//   1. Le o token JWT de quem chamou (enviado automaticamente pelo app).
//   2. Confirma que o chamador tem perfil admin e ativo=true.
//   3. So entao cria o usuario com a chave service_role.
//
// Deploy: painel do Supabase > Edge Functions > "criar-usuario" (endereço: quick-service) > colar
// este arquivo. (SUPABASE_URL e a chave secreta ja existem no ambiente das Edge
// Functions; nao precisa configurar nada a mais.)
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  // Chave secreta: formato novo (SUPABASE_SECRET_KEYS) ou o legado (SUPABASE_SERVICE_ROLE_KEY).
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  try { serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || serviceKey; } catch { /* usa o legado */ }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Identifica quem chamou a partir do token enviado pelo app.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Sua sessão expirou. Saia e entre de novo no app." }, 401);

  // 2) Confere se o chamador é admin e está ativo.
  const { data: perfilChamador } = await admin
    .from("perfis")
    .select("papel, ativo")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!perfilChamador || perfilChamador.ativo === false || perfilChamador.papel !== "admin") {
    return json({ error: "Apenas administradores podem adicionar pessoas." }, 403);
  }

  // 3) Valida a entrada.
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  const nome = String(body?.nome || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const senha = String(body?.senha || "");
  const telefone = String(body?.telefone || "").trim();
  const papel = body?.papel === "admin" ? "admin" : "colaborador";
  const setor = papel === "admin" ? "" : String(body?.setor || "").trim();
  if (!nome || !email || senha.length < 6) return json({ error: "Nome, e-mail e senha (mín. 6) são obrigatórios." }, 400);

  // 4) Cria o usuário no Auth (já confirmado, para poder entrar de imediato).
  const { data: novo, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (createErr || !novo?.user) {
    const jaExiste = /already|registered|exists/i.test(createErr?.message || "");
    return json({ error: jaExiste ? "Esse e-mail já tem cadastro no app." : "Falha ao criar usuário: " + (createErr?.message || "") }, 400);
  }

  // 5) Grava o perfil (mesmo id do Auth). Upsert porque um gatilho do banco já cria
  //    o perfil automaticamente quando o usuário nasce no Auth.
  const { error: perfilErr } = await admin.from("perfis").upsert({
    id: novo.user.id,
    nome,
    papel,
    telefone,
    setor: setor || null,
    ativo: true,
  }, { onConflict: "id" });
  if (perfilErr) {
    // Desfaz o usuário do Auth se o perfil falhar, para não deixar conta órfã.
    await admin.auth.admin.deleteUser(novo.user.id);
    return json({ error: "Falha ao criar o perfil: " + perfilErr.message }, 400);
  }

  return json({ ok: true, id: novo.user.id });
});
