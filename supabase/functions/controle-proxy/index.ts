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
// Alarmes Intelbras: painéis e sensores — só para quem tem o menu ⋮ do Controle (ou é admin).
const ALARME = /^(alarm_control_panel\.(intelbras_amt_8000_all_groups|amt_4010_central|amt_4010_particao_[abc])|binary_sensor\.(intelbras_amt_8000_|amt_4010_))/;
// O Spotify de cada pessoa (media_player.spotify_*) é dela: nome igual, ou mesmo primeiro e último nome.
const palavras = (t: string) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/^spotify\s*/, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
function mesmaPessoa(perfil: string, conta: string) {
  const a = palavras(perfil), b = palavras(conta);
  if (!a.length || !b.length) return false;
  return a.join(" ") === b.join(" ") || (a.length > 1 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]);
}
const ehMeuSpotify = (s: any, nome: string) => String(s?.entity_id || "").startsWith("media_player.spotify_")
  && (mesmaPessoa(nome, s?.attributes?.friendly_name || "") || mesmaPessoa(nome, String(s.entity_id).slice("media_player.spotify_".length)));
// Aparelhos que vêm junto com um cadastrado: o cartão "TV Sala" (Chromecast da TV) comanda a
// Android TV, o controle remoto dela e o receiver Denon (volume da sala).
const VINCULADOS: Record<string, string[]> = {
  "media_player.tv_sala": ["media_player.smarttv_4k_ffm", "remote.smarttv_4k_ffm", "media_player.denon_avr_s770h"],
  "media_player.smarttv_4k_ffm": ["remote.smarttv_4k_ffm", "media_player.denon_avr_s770h"],
  "lock.fechadura_porta_frente": ["sensor.fechadura_porta_frente_battery"],
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
    .select("*")
    .eq("id", quem.user.id)
    .maybeSingle();
  if (!p || p.ativo === false) return json({ error: "Seu acesso ao app foi removido." }, 403);
  if (p.expira_em && new Date(p.expira_em).getTime() <= Date.now()) {
    return json({ error: "Seu acesso de visitante expirou. Peça um novo QR Code." }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }

  // 1b) Tempo: qualquer pessoa ativa do app pode LER a estação meteorológica (nada é comandado).
  // 1c) Situação da casa ("Sobre a propriedade", só admin): nível da caixa d'água e baterias
  //     (fechaduras, sensores, estação Ecowitt). Só leitura.
  if (body?.acao === "saude") {
    if (p.papel !== "admin") return json({ error: "Só para administradores." }, 403);
    const { data: cfgS } = await admin.from("ha_config").select("base_url, token").eq("id", "default").maybeSingle();
    if (!cfgS?.base_url || !cfgS?.token) return json({ error: "O controle da casa ainda não foi configurado." }, 500);
    const rs = await fetch(String(cfgS.base_url).replace(/\/+$/, "") + "/api/states", { headers: { Authorization: "Bearer " + cfgS.token } });
    if (!rs.ok) return json({ error: `O Home Assistant não respondeu (${rs.status}).` }, 502);
    const todos: any[] = await rs.json();
    const nome = (x: any) => x.attributes?.friendly_name || x.entity_id;
    const agua = todos.find((x) => x.entity_id === "sensor.0xa4c13818adff06db_liquid_level_percent");
    const baterias = todos
      // bateria pelo tipo (device_class) ou pelo nome — a estação Ecowitt às vezes não marca o tipo
      .filter((x) => /^(sensor|binary_sensor)\./.test(x.entity_id) && (x.attributes?.device_class === "battery" || /batter|bateria/i.test(x.entity_id + " " + nome(x))))
      .filter((x) => !/voltage|tensao|tensão|_charging|carregando/i.test(x.entity_id + " " + nome(x)))
      .filter((x) => !/^(sensor|binary_sensor)\.(mobile|sm_|iphone|galaxy|pixel)/i.test(x.entity_id)) // celulares não
      .map((x) => ({ id: x.entity_id, nome: nome(x), state: x.state, unidade: x.attributes?.unit_of_measurement || "", binario: x.entity_id.startsWith("binary_sensor.") }));
    return json({ agua: agua ? { state: agua.state, mudou: agua.last_changed } : null, baterias });
  }

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
  const podeAlarme = p.papel === "admin" || p.pode_menu_controle === true;
  cadastrados.add("sensor.0xa4c13818adff06db_liquid_level_percent"); // nível da caixa d'água (só leitura, para o aviso)
  for (const id of [...cadastrados]) for (const v of VINCULADOS[id] || []) cadastrados.add(v);
  // Zonas do AAT: agudo, grave e balanço da zona (number.aat_pmr7_zona_N_…).
  for (const id of [...cadastrados]) {
    const z = id.match(/^media_player\.aat_pmr7_zona_(\d+)$/);
    if (z) for (const k of ["graves", "agudos", "balanco"]) cadastrados.add(`number.aat_pmr7_zona_${z[1]}_${k}`);
  }
  // Cartões de Alexa: as Echos tocam pelo Spotify ligado a elas na Alexa (o "da casa").
  if ([...cadastrados].some((id) => id.startsWith("alexa."))) cadastrados.add("media_player.spotify_leo_abdalla");
  // Mesa de som da fonte TV do AAT (plug + canais 1, 4 e Main).
  if ([...cadastrados].some((id) => /^media_player\.aat_pmr7_zona_\d+$/.test(id))) {
    for (const id of ["switch.plug_mesa_de_som_behring", "number.channel_1_fader", "switch.channel_1_on", "number.channel_4_fader", "switch.channel_4_on", "number.main_fader", "switch.main_on"]) cadastrados.add(id);
  }

  // 2b) Programações (Configuração, só o gestor): viram automações de verdade no Home Assistant
  //     (id "abdalla_app_…"), então rodam mesmo com o app fechado. O app manda uma descrição
  //     simples; a automação é montada AQUI, só com aparelhos cadastrados e comandos permitidos.
  if (body?.acao === "programacao") {
    if (p.pode_gerir_controle !== true) return json({ error: "Só quem configura o Controle pode mexer nas programações." }, 403);
    const ha = async (caminho: string, metodo = "GET", corpo?: unknown) => {
      const r = await fetch(base + caminho, { method: metodo, headers: cabecalho, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
      if (r.status === 401 || r.status === 403) throw new Error("O token do Home Assistant precisa ser de um usuário administrador para criar programações.");
      if (!r.ok) throw new Error(`O Home Assistant recusou (${r.status}): ${(await r.text()).slice(0, 200)}`);
      return r.headers.get("content-type")?.includes("json") ? r.json() : null;
    };
    const ID = /^abdalla_app_[a-z0-9]{6,32}$/;
    try {
      if (body.op === "listar") {
        const estados: any[] = await ha("/api/states");
        const minhas = estados.filter((x) => String(x.entity_id).startsWith("automation.") && ID.test(String(x.attributes?.id || "")));
        const lista = await Promise.all(minhas.map(async (x) => {
          const c = await ha(`/api/config/automation/config/${x.attributes.id}`).catch(() => null);
          return { id: x.attributes.id, entity_id: x.entity_id, ativo: x.state === "on", ultima: x.attributes?.last_triggered || null, spec: c?.variables?.app_spec || null, nome: x.attributes?.friendly_name || "" };
        }));
        return json({ lista });
      }
      if (body.op === "apagar") {
        if (!ID.test(String(body.id || ""))) return json({ error: "Programação inválida." }, 400);
        await ha(`/api/config/automation/config/${body.id}`, "DELETE");
        return json({ ok: true });
      }
      if (body.op === "ativar") {
        const estados: any[] = await ha("/api/states");
        const alvo = estados.find((x) => x.entity_id === body.entity_id && ID.test(String(x.attributes?.id || "")));
        if (!alvo) return json({ error: "Programação não encontrada." }, 404);
        await ha(`/api/services/automation/${body.ativo ? "turn_on" : "turn_off"}`, "POST", { entity_id: alvo.entity_id });
        return json({ ok: true });
      }
      if (body.op === "salvar") {
        const s = body.spec || {};
        const id = s.id && ID.test(s.id) ? s.id : "abdalla_app_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const nome = String(s.nome || "").trim().slice(0, 80);
        if (!nome) return json({ error: "Dê um nome à programação." }, 400);
        const g = s.gatilho || {};
        const DIAS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        let triggers: unknown[], conditions: unknown[] = [];
        if (g.tipo === "horario") {
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(g.hora || ""))) return json({ error: "Horário inválido." }, 400);
          triggers = [{ trigger: "time", at: `${g.hora}:00` }];
          const dias = (Array.isArray(g.dias) ? g.dias : []).filter((d: string) => DIAS.includes(d));
          if (dias.length && dias.length < 7) conditions = [{ condition: "time", weekday: dias }];
        } else if (g.tipo === "sensor") {
          const valor = Number(g.valor);
          if (!/^sensor\.[a-z0-9_]+$/.test(String(g.entity_id || "")) || !Number.isFinite(valor)) return json({ error: "Escolha o sensor e o valor." }, 400);
          triggers = [{ trigger: "numeric_state", entity_id: g.entity_id, [g.comparacao === "abaixo" ? "below" : "above"]: valor }];
        } else return json({ error: "Escolha quando a programação acontece." }, 400);
        const acoes = Array.isArray(s.acoes) ? s.acoes : [];
        if (!acoes.length) return json({ error: "Escolha pelo menos um aparelho." }, 400);
        const actions: unknown[] = [];
        for (const a of acoes) {
          const e = String(a?.entity_id || "");
          if (!ENTIDADE.test(e) || !cadastrados.has(e)) return json({ error: `Aparelho não cadastrado: ${e}` }, 400);
          const dom = e.split(".")[0];
          if (dom === "cover" && ["abrir", "fechar"].includes(a.acao)) {
            const abrir = (a.acao === "abrir") !== (a.inverter === true); // flap: comando físico invertido
            actions.push({ action: abrir ? "cover.open_cover" : "cover.close_cover", target: { entity_id: e } });
          } else if (dom === "climate" && a.acao === "ligar") {
            actions.push({ action: "climate.set_temperature", target: { entity_id: e }, data: { temperature: 22, hvac_mode: "cool" } });
          } else if (dom === "climate" && a.acao === "desligar") {
            actions.push({ action: "climate.turn_off", target: { entity_id: e } });
          } else if (["light", "switch", "fan", "input_boolean"].includes(dom) && ["ligar", "desligar"].includes(a.acao)) {
            actions.push({ action: a.acao === "ligar" ? "homeassistant.turn_on" : "homeassistant.turn_off", target: { entity_id: e } });
          } else return json({ error: `Comando não permitido para ${e}.` }, 400);
          actions.push({ delay: { milliseconds: 400 } }); // um de cada vez, como o app faz
        }
        actions.pop();
        const spec = { ...s, id, nome };
        await ha(`/api/config/automation/config/${id}`, "POST", {
          id, alias: `App · ${nome}`, description: "Criada pelo app Abdalla Home (Configuração > Programações). Edite pelo app.",
          mode: "single", triggers, conditions, actions, variables: { app_spec: spec },
        });
        return json({ ok: true, id });
      }
      return json({ error: "Pedido inválido." }, 400);
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }
  }

  // 3) Alarme com a senha guardada no servidor (tabela alarme_senha): arma/desarma sem a senha
  //    passar pelo celular. SÓ administrador: quem tem apenas o menu ⋮ precisa digitar a senha
  //    (vai pelo "servico" abaixo, com o código que a pessoa sabe).
  if (body?.acao === "alarme") {
    const painel = String(body.painel || "");
    if (p.papel !== "admin" || !/^alarm_control_panel\.(intelbras_amt_8000_all_groups|amt_4010_central)$/.test(painel)) return json({ error: "Sem permissão para o alarme." }, 403);
    const { data: sen } = await admin.from("alarme_senha").select("senha").eq("painel", painel).maybeSingle();
    if (!sen?.senha) return json({ semSenha: true });
    const r = await fetch(`${base}/api/services/alarm_control_panel/${body.armar ? "alarm_arm_away" : "alarm_disarm"}`, {
      method: "POST", headers: cabecalho, body: JSON.stringify({ entity_id: painel, code: sen.senha }),
    });
    if (!r.ok) return json({ error: `A central recusou o comando (${r.status}).` }, 502);
    return json({ ok: true });
  }

  // 3a) Estados atuais — só dos aparelhos cadastrados.
  if (body?.acao === "estados") {
    const r = await fetch(base + "/api/states", { headers: cabecalho });
    if (!r.ok) return json({ error: `O Home Assistant não respondeu (${r.status}).` }, 502);
    const todos = await r.json();
    const estados = (Array.isArray(todos) ? todos : [])
      .filter((s: any) => cadastrados.has(s.entity_id) || s.entity_id === p.spotify_entity || ehMeuSpotify(s, p.nome) || (podeAlarme && ALARME.test(s.entity_id)))
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
    let liberado = cadastrados.has(entity) || entity === p.spotify_entity || (podeAlarme && ALARME.test(entity));
    if (!liberado && entity.startsWith("media_player.spotify_")) {
      const rs = await fetch(`${base}/api/states/${entity}`, { headers: cabecalho });
      liberado = rs.ok && ehMeuSpotify(await rs.json(), p.nome);
    }
    if (!liberado) return json({ error: "Este aparelho não está liberado no controle." }, 403);
    const doProprioTipo = domain === entity.split(".")[0];
    // Única exceção de "recarregar integração": a da mesa XR18 (pela entidade dela), que demora a
    // reconectar sozinha depois que o plug liga.
    const recarregarMesa = domain === "homeassistant" && service === "reload_config_entry" && entity === "number.main_fader";
    const generico = (domain === "homeassistant" && GENERICOS.includes(service)) || recarregarMesa;
    if (!doProprioTipo && !generico) return json({ error: "Comando não permitido para este aparelho." }, 403);
    // Visitante nunca abre a casa: fechadura, alarme e portão ficam só para ver, mesmo num cômodo liberado.
    if (p.papel === "visitante" && (["lock", "alarm_control_panel"].includes(entity.split(".")[0]) || entity === "cover.portao_garagem")) {
      return json({ error: "Visitante não pode usar fechadura, portão ou alarme." }, 403);
    }

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
