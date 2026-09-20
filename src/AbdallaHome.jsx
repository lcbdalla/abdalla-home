import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ListTodo, CalendarDays, ShoppingCart, Package, Users, Plus, Check,
  Camera, Bell, X, Trash2, Pencil, Info, MapPin, Fuel, Wrench, Wine,
  ShoppingBasket, Repeat, Clock, User, RefreshCw, Star, Smartphone, Tag, Lock, Search, ArrowDownToLine, ArrowUpFromLine, Mail, LogOut, KeyRound, BarChart3, ChevronLeft, ChevronRight, UserPlus, MessageCircle, Copy, Shuffle, CheckCircle2, MoreVertical, Images
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ============================================================
   ABDALLA HOME — Rancho Abdalla
   Tarefas + Compras + Estoque (catálogo + autocomplete)
   Dados no Supabase (Auth + Postgres + Realtime + Storage)
   ============================================================ */

const C = {
  bg: "#f6f3ea", card: "#ffffff", linha: "#e6dfcd",
  pasto: "#2f7d4f", pastoEsc: "#1f5c39", pastoClaro: "#e6f2ea",
  lago: "#2b7a8c", lagoClaro: "#e2f0f2", areia: "#efe7d4",
  terra: "#33302a", cinza: "#726b5e", cinzaClaro: "#a49c8c",
  ambar: "#c8862a", ambarClaro: "#fbf0dc", vermelho: "#b34a3a", vermelhoClaro: "#f7e6e2",
};

const CATEGORIAS = [
  { id: "Supermercado", icon: ShoppingBasket, cor: "#3a8a5a" },
  { id: "Bebidas", icon: Wine, cor: "#8c5a2b" },
  { id: "Combustível", icon: Fuel, cor: "#c8862a" },
  { id: "Material de manutenção", icon: Wrench, cor: "#5a6b7a" },
];
const SUBCOMBUSTIVEL = ["Gasolina", "Diesel", "Gás"];
const UNIDADES = ["un", "kg", "g", "L", "mL", "cx", "pct", "saco", "m", "par", "lata", "dz", "fardo", "rolo", "frasco", "tubo", "barra"];

// Setores para agrupar a equipe e as tarefas (um colega do mesmo setor cobre o outro).
const SETORES = [
  { id: "Casa", cor: "#2b7a8c" },
  { id: "Área externa", cor: "#c8862a" },
];
const setorCor = (s) => (SETORES.find((x) => x.id === s)?.cor) || "#726b5e";

// Chave pública do web push (VAPID). É pública por definição — pode ficar no código.
// A chave privada correspondente fica só como segredo no Supabase (nunca no repositório).
const VAPID_PUBLIC = "BHJJ9Z4wQeZHuWbocTCz1jtm30KDpAEhifbV0oCC4FIdpZMw4JY_2x9TEUjkeJZhSLhVt975qSeT7l3cs_t_RXw";
const urlBase64ToUint8Array = (base64) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Convite de instalação (PWA). O navegador avisa quando o app pode ser instalado
// pelo evento "beforeinstallprompt"; guardamos esse convite para usar num botão.
let _installEvt = null;
const _installSubs = new Set();
const _installOpen = { fn: null }; // o botão "Instalar app" do cabeçalho chama isto
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); _installEvt = e; _installSubs.forEach((fn) => fn()); });
  window.addEventListener("appinstalled", () => { _installEvt = null; try { localStorage.setItem("instalarDispensado", "1"); } catch { /* sem storage */ } _installSubs.forEach((fn) => fn()); });
}
const estaInstalado = () => {
  try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch { /* ok */ }
  return window.navigator.standalone === true; // iPhone
};

/* global __BUILD_ID__ */
// Número desta versão do app (injetado no build). Serve para detectar atualização.
const APP_BUILD = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
let _openDialog = null;
const Dialog = {
  confirm: (o) => new Promise((res) => { if (_openDialog) _openDialog({ tipo: "confirm", ...o, resolve: res }); else res(false); }),
  prompt: (o) => new Promise((res) => { if (_openDialog) _openDialog({ tipo: "prompt", ...o, resolve: res }); else res(null); }),
};
const papelLabel = (p) => (p === "admin" ? "Administrador" : "Colaborador");
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------- Imagem: redimensiona e devolve um Blob para subir ao Storage ----------
function resizeImageToBlob(file, maxDim = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const cv = document.createElement("canvas"); cv.width = width; cv.height = height;
        cv.getContext("2d").drawImage(img, 0, 0, width, height);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/jpeg", quality);
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

// Sobe a foto para o bucket público "fotos" e devolve a URL pública.
async function uploadFoto(file) {
  const blob = await resizeImageToBlob(file);
  const nome = `${hojeISO()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("fotos").upload(nome, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("fotos").getPublicUrl(nome);
  return data.publicUrl;
}

const fmtData = (iso) => { if (!iso) return ""; const [a, m, d] = iso.split("-"); return `${d}/${m}`; };
const nomeUser = (users, id) => { const u = users.find((x) => x.id === id); return u ? u.nome : "Sem responsável"; };
const itensDaCompra = (t) => { if (!t || !t.compra) return []; if (Array.isArray(t.compra.itens)) return t.compra.itens; if (t.compra.produtoId) return [{ id: "leg", produtoId: t.compra.produtoId, quantidade: t.compra.quantidade }]; return []; };
function weekIndex(iso) {
  const d = new Date(iso + "T12:00:00");
  const epoch = new Date("1970-01-05T12:00:00"); // uma segunda-feira de referência
  return Math.floor((d - epoch) / 604800000);
}
function aplicaHoje(t, iso = hojeISO()) {
  if (t.tipo === "unica") return t.data === iso;
  if (t.dataInicio && iso < t.dataInicio) return false;
  const dow = new Date(iso + "T12:00:00").getDay();
  if (t.freq === "diaria") return true;
  if (t.freq === "semanal") {
    if (!(t.dias || []).includes(dow)) return false;
    const n = Math.max(1, parseInt(t.intervaloSemanas) || 1);
    if (n === 1) return true;
    const base = t.dataInicio || iso;
    return ((weekIndex(iso) - weekIndex(base)) % n) === 0;
  }
  return false;
}
function textoRecorrencia(t) {
  if (t.freq === "diaria") return "Todo dia";
  const dd = (t.dias || []).map((d) => DIAS[d]).join(" ");
  const n = Math.max(1, parseInt(t.intervaloSemanas) || 1);
  return n > 1 ? dd + " · a cada " + n + " sem" : dd;
}
function isConcluida(t, iso = hojeISO()) {
  if (t.tipo === "unica") return t.status === "concluida";
  return !!(t.conclusoes && t.conclusoes[iso]);
}

// ---------- Ajudantes do Painel (dashboard) ----------
const duracaoMin = (t) => {
  if (!t.horaInicio || !t.horaFim) return 0;
  const [h1, m1] = t.horaInicio.split(":").map(Number);
  const [h2, m2] = t.horaFim.split(":").map(Number);
  const d = (h2 * 60 + m2) - (h1 * 60 + m1);
  return d > 0 ? d : 0;
};
const isoLocal = (ms) => { const x = new Date(ms); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const inicioSemana = (d) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x; };
const fmtDM = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtHoras = (min) => { const h = Math.round(min) / 60; return `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`; };
// Quantas vezes uma tarefa recorrente cai no intervalo [inicio, fim] (datas ISO).
function ocorrenciasNoPeriodo(t, inicioISO, fimISO) {
  let n = 0; const d = new Date(inicioISO + "T12:00:00"); const fim = new Date(fimISO + "T12:00:00");
  while (d <= fim) { if (aplicaHoje(t, isoLocal(d))) n++; d.setDate(d.getDate() + 1); }
  return n;
}

// ---------- Conversores banco (snake_case) <-> app (camelCase) ----------
const timeHM = (t) => (t ? String(t).slice(0, 5) : "");
const toMs = (ts) => (ts ? new Date(ts).getTime() : null);
const mapPerfil = (r) => ({ id: r.id, nome: r.nome, papel: r.papel, telefone: r.telefone || "", setor: r.setor || "", ativo: r.ativo !== false });
const mapProduto = (r) => ({ id: r.id, nome: r.nome, categoria: r.categoria, subcategoria: r.subcategoria || "", unidade: r.unidade });
const mapMov = (r) => ({ id: r.id, produtoId: r.produto_id, tipo: r.tipo, qtd: Number(r.qtd) || 0, userId: r.user_id, origem: r.origem || "manual", em: toMs(r.criado_em) });

function buildTarefas(ts, itens, concl) {
  const itensBy = {};
  (itens || []).forEach((i) => { (itensBy[i.tarefa_id] || (itensBy[i.tarefa_id] = [])).push({ id: i.id, produtoId: i.produto_id, quantidade: Number(i.quantidade) }); });
  const conBy = {};
  (concl || []).forEach((c) => { (conBy[c.tarefa_id] || (conBy[c.tarefa_id] = {}))[c.data] = { fotoUrl: c.foto_url || null, userId: c.user_id }; });
  return (ts || []).map((r) => ({
    id: r.id, titulo: r.titulo || "", descricao: r.descricao || "",
    responsavelId: r.responsavel_id, criadoPorId: r.criado_por_id,
    tipo: r.tipo, freq: r.freq || "diaria", dias: r.dias || [], intervaloSemanas: r.intervalo_semanas || 1,
    data: r.data || "", dataInicio: r.data_inicio || "", horaInicio: timeHM(r.hora_inicio), horaFim: timeHM(r.hora_fim),
    imagemUrl: r.imagem_url || null, ehCompra: !!r.eh_compra, status: r.status || "pendente", setor: r.setor || "", estoqueAplicado: !!r.estoque_aplicado,
    concluidaEm: toMs(r.concluida_em), fotoConclusaoUrl: r.foto_conclusao_url || null, concluidaPorId: r.concluida_por_id || null,
    conclusoes: conBy[r.id] || {},
    compra: { itens: itensBy[r.id] || [] },
  })).sort((a, b) => String(b.dataInicio || b.data || "").localeCompare(String(a.dataInicio || a.data || "")));
}

// Monta a linha para gravar na tabela "tarefas".
function tarefaRow(d) {
  const recorrente = d.tipo === "recorrente";
  return {
    titulo: d.ehCompra ? (String(d.titulo || "").trim() || "Compras") : String(d.titulo || "").trim(),
    descricao: d.descricao ? String(d.descricao).trim() : null,
    responsavel_id: d.responsavelId || null,
    tipo: d.tipo,
    freq: recorrente ? d.freq : null,
    dias: recorrente && d.freq === "semanal" ? (d.dias || []) : [],
    intervalo_semanas: parseInt(d.intervaloSemanas) || 1,
    data: d.tipo === "unica" ? (d.data || null) : null,
    data_inicio: recorrente ? (d.dataInicio || null) : null,
    hora_inicio: d.horaInicio || null,
    hora_fim: d.horaFim || null,
    imagem_url: d.imagemUrl || null,
    eh_compra: !!d.ehCompra,
    setor: d.setor || null,
  };
}

// ---------- Base pré-cadastrada de produtos (usada só no primeiro acesso) ----------
function produtosSeed() {
  const out = [];
  const add = (categoria, arr, sub = false) => arr.forEach(([nome, unidade, subcategoria = ""]) => out.push({ nome, categoria, unidade, subcategoria: sub ? subcategoria : "" }));

  add("Supermercado", [
    ["Arroz", "kg"], ["Feijão carioca", "kg"], ["Feijão preto", "kg"], ["Açúcar", "kg"], ["Café", "kg"], ["Sal", "kg"],
    ["Farinha de trigo", "kg"], ["Farinha de mandioca", "kg"], ["Fubá", "kg"], ["Macarrão", "pct"], ["Óleo de soja", "un"],
    ["Azeite", "un"], ["Vinagre", "un"], ["Molho de tomate", "un"], ["Extrato de tomate", "un"], ["Leite", "L"],
    ["Leite em pó", "pct"], ["Leite condensado", "un"], ["Creme de leite", "un"], ["Manteiga", "un"], ["Margarina", "un"],
    ["Queijo mussarela", "kg"], ["Queijo prato", "kg"], ["Presunto", "kg"], ["Mortadela", "kg"], ["Ovos", "dz"],
    ["Pão de forma", "un"], ["Pão francês", "kg"], ["Biscoito cream cracker", "pct"], ["Bolacha recheada", "pct"],
    ["Cereal matinal", "pct"], ["Achocolatado em pó", "pct"], ["Sardinha em lata", "lata"], ["Atum em lata", "lata"],
    ["Milho verde em lata", "lata"], ["Ervilha em lata", "lata"], ["Maionese", "un"], ["Ketchup", "un"], ["Mostarda", "un"],
    ["Tempero pronto", "un"], ["Caldo de galinha", "cx"], ["Gelatina", "cx"], ["Fermento", "un"], ["Chocolate em barra", "barra"],
    ["Alho", "kg"], ["Cebola", "kg"], ["Batata", "kg"], ["Batata-doce", "kg"], ["Tomate", "kg"], ["Cenoura", "kg"],
    ["Mandioca", "kg"], ["Abóbora", "kg"], ["Pimentão", "kg"], ["Banana", "kg"], ["Maçã", "kg"], ["Laranja", "kg"],
    ["Limão", "kg"], ["Melancia", "un"], ["Mamão", "un"], ["Alface", "un"], ["Couve", "un"], ["Cheiro-verde", "un"],
    ["Frango", "kg"], ["Carne bovina", "kg"], ["Costela", "kg"], ["Linguiça", "kg"], ["Bacon", "kg"], ["Peixe", "kg"],
    ["Sabonete", "un"], ["Shampoo", "un"], ["Condicionador", "un"], ["Creme dental", "un"], ["Escova de dente", "un"],
    ["Papel higiênico", "fardo"], ["Desodorante", "un"], ["Papel toalha", "rolo"], ["Absorvente", "pct"],
    ["Lâmina de barbear", "un"], ["Álcool em gel", "un"], ["Cotonete", "cx"],
    ["Detergente", "un"], ["Sabão em pó", "kg"], ["Sabão em barra", "un"], ["Amaciante", "un"], ["Água sanitária", "L"],
    ["Desinfetante", "L"], ["Limpador multiuso", "un"], ["Esponja de aço", "pct"], ["Esponja de louça", "un"],
    ["Álcool líquido", "L"], ["Pano de chão", "un"], ["Vassoura", "un"], ["Rodo", "un"], ["Saco de lixo", "pct"],
    ["Inseticida", "un"], ["Papel filme", "rolo"], ["Papel alumínio", "rolo"], ["Guardanapo", "pct"], ["Fósforo", "cx"],
    ["Vela", "un"], ["Pilha AA", "cartela"], ["Pilha AAA", "cartela"], ["Ração para cão", "kg"], ["Ração para gato", "kg"],
  ]);

  add("Bebidas", [
    ["Água mineral 500ml", "un"], ["Água mineral 1,5L", "un"], ["Galão de água 20L", "un"], ["Refrigerante 2L", "un"],
    ["Refrigerante lata", "lata"], ["Guaraná 2L", "un"], ["Suco de caixinha", "un"], ["Suco concentrado", "un"],
    ["Cerveja lata", "lata"], ["Cerveja long neck", "un"], ["Cerveja 600ml", "un"], ["Vinho tinto", "un"],
    ["Vinho branco", "un"], ["Espumante", "un"], ["Cachaça", "un"], ["Whisky", "un"], ["Vodka", "un"], ["Gin", "un"],
    ["Energético", "lata"], ["Isotônico", "un"], ["Água de coco", "un"], ["Leite fermentado", "un"], ["Chá gelado", "un"],
    ["Água tônica", "un"], ["Café solúvel", "un"], ["Gelo", "saco"],
  ]);

  add("Combustível", [
    ["Gasolina comum", "L", "Gasolina"], ["Gasolina aditivada", "L", "Gasolina"],
    ["Diesel S10", "L", "Diesel"], ["Diesel S500", "L", "Diesel"], ["Arla 32", "L", "Diesel"],
    ["Gás de cozinha P13", "un", "Gás"], ["Gás de cozinha P20", "un", "Gás"], ["Gás de cozinha P45", "un", "Gás"],
  ], true);

  add("Material de manutenção", [
    ["Parafuso", "un"], ["Prego", "kg"], ["Bucha", "un"], ["Porca", "un"], ["Arruela", "un"], ["Fita isolante", "rolo"],
    ["Fita veda rosca", "rolo"], ["Cola instantânea", "un"], ["Cola de madeira", "un"], ["Silicone", "tubo"],
    ["Arame recozido", "kg"], ["Arame farpado", "rolo"], ["Tela de alambrado", "m"], ["Madeira pinus", "m"], ["Tábua", "un"],
    ["Sarrafo", "un"], ["Compensado", "un"], ["Cimento", "saco"], ["Areia", "saco"], ["Brita", "saco"], ["Cal", "saco"],
    ["Tijolo", "un"], ["Telha", "un"], ["Cano PVC", "m"], ["Conexão PVC", "un"], ["Torneira", "un"], ["Registro", "un"],
    ["Fio elétrico 2,5mm", "m"], ["Fio elétrico 4mm", "m"], ["Tomada", "un"], ["Interruptor", "un"], ["Disjuntor", "un"],
    ["Lâmpada LED", "un"], ["Lixa", "un"], ["Broca", "un"], ["Disco de corte", "un"], ["Rolo de pintura", "un"],
    ["Pincel", "un"], ["Tinta", "un"], ["Massa corrida", "un"], ["Verniz", "un"], ["Solvente", "L"], ["Estopa", "kg"],
    ["Corrente", "m"], ["Cadeado", "un"], ["Dobradiça", "un"], ["Fechadura", "un"], ["Mangueira", "m"],
    ["Abraçadeira", "un"], ["Eletroduto", "m"], ["Fita métrica", "un"], ["Serra", "un"], ["Luva de proteção", "par"],
  ]);

  return out;
}

export default function App() {
  // --- Autenticação ---
  const [session, setSession] = useState(undefined); // undefined = carregando; null = deslogado
  const [perfil, setPerfil] = useState(undefined);   // undefined = carregando; "removido" = sem acesso; objeto = ok

  // --- Dados ---
  const [carregado, setCarregado] = useState(false);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [estoque, setEstoque] = useState({});
  const [movs, setMovs] = useState([]);

  // --- UI ---
  const [aba, setAba] = useState("tarefas");
  const [filtro, setFiltro] = useState("todas");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [infoAberto, setInfoAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [temAtualizacao, setTemAtualizacao] = useState(false);
  const [produtosAberto, setProdutosAberto] = useState(false);
  const [avisos, setAvisos] = useState([]);

  const meIdRef = useRef(null);
  const timersRef = useRef({});
  const seedRef = useRef(false);

  const eu = perfil && typeof perfil === "object" ? perfil : null;
  const euId = eu?.id || null;
  const souAdmin = eu?.papel === "admin";
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // ---------- Recarregadores (usados no primeiro load e no realtime) ----------
  const reloadPerfis = useCallback(async () => {
    const { data, error } = await supabase.from("perfis").select("*").order("nome");
    if (error) return;
    const lista = (data || []).map(mapPerfil);
    setUsers(lista);
    // Se o meu próprio perfil sumiu ou foi desativado, cai para "Acesso removido".
    const meu = lista.find((u) => u.id === meIdRef.current);
    if (meIdRef.current && (!meu || meu.ativo === false)) setPerfil("removido");
    else if (meu) setPerfil(meu);
  }, []);

  const reloadProdutos = useCallback(async () => {
    const { data, error } = await supabase.from("produtos").select("*").order("nome");
    if (!error) setProdutos((data || []).map(mapProduto));
  }, []);

  const reloadEstoque = useCallback(async () => {
    const { data, error } = await supabase.from("estoque").select("*");
    if (error) return;
    const map = {};
    (data || []).forEach((r) => { map[r.produto_id] = Number(r.quantidade) || 0; });
    setEstoque(map);
  }, []);

  const reloadMovs = useCallback(async () => {
    const { data, error } = await supabase.from("movimentacoes").select("*").order("criado_em", { ascending: false }).limit(150);
    if (!error) setMovs((data || []).map(mapMov));
  }, []);

  const reloadTarefas = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from("tarefas").select("*"),
      supabase.from("compra_itens").select("*"),
      supabase.from("conclusoes").select("*"),
    ]);
    if (a.error) return;
    setTasks(buildTarefas(a.data, b.data, c.data));
  }, []);

  // Evita "tempestade" de recargas quando chegam muitos eventos juntos (ex.: seed).
  const debounced = useCallback((key, fn, ms = 250) => {
    clearTimeout(timersRef.current[key]);
    timersRef.current[key] = setTimeout(fn, ms);
  }, []);

  // ---------- Sessão de login ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------- Carrega o perfil da pessoa logada ----------
  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setPerfil(null); meIdRef.current = null; setCarregado(false); return; }
    meIdRef.current = session.user.id;
    (async () => {
      const { data } = await supabase.from("perfis").select("*").eq("id", session.user.id).maybeSingle();
      if (!data || data.ativo === false) setPerfil("removido");
      else setPerfil(mapPerfil(data));
    })();
  }, [session]);

  // ---------- Primeiro carregamento dos dados + Realtime ----------
  useEffect(() => {
    if (!eu) return;
    let vivo = true;
    (async () => {
      // Semeia a base de produtos apenas se a tabela estiver vazia.
      if (!seedRef.current) {
        seedRef.current = true;
        const { count } = await supabase.from("produtos").select("id", { count: "exact", head: true });
        if ((count || 0) === 0) {
          await supabase.from("produtos").insert(produtosSeed());
        }
      }
      await Promise.all([reloadPerfis(), reloadProdutos(), reloadEstoque(), reloadMovs(), reloadTarefas()]);
      if (vivo) setCarregado(true);
    })();

    const ch = supabase.channel("rancho-abdalla")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, () => debounced("t", reloadTarefas))
      .on("postgres_changes", { event: "*", schema: "public", table: "compra_itens" }, () => debounced("t", reloadTarefas))
      .on("postgres_changes", { event: "*", schema: "public", table: "conclusoes" }, () => debounced("t", reloadTarefas))
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, () => debounced("p", reloadProdutos))
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque" }, () => debounced("e", reloadEstoque))
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => debounced("m", reloadMovs))
      .on("postgres_changes", { event: "*", schema: "public", table: "perfis" }, () => debounced("u", reloadPerfis))
      .subscribe();

    return () => { vivo = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [euId]);

  const sair = async () => { await supabase.auth.signOut(); setPerfil(null); };

  // ---------- Lembretes locais (15 min antes) ----------
  useEffect(() => {
    if (!carregado || !euId) return;
    const check = () => {
      const agora = new Date(); const iso = hojeISO();
      tasks.forEach((t) => {
        if (!t.horaInicio || t.responsavelId !== euId) return;
        if (!aplicaHoje(t, iso) || isConcluida(t, iso)) return;
        const [h, m] = t.horaInicio.split(":").map(Number);
        const inicio = new Date(); inicio.setHours(h, m, 0, 0);
        const diff = (inicio - agora) / 60000;
        if (diff <= 15 && diff >= -1 && !avisos.some((a) => a.id === t.id)) {
          setAvisos((p) => [...p, { id: t.id, titulo: t.titulo, hora: t.horaInicio }]);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") { try { new Notification("Abdalla Home — tarefa em breve", { body: `${t.titulo} às ${t.horaInicio}` }); } catch (e) {} }
        }
      });
    };
    check(); const iv = setInterval(check, 30000); return () => clearInterval(iv);
  }, [carregado, tasks, euId, avisos]);

  // Se deixar de ser admin (ex.: rebaixado em tempo real), sai das abas restritas.
  useEffect(() => {
    if (!souAdmin && (aba === "painel" || aba === "equipe")) setAba("tarefas");
  }, [souAdmin, aba]);

  // Ativa os lembretes: pede permissão e inscreve ESTE aparelho para receber avisos
  // mesmo com o app fechado (web push). A inscrição fica salva em "push_subs".
  // ---------- Aviso de nova versão ----------
  // Confere o version.json publicado; se o número for diferente do que está
  // rodando, mostra a barra "Atualizar" (ao entrar, ao voltar ao app e de tempos
  // em tempos). Não roda em desenvolvimento (sem version.json).
  useEffect(() => {
    if (APP_BUILD === "dev") return;
    let vivo = true;
    const conferir = async () => {
      try {
        const r = await fetch(import.meta.env.BASE_URL + "version.json?ts=" + Date.now(), { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (vivo && j?.id && j.id !== APP_BUILD) setTemAtualizacao(true);
      } catch { /* sem rede: tenta na próxima */ }
    };
    conferir();
    const iv = setInterval(conferir, 5 * 60 * 1000);
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; clearInterval(iv); document.removeEventListener("visibilitychange", aoVoltar); };
  }, []);

  const atualizarAgora = async () => {
    try { if ("caches" in window) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } } catch { /* ok */ }
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update(); } catch { /* ok */ }
    // Recarrega furando o cache do navegador (URL única).
    window.location.href = import.meta.env.BASE_URL + "?v=" + Date.now();
  };

  const pedirNotificacao = async () => {
    if (typeof Notification === "undefined") { showToast("Notificações não disponíveis neste navegador"); return; }
    // iPhone só entrega push quando o app está instalado na tela inicial.
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (iOS && window.navigator.standalone === false) { showToast("No iPhone, primeiro instale o app na tela inicial (Safari → Compartilhar → Adicionar à Tela de Início) e abra por lá."); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { showToast(perm === "denied" ? "As notificações estão bloqueadas nas configurações do navegador." : "Lembretes não ativados"); return; }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { showToast("Lembretes ativados só com o app aberto (este navegador não suporta avisos com o app fechado)."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
      const j = sub.toJSON();
      const { error } = await supabase.from("push_subs").upsert(
        { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: euId },
        { onConflict: "endpoint" }
      );
      if (error) { showToast("Ativou aqui, mas não deu para salvar no servidor: " + error.message); return; }
      showToast("Lembretes ativados neste celular!");
    } catch (e) {
      showToast("Não foi possível ativar os lembretes: " + (e?.message || e));
    }
  };

  // ---------- Mutações (gravam no Supabase; o realtime propaga aos outros) ----------
  async function salvarTarefa(dados) {
    const row = tarefaRow(dados);
    if (dados.id) {
      const { error } = await supabase.from("tarefas").update(row).eq("id", dados.id);
      if (error) { showToast("Erro ao salvar"); return; }
      if (dados.ehCompra) {
        await supabase.from("compra_itens").delete().eq("tarefa_id", dados.id);
        const itens = itensDaCompra(dados).filter((i) => i.produtoId && parseFloat(i.quantidade) > 0);
        if (itens.length) await supabase.from("compra_itens").insert(itens.map((i) => ({ tarefa_id: dados.id, produto_id: i.produtoId, quantidade: parseFloat(i.quantidade) })));
      }
      showToast("Tarefa atualizada");
    } else {
      const { data, error } = await supabase.from("tarefas").insert({ ...row, criado_por_id: euId, status: "pendente" }).select().single();
      if (error) { showToast("Erro ao criar"); return; }
      if (dados.ehCompra) {
        const itens = itensDaCompra(dados).filter((i) => i.produtoId && parseFloat(i.quantidade) > 0);
        if (itens.length) await supabase.from("compra_itens").insert(itens.map((i) => ({ tarefa_id: data.id, produto_id: i.produtoId, quantidade: parseFloat(i.quantidade) })));
      }
      showToast("Tarefa criada");
    }
    reloadTarefas();
    setModal(null);
  }

  async function concluirTarefa(t, fotoUrl) {
    const iso = hojeISO();
    if (t.tipo === "unica") {
      await supabase.from("tarefas").update({ status: "concluida", concluida_em: new Date().toISOString(), foto_conclusao_url: fotoUrl || t.fotoConclusaoUrl || null, concluida_por_id: euId }).eq("id", t.id);
    } else {
      await supabase.from("conclusoes").upsert({ tarefa_id: t.id, data: iso, user_id: euId, foto_url: fotoUrl || null }, { onConflict: "tarefa_id,data" });
    }
    const itensC = t.ehCompra ? itensDaCompra(t) : [];
    if (itensC.length) {
      // Só entra no estoque na PRIMEIRA conclusão desta ordem de compra.
      const { data: atual } = await supabase.from("tarefas").select("estoque_aplicado").eq("id", t.id).maybeSingle();
      if (!atual?.estoque_aplicado) {
        await aplicarMovimentos(itensC.map((it) => ({ produtoId: it.produtoId, quantidade: it.quantidade })), "entrada", "compra");
        await supabase.from("tarefas").update({ estoque_aplicado: true }).eq("id", t.id);
        showToast(itensC.length === 1 ? "Compra concluída • item no estoque" : `Compra concluída • ${itensC.length} itens no estoque`);
      } else {
        showToast("Compra concluída (já estava no estoque)");
      }
    } else showToast("Tarefa concluída ✓");
    setAvisos((p) => p.filter((a) => a.id !== t.id));
    reloadTarefas();
  }

  async function reabrir(t) {
    const iso = hojeISO();
    if (t.tipo === "unica") await supabase.from("tarefas").update({ status: "pendente", concluida_em: null, concluida_por_id: null }).eq("id", t.id);
    else await supabase.from("conclusoes").delete().eq("tarefa_id", t.id).eq("data", iso);
    reloadTarefas();
  }

  async function excluirTarefa(id) {
    await supabase.from("compra_itens").delete().eq("tarefa_id", id);
    await supabase.from("conclusoes").delete().eq("tarefa_id", id);
    await supabase.from("tarefas").delete().eq("id", id);
    reloadTarefas();
    showToast("Tarefa excluída");
  }

  async function trocarResponsavel(t, novoId) {
    await supabase.from("tarefas").update({ responsavel_id: novoId || null }).eq("id", t.id);
    reloadTarefas();
    showToast("Responsável alterado");
  }

  // Move o estoque buscando a quantidade atual no banco (evita divergência entre celulares).
  async function aplicarMovimento(produtoId, tipo, quantidade, origem) {
    const qtd = Math.abs(parseFloat(quantidade) || 0);
    if (!produtoId || qtd <= 0) return;
    const { data } = await supabase.from("estoque").select("quantidade").eq("produto_id", produtoId).maybeSingle();
    const atual = Number(data?.quantidade) || 0;
    const novo = tipo === "saida" ? Math.max(0, atual - qtd) : atual + qtd;
    await supabase.from("estoque").upsert({ produto_id: produtoId, quantidade: novo }, { onConflict: "produto_id" });
    await supabase.from("movimentacoes").insert({ produto_id: produtoId, tipo, qtd: Math.abs(novo - atual) || qtd, origem: origem || "manual", user_id: euId });
    reloadEstoque(); reloadMovs();
  }

  async function aplicarMovimentos(lista, tipo, origem) {
    const validos = (lista || []).filter((m) => m.produtoId && (parseFloat(m.quantidade) || 0) > 0);
    if (!validos.length) return;
    const ids = [...new Set(validos.map((m) => m.produtoId))];
    const { data } = await supabase.from("estoque").select("produto_id, quantidade").in("produto_id", ids);
    const cur = {}; (data || []).forEach((r) => { cur[r.produto_id] = Number(r.quantidade) || 0; });
    const ups = {}; const novasMovs = [];
    validos.forEach((m) => {
      const qtd = Math.abs(parseFloat(m.quantidade) || 0);
      const base = ups[m.produtoId] != null ? ups[m.produtoId] : (cur[m.produtoId] || 0);
      ups[m.produtoId] = tipo === "saida" ? Math.max(0, base - qtd) : base + qtd;
      novasMovs.push({ produto_id: m.produtoId, tipo, qtd, origem: origem || "manual", user_id: euId });
    });
    await supabase.from("estoque").upsert(Object.entries(ups).map(([produto_id, quantidade]) => ({ produto_id, quantidade })), { onConflict: "produto_id" });
    if (novasMovs.length) await supabase.from("movimentacoes").insert(novasMovs);
    reloadEstoque(); reloadMovs();
  }

  function saidaRapida(p) {
    Dialog.prompt({ titulo: "Registrar saída", mensagem: "Quanto saiu de " + p.nome + "? (" + p.unidade + ")", valor: "", inputType: "number", okLabel: "Registrar saída" }).then((v) => {
      const q = parseFloat(v);
      if (v !== null && v !== "" && q > 0) { aplicarMovimento(p.id, "saida", q, "manual"); showToast("Saída: " + q + " " + p.unidade + " de " + p.nome); }
    });
  }

  async function cadastrarProduto(p) {
    const { data, error } = await supabase.from("produtos").insert({ nome: p.nome, categoria: p.categoria, subcategoria: p.subcategoria || "", unidade: p.unidade }).select().single();
    if (error || !data) { showToast("Erro ao cadastrar produto"); return null; }
    reloadProdutos();
    return mapProduto(data);
  }
  async function removerProduto(id) {
    await supabase.from("estoque").delete().eq("produto_id", id);
    await supabase.from("produtos").delete().eq("id", id);
    reloadProdutos(); reloadEstoque();
  }
  async function renomearProduto(id, nome) {
    await supabase.from("produtos").update({ nome }).eq("id", id);
    reloadProdutos();
  }
  async function ajustarEstoque(produtoId, valor) {
    await supabase.from("estoque").upsert({ produto_id: produtoId, quantidade: Math.max(0, valor) }, { onConflict: "produto_id" });
    reloadEstoque();
  }

  // ---------- Telas de porta de entrada ----------
  if (session === undefined || perfil === undefined) return <TelaCarregando />;
  if (!session) return (<><LoginScreen /><DialogHost /></>);
  if (perfil === "removido") return (<><AcessoRemovido onSair={sair} /><DialogHost /></>);
  if (!carregado) return <TelaCarregando />;

  const ABAS = [
    { id: "tarefas", nome: "Tarefas", icon: ListTodo },
    { id: "agenda", nome: "Agenda", icon: CalendarDays },
    { id: "compras", nome: "Compras", icon: ShoppingCart },
    { id: "estoque", nome: "Estoque", icon: Package },
    ...(souAdmin ? [{ id: "painel", nome: "Painel", icon: BarChart3 }, { id: "equipe", nome: "Equipe", icon: Users }] : []),
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: C.terra }}>
      <div className="mx-auto" style={{ maxWidth: 460, position: "relative", minHeight: "100vh", paddingBottom: 88, background: C.bg }}>

        <header style={{ background: C.pastoEsc, color: "#fff", padding: "14px 16px 14px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{ background: "#ffffff22", borderRadius: 12, padding: 7 }}><MapPin size={20} /></div>
              <div><div className="font-bold text-lg leading-tight">Abdalla Home</div><div style={{ color: "#ffffffcc" }} className="text-xs leading-tight">Rancho Abdalla</div></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={pedirNotificacao} title="Ativar lembretes" style={{ background: "#ffffff22", borderRadius: 10, padding: 8 }}><Bell size={18} /></button>
              <div className="relative">
                <button onClick={() => setMenuAberto((v) => !v)} title="Mais opções" style={{ background: "#ffffff22", borderRadius: 10, padding: 8, display: "flex" }}><MoreVertical size={18} /></button>
                {menuAberto && (<>
                  <div onClick={() => setMenuAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 44 }} />
                  <div style={{ position: "absolute", top: 42, right: 0, background: "#fff", color: C.terra, border: `1px solid ${C.linha}`, borderRadius: 12, boxShadow: "0 8px 22px #0003", zIndex: 45, minWidth: 210, overflow: "hidden" }}>
                    {[
                      ...(!estaInstalado() ? [{ key: "inst", icon: ArrowDownToLine, cor: C.pasto, txt: "Instalar app", on: () => { setMenuAberto(false); _installOpen.fn && _installOpen.fn(); } }] : []),
                      ...(souAdmin ? [{ key: "sobre", icon: Info, cor: C.lago, txt: "Sobre a propriedade", on: () => { setMenuAberto(false); setInfoAberto(true); } }] : []),
                      { key: "sair", icon: LogOut, cor: C.vermelho, txt: "Sair", on: async () => { setMenuAberto(false); if (await Dialog.confirm({ titulo: "Sair", mensagem: "Deseja sair desta conta?", okLabel: "Sair" })) sair(); } },
                    ].map((it, i) => { const Ic = it.icon; return (
                      <button key={it.key} onClick={it.on} className="flex items-center gap-2" style={{ width: "100%", textAlign: "left", padding: "12px 14px", fontSize: 14, fontWeight: 600, color: it.cor === C.vermelho ? C.vermelho : C.terra, borderTop: i ? `1px solid ${C.linha}` : "none" }}><Ic size={16} style={{ color: it.cor }} /> {it.txt}</button>
                    ); })}
                  </div>
                </>)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2" style={{ background: "#ffffff1a", borderRadius: 12, padding: "8px 12px" }}>
            {souAdmin ? <Star size={16} /> : <User size={16} />}
            <div className="flex-1"><div className="text-xs" style={{ color: "#ffffffbb" }}>Conectado como</div><div className="font-bold leading-tight">{eu.nome} <span style={{ color: "#ffffffbb", fontWeight: 500, fontSize: 12 }}>· {papelLabel(eu.papel)}</span></div></div>
          </div>
        </header>

        {avisos.length > 0 && (
          <div className="px-3 pt-3">
            {avisos.map((a) => (
              <div key={a.id} style={{ background: C.ambarClaro, border: `1px solid ${C.ambar}55`, borderRadius: 12 }} className="p-3 mb-2 flex items-center gap-2">
                <Bell size={18} style={{ color: C.ambar }} /><div className="flex-1 text-sm"><b>Começa às {a.hora}:</b> {a.titulo}</div>
                <button onClick={() => setAvisos((p) => p.filter((x) => x.id !== a.id))}><X size={16} style={{ color: C.cinza }} /></button>
              </div>
            ))}
          </div>
        )}

        <main className="px-3 pt-3">
          {aba === "tarefas" && <TarefasView {...{ tasks, users, euId, souAdmin, meuSetor: eu?.setor || "", filtro, setFiltro, onConcluir: (t) => setModal({ tipo: "concluir", task: t }), onReabrir: reabrir, onEditar: (t) => setModal({ tipo: "tarefa", task: t }), onExcluir: excluirTarefa, onTrocar: trocarResponsavel, onAbrir: (t) => setModal({ tipo: "detalhe", task: t }) }} />}
          {aba === "agenda" && <AgendaView {...{ tasks, users, souAdmin, meuSetor: eu?.setor || "", euId }} />}
          {aba === "compras" && <ComprasView {...{ tasks, produtos, onConcluir: (t) => setModal({ tipo: "concluir", task: t }), onEditar: (t) => setModal({ tipo: "tarefa", task: t }), onExcluir: excluirTarefa, onReabrir: reabrir }} />}
          {aba === "estoque" && <EstoqueView {...{ produtos, estoque, movs, users, onAjustar: ajustarEstoque, onAbrirProdutos: () => setProdutosAberto(true), onMovimento: (mv) => setModal({ tipo: "movimento", mov: mv }), onSaidaRapida: saidaRapida }} />}
          {aba === "painel" && souAdmin && <PainelView {...{ tasks, users }} />}
          {aba === "equipe" && souAdmin && <EquipeView {...{ users, souAdmin, euId, showToast, onRecarregar: reloadPerfis }} />}
        </main>

        {(aba === "tarefas" || aba === "compras" || aba === "agenda") && (
          <button onClick={() => setModal({ tipo: "tarefa", task: null, ehCompra: aba === "compras" })} style={{ position: "fixed", right: "max(16px, calc(50% - 214px))", bottom: 100, background: C.pasto, color: "#fff", borderRadius: 999, padding: "14px 20px", boxShadow: "0 6px 18px #2f7d4f66", fontWeight: 700, display: "flex", alignItems: "center", gap: 7, zIndex: 30 }}><Plus size={20} /> {aba === "compras" ? "Nova compra" : "Nova tarefa"}</button>
        )}

        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.linha}`, zIndex: 40 }}>
          <div className="mx-auto flex" style={{ maxWidth: 460 }}>
            {ABAS.map((a) => {
              const Ic = a.icon; const ativo = aba === a.id;
              const badge = a.id === "compras" ? tasks.filter((t) => t.ehCompra && !isConcluida(t)).length : 0;
              return (
                <button key={a.id} onClick={() => setAba(a.id)} className="flex-1 flex flex-col items-center justify-center" style={{ padding: "9px 0 12px", color: ativo ? C.pasto : C.cinzaClaro, position: "relative" }}>
                  <Ic size={22} strokeWidth={ativo ? 2.4 : 2} /><span style={{ fontSize: 11, fontWeight: ativo ? 700 : 500, marginTop: 2 }}>{a.nome}</span>
                  {badge > 0 && <span style={{ position: "absolute", top: 4, right: "50%", marginRight: -22, background: C.vermelho, color: "#fff", borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{badge}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {modal?.tipo === "tarefa" && <TarefaModal {...{ task: modal.task, users, eu, produtos, ehCompraInicial: modal.ehCompra, onCadastrarProduto: cadastrarProduto, showToast, onFechar: () => setModal(null), onSalvar: salvarTarefa }} />}
        {modal?.tipo === "detalhe" && <DetalheTarefaModal {...{ t: modal.task, users, onFechar: () => setModal(null), onEditar: (t) => setModal({ tipo: "tarefa", task: t }) }} />}
        {modal?.tipo === "concluir" && <ConcluirModal {...{ task: modal.task, produtos, showToast, onFechar: () => setModal(null), onConfirmar: (fotoUrl) => { concluirTarefa(modal.task, fotoUrl); setModal(null); } }} />}
        {infoAberto && <InfoModal onFechar={() => setInfoAberto(false)} />}
        {produtosAberto && <ProdutosModal {...{ produtos, onCadastrar: cadastrarProduto, onRemover: removerProduto, onRenomear: renomearProduto, onFechar: () => setProdutosAberto(false) }} />}
        {modal?.tipo === "movimento" && <MovimentoModal {...{ tipo: modal.mov, produtos, estoque, onFechar: () => setModal(null), onAplicar: (lista) => { aplicarMovimentos(lista, modal.mov, "manual"); showToast((modal.mov === "saida" ? "Saída" : "Entrada") + " registrada (" + lista.length + (lista.length === 1 ? " item" : " itens") + ")"); setModal(null); } }} />}

        {toast && <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: C.terra, color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 60, boxShadow: "0 4px 14px #0003", whiteSpace: "nowrap" }}>{toast}</div>}
        {temAtualizacao && (
          <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 74, width: "calc(100% - 24px)", maxWidth: 436, background: C.pastoEsc, color: "#fff", borderRadius: 14, padding: "10px 12px", zIndex: 65, boxShadow: "0 8px 22px #0004", display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={18} style={{ flexShrink: 0 }} />
            <div className="flex-1" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>Nova versão disponível</div>
            <button onClick={() => setTemAtualizacao(false)} title="Agora não" style={{ color: "#ffffffcc", padding: 4 }}><X size={18} /></button>
            <button onClick={atualizarAgora} style={{ background: "#fff", color: C.pastoEsc, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 14 }}>Atualizar</button>
          </div>
        )}
        <InstalarPrompt />
        <DialogHost />
      </div>
    </div>
  );
}

/* ===================== TELAS DE ENTRADA ===================== */
function TelaCarregando() {
  return (<div style={{ background: C.bg, color: C.terra, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}><div className="text-center"><div style={{ color: C.pasto }} className="font-bold text-2xl">Abdalla Home</div><div style={{ color: C.cinza }} className="text-sm mt-1">Carregando…</div></div></div>);
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const entrar = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !senha) return;
    setEntrando(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErro(/invalid login/i.test(error.message) ? "E-mail ou senha incorretos." : "Não foi possível entrar: " + error.message);
    setEntrando(false);
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: C.terra, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <form onSubmit={entrar} className="mx-auto w-full px-5" style={{ maxWidth: 400 }}>
        <div className="text-center mb-6">
          <div style={{ background: C.pastoEsc, borderRadius: 18, width: 62, height: 62, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><MapPin size={30} color="#fff" /></div>
          <div className="font-bold text-2xl" style={{ color: C.pastoEsc }}>Abdalla Home</div>
          <div style={{ color: C.cinza }} className="text-sm mt-1">Entre com seu e-mail e senha do Rancho Abdalla.</div>
        </div>
        <div style={lblSt}>E-mail</div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Mail size={16} style={{ position: "absolute", left: 11, top: 13, color: C.cinzaClaro }} />
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" style={{ ...inpSt, paddingLeft: 34 }} />
        </div>
        <div style={lblSt}>Senha</div>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <KeyRound size={16} style={{ position: "absolute", left: 11, top: 13, color: C.cinzaClaro }} />
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Sua senha" style={{ ...inpSt, paddingLeft: 34 }} />
        </div>
        {erro && <div style={{ color: C.vermelho, fontSize: 13 }} className="mb-2">{erro}</div>}
        <button type="submit" disabled={entrando || !email.trim() || !senha} style={{ width: "100%", background: entrando || !email.trim() || !senha ? C.cinzaClaro : C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16, marginTop: 6 }}>{entrando ? "Entrando…" : "Entrar"}</button>
        <div style={{ color: C.cinzaClaro, fontSize: 11.5 }} className="text-center mt-4 flex items-center justify-center gap-1"><Lock size={12} /> O acesso é liberado pelo administrador do rancho.</div>
      </form>
    </div>
  );
}

function AcessoRemovido({ onSair }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: C.terra, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="mx-auto w-full px-5 text-center" style={{ maxWidth: 400 }}>
        <div style={{ background: C.vermelhoClaro, borderRadius: 18, width: 66, height: 66, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Lock size={30} style={{ color: C.vermelho }} /></div>
        <div className="font-bold text-2xl" style={{ color: C.terra }}>Acesso removido</div>
        <div style={{ color: C.cinza }} className="text-sm mt-2 px-2">Sua conta não faz mais parte da equipe ou foi desativada. Fale com o administrador do Rancho Abdalla para liberar o acesso novamente.</div>
        <button onClick={onSair} style={{ marginTop: 22, background: C.pasto, color: "#fff", borderRadius: 12, padding: "13px 22px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}><LogOut size={17} /> Sair</button>
      </div>
    </div>
  );
}

/* ============================= TAREFAS ============================= */
function TarefasView({ tasks, users, euId, souAdmin, meuSetor, filtro, setFiltro, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }) {
  let lista = tasks.filter((t) => !t.ehCompra);
  // Colaborador só enxerga o próprio setor (e o que estiver no nome dele).
  if (!souAdmin) lista = lista.filter((t) => (meuSetor && t.setor === meuSetor) || t.responsavelId === euId);
  if (filtro === "minhas") lista = lista.filter((t) => t.responsavelId === euId);
  else if (filtro.startsWith("setor:")) { const s = filtro.slice(6); lista = lista.filter((t) => t.setor === s); }
  const pendentes = lista.filter((t) => !isConcluida(t));
  const feitas = lista.filter((t) => isConcluida(t));
  const filtros = souAdmin
    ? [{ id: "todas", n: "Todas" }, { id: "minhas", n: "Minhas" }, ...SETORES.map((s) => ({ id: "setor:" + s.id, n: s.id }))]
    : [{ id: "todas", n: "Todas" }, { id: "minhas", n: "Minhas" }];
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {filtros.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{ background: filtro === f.id ? C.pasto : C.card, color: filtro === f.id ? "#fff" : C.cinza, border: `1px solid ${filtro === f.id ? C.pasto : C.linha}`, borderRadius: 999, padding: "6px 16px", fontWeight: 600, fontSize: 13 }}>{f.n}</button>
        ))}
      </div>
      {lista.length === 0 && <Vazio icon={ListTodo} titulo="Nenhuma tarefa ainda" texto="Toque em “Nova tarefa” para começar a organizar o rancho." />}
      {pendentes.map((t) => <CardTarefa key={t.id} {...{ t, users, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }} />)}
      {feitas.length > 0 && (<div className="mt-4"><div style={{ color: C.cinza }} className="text-xs font-semibold mb-2 uppercase">Concluídas hoje</div>{feitas.map((t) => <CardTarefa key={t.id} {...{ t, users, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }} />)}</div>)}
    </div>
  );
}
function CardTarefa({ t, users, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }) {
  const iso = hojeISO();
  const feito = isConcluida(t, iso);
  const [abrirResp, setAbrirResp] = useState(false);
  const [zoom, setZoom] = useState(false);
  // Quem realizou (por dia nas recorrentes; direto nas únicas).
  const concluinteId = t.tipo === "unica" ? t.concluidaPorId : (t.conclusoes && t.conclusoes[iso] ? t.conclusoes[iso].userId : null);
  const concluinte = feito && concluinteId ? nomeUser(users, concluinteId) : null;
  const coberto = !!concluinte && concluinteId !== t.responsavelId;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16, opacity: feito ? 0.72 : 1 }} className="p-3 mb-2.5">
      <div className="flex gap-3">
        <button onClick={() => (feito ? onReabrir(t) : onConcluir(t))} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, border: `2px solid ${feito ? C.pasto : C.cinzaClaro}`, background: feito ? C.pasto : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{feito && <Check size={18} color="#fff" strokeWidth={3} />}</button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onAbrir && onAbrir(t)} style={{ display: "block", width: "100%", textAlign: "left" }}>
            <div style={{ textDecoration: feito ? "line-through" : "none", fontWeight: 600, fontSize: 15.5, lineHeight: 1.25 }}>{t.titulo}</div>
            {t.descricao && <div style={{ color: C.cinza }} className="text-sm mt-0.5">{t.descricao}</div>}
          </button>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
            {t.setor && <Chip icon={Users} texto={t.setor} cor={setorCor(t.setor)} />}
            {t.tipo === "recorrente" && <Chip icon={Repeat} texto={textoRecorrencia(t)} cor={C.lago} />}
            {(t.horaInicio || t.horaFim) && <Chip icon={Clock} texto={`${t.horaInicio || "?"}${t.horaFim ? "–" + t.horaFim : ""}`} cor={C.ambar} />}
            {t.tipo === "unica" && t.data && <Chip icon={CalendarDays} texto={fmtData(t.data)} cor={C.cinza} />}
          </div>
          {t.imagemUrl && (
            <button onClick={() => setZoom(true)} title="Ver foto da tarefa" style={{ display: "block", position: "relative", width: "100%", marginTop: 8, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.linha}` }}>
              <img src={t.imagemUrl} alt="Foto de referência da tarefa" style={{ display: "block", maxHeight: 130, width: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", right: 8, bottom: 8, background: "#0009", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Search size={12} /> Ver foto</span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="relative">
              <button onClick={() => setAbrirResp((v) => !v)} title="Responsável (de quem é a tarefa)" style={{ background: C.pastoClaro, color: C.pastoEsc, borderRadius: 999, padding: "4px 11px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><User size={13} /> {nomeUser(users, t.responsavelId)} <RefreshCw size={11} /></button>
              {abrirResp && (
                <div style={{ position: "absolute", top: 34, left: 0, background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 12, boxShadow: "0 6px 18px #0002", zIndex: 20, minWidth: 180, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", fontSize: 11, color: C.cinza, borderBottom: `1px solid ${C.linha}` }}>Passar para:</div>
                  {users.filter((u) => u.ativo !== false).map((u) => <button key={u.id} onClick={() => { onTrocar(t, u.id); setAbrirResp(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 14, background: t.responsavelId === u.id ? C.pastoClaro : "#fff" }}>{u.nome}</button>)}
                </div>
              )}
            </div>
            {concluinte && (
              <span title="Quem realizou a tarefa" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: coberto ? C.ambar : C.pasto, color: "#fff", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                <Check size={12} strokeWidth={3} /> Feito por {concluinte}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button onClick={() => onEditar(t)} style={{ color: C.cinza, padding: 4 }}><Pencil size={17} /></button>
          <button onClick={async () => { if (await Dialog.confirm({ titulo: "Excluir tarefa", mensagem: "Deseja excluir esta tarefa?", okLabel: "Excluir", perigo: true })) onExcluir(t.id); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={17} /></button>
        </div>
      </div>
      {zoom && t.imagemUrl && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, background: "#000000e8", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={t.imagemUrl} alt="Foto de referência da tarefa" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
          <button onClick={() => setZoom(false)} title="Fechar" style={{ position: "fixed", top: 16, right: 16, background: "#ffffff26", color: "#fff", borderRadius: 999, padding: 10, display: "flex" }}><X size={22} /></button>
        </div>
      )}
    </div>
  );
}

/* ============================= AGENDA ============================= */
function AgendaView({ tasks, users, souAdmin, meuSetor, euId }) {
  const hoje = hojeISO();
  const doDia = tasks
    .filter((t) => !t.ehCompra && aplicaHoje(t, hoje))
    .filter((t) => souAdmin || (meuSetor && t.setor === meuSetor) || t.responsavelId === euId)
    .sort((a, b) => (a.horaInicio || "99:99").localeCompare(b.horaInicio || "99:99"));
  const dataBr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return (
    <div>
      <div style={{ background: C.lagoClaro, borderRadius: 14 }} className="p-3 mb-3"><div style={{ color: C.lago }} className="text-xs font-semibold uppercase">Cronograma de hoje</div><div className="font-bold text-lg capitalize" style={{ color: C.pastoEsc }}>{dataBr}</div></div>
      {doDia.length === 0 && <Vazio icon={CalendarDays} titulo="Nada agendado para hoje" texto="Tarefas com horário aparecem aqui em ordem." />}
      {doDia.map((t) => {
        const feito = isConcluida(t, hoje);
        return (
          <div key={t.id} className="flex gap-3 mb-2.5">
            <div style={{ width: 54, flexShrink: 0, textAlign: "right", paddingTop: 12 }}><div style={{ fontWeight: 700, fontSize: 14, color: C.terra }}>{t.horaInicio || "—"}</div>{t.horaFim && <div style={{ fontSize: 11, color: C.cinzaClaro }}>{t.horaFim}</div>}</div>
            <div style={{ width: 2, background: C.linha, position: "relative" }}><div style={{ position: "absolute", top: 14, left: -4, width: 10, height: 10, borderRadius: 999, background: feito ? C.pasto : C.ambar, border: "2px solid #fff" }} /></div>
            <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, opacity: feito ? 0.7 : 1 }} className="flex-1 p-3">
              <div style={{ fontWeight: 600, textDecoration: feito ? "line-through" : "none" }}>{t.titulo}</div>
              <div className="flex items-center gap-1 mt-1" style={{ color: C.cinza, fontSize: 12.5 }}><User size={12} /> {nomeUser(users, t.responsavelId)}{t.tipo === "recorrente" && <><Repeat size={12} style={{ marginLeft: 6 }} /> recorrente</>}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================= COMPRAS ============================= */
function ComprasView({ tasks, produtos, onConcluir, onEditar, onExcluir, onReabrir }) {
  const compras = tasks.filter((t) => t.ehCompra);
  const pendentes = compras.filter((t) => !isConcluida(t));
  const feitas = compras.filter((t) => isConcluida(t));
  const prodDe = (id) => produtos.find((p) => p.id === id);
  return (
    <div>
      <div style={{ background: C.ambarClaro, borderRadius: 14 }} className="p-3 mb-3"><div style={{ color: C.ambar }} className="text-xs font-semibold uppercase">Lista de compras</div><div style={{ color: C.terra }} className="text-sm mt-0.5">Tudo que precisa comprar para levar ao rancho. Ao concluir, entra no estoque.</div></div>
      {compras.length === 0 && <Vazio icon={ShoppingCart} titulo="Nenhuma compra pendente" texto="Qualquer pessoa pode abrir um pedido de compra em “Nova compra”." />}
      {pendentes.map((t) => {
        const itens = itensDaCompra(t);
        return (
          <div key={t.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="p-3 mb-2.5 flex items-start gap-3">
            <button onClick={() => onConcluir(t)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, border: `2px solid ${C.cinzaClaro}`, marginTop: 2 }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold" style={{ fontSize: 15 }}>{t.titulo}</div>
              <div className="flex flex-col gap-1 mt-1.5">
                {itens.map((it, i) => { const p = prodDe(it.produtoId); return (<div key={i} className="flex items-center gap-2 text-sm"><span style={{ width: 6, height: 6, borderRadius: 999, background: C.ambar, flexShrink: 0 }} /><span className="flex-1 min-w-0 truncate">{p ? p.nome : "Produto"}{p?.subcategoria ? " · " + p.subcategoria : ""}</span><b style={{ color: C.pastoEsc, whiteSpace: "nowrap" }}>{it.quantidade} {p?.unidade || ""}</b></div>); })}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => onEditar(t)} style={{ color: C.cinza, padding: 4 }}><Pencil size={16} /></button>
              <button onClick={async () => { if (await Dialog.confirm({ titulo: "Excluir", mensagem: "Deseja excluir?", okLabel: "Excluir", perigo: true })) onExcluir(t.id); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>
            </div>
          </div>
        );
      })}
      {feitas.length > 0 && (
        <div className="mt-4"><div style={{ color: C.cinza }} className="text-xs font-semibold mb-2 uppercase">Compradas</div>
          {feitas.map((t) => (
            <div key={t.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, opacity: 0.7 }} className="p-3 mb-2 flex items-center gap-3">
              <button onClick={() => onReabrir(t)} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: C.pasto, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} color="#fff" strokeWidth={3} /></button>
              <div className="flex-1 font-medium" style={{ textDecoration: "line-through" }}>{t.titulo}</div>
              <button onClick={async () => { if (await Dialog.confirm({ titulo: "Excluir", mensagem: "Deseja excluir?", okLabel: "Excluir", perigo: true })) onExcluir(t.id); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================= ESTOQUE ============================= */
function EstoqueView({ produtos, estoque, movs, users, onAjustar, onAbrirProdutos, onMovimento, onSaidaRapida }) {
  const nomeProd = (id) => (produtos.find((p) => p.id === id) || {}).nome || "Produto";
  const nomePessoa = (id) => { const u = users.find((x) => x.id === id); return u ? u.nome : ""; };
  const quando = (ts) => { if (!ts) return ""; const d = Math.floor((Date.now() - ts) / 60000); if (d < 1) return "agora"; if (d < 60) return d + " min"; const h = Math.floor(d / 60); if (h < 24) return h + " h"; return Math.floor(h / 24) + " d"; };
  return (
    <div>
      <div style={{ background: C.pastoClaro, borderRadius: 14 }} className="p-3 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div><div style={{ color: C.pastoEsc }} className="text-xs font-semibold uppercase">Controle de estoque</div><div style={{ color: C.terra }} className="text-sm mt-0.5">Entrada automática pelas compras. Registre aqui as saídas de consumo.</div></div>
          <button onClick={onAbrirProdutos} style={{ background: "#fff", color: C.pastoEsc, border: `1px solid ${C.pasto}`, borderRadius: 999, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Tag size={14} /> Produtos</button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => onMovimento("entrada")} style={{ flex: 1, background: C.pasto, color: "#fff", borderRadius: 10, padding: "11px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><ArrowDownToLine size={17} /> Entrada</button>
          <button onClick={() => onMovimento("saida")} style={{ flex: 1, background: C.vermelho, color: "#fff", borderRadius: 10, padding: "11px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><ArrowUpFromLine size={17} /> Saída</button>
        </div>
      </div>
      {CATEGORIAS.map((cat) => {
        const Ic = cat.icon;
        const itens = produtos.filter((p) => p.categoria === cat.id).filter((p) => (parseFloat(estoque[p.id]) || 0) > 0);
        return (
          <div key={cat.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16 }} className="p-3 mb-3">
            <div className="flex items-center gap-2 mb-2"><div style={{ background: cat.cor + "22", borderRadius: 9, padding: 6 }}><Ic size={18} style={{ color: cat.cor }} /></div><div className="font-bold flex-1">{cat.id}</div></div>
            {itens.length === 0 && <div style={{ color: C.cinzaClaro }} className="text-sm py-1">Sem itens em estoque.</div>}
            {itens.map((p) => {
              const q = parseFloat(estoque[p.id]) || 0;
              return (
                <div key={p.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.bg}` }}>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium">{p.nome}{p.subcategoria && <span style={{ color: C.cinzaClaro, fontWeight: 500 }}> · {p.subcategoria}</span>}</div></div>
                  <button onClick={() => Dialog.prompt({ titulo: "Corrigir estoque", mensagem: p.nome + " (" + p.unidade + ")", valor: String(q), inputType: "number", okLabel: "Salvar" }).then((v) => { if (v !== null && v !== "" && !isNaN(parseFloat(v))) onAjustar(p.id, parseFloat(v)); })} style={{ minWidth: 70, textAlign: "right", fontWeight: 700, fontSize: 15 }}>{q.toLocaleString("pt-BR")} <span style={{ color: C.cinzaClaro, fontWeight: 500, fontSize: 12 }}>{p.unidade}</span></button>
                  <button onClick={() => onSaidaRapida(p)} style={{ background: C.vermelhoClaro, color: C.vermelho, borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><ArrowUpFromLine size={13} /> Saída</button>
                </div>
              );
            })}
          </div>
        );
      })}
      {movs.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16 }} className="p-3 mb-3">
          <div className="font-bold mb-2">Últimas movimentações</div>
          {movs.slice(0, 12).map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: `1px solid ${C.bg}` }}>
              <div style={{ background: m.tipo === "saida" ? C.vermelhoClaro : C.pastoClaro, color: m.tipo === "saida" ? C.vermelho : C.pasto, borderRadius: 8, padding: 5, display: "flex" }}>{m.tipo === "saida" ? <ArrowUpFromLine size={14} /> : <ArrowDownToLine size={14} />}</div>
              <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{nomeProd(m.produtoId)}</div><div style={{ color: C.cinzaClaro, fontSize: 11.5 }}>{nomePessoa(m.userId)}{m.origem === "compra" ? " · compra" : ""} · {quando(m.em)}</div></div>
              <div style={{ fontWeight: 700, color: m.tipo === "saida" ? C.vermelho : C.pasto }}>{m.tipo === "saida" ? "−" : "+"}{Number(m.qtd).toLocaleString("pt-BR")} {(produtos.find((p) => p.id === m.produtoId) || {}).unidade || ""}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ color: C.cinzaClaro, fontSize: 12 }} className="flex items-center gap-1 px-1 pb-2"><Info size={12} /> Toque no número para corrigir. Use “Saída” para registrar consumo.</div>
    </div>
  );
}

/* ============================= EQUIPE ============================= */
function EquipeView({ users, souAdmin, euId, showToast, onRecarregar }) {
  const [novo, setNovo] = useState(false);
  const editar = async (id, campo, valor) => {
    const { error } = await supabase.from("perfis").update({ [campo]: valor }).eq("id", id);
    if (error) { showToast("Erro ao salvar: " + error.message); return; }
    onRecarregar();
  };
  const alternarPapel = async (u) => {
    const { error } = await supabase.from("perfis").update({ papel: u.papel === "admin" ? "colaborador" : "admin" }).eq("id", u.id);
    if (error) { showToast("Erro ao salvar: " + error.message); return; }
    onRecarregar();
  };
  const definirAtivo = (u, ativo) => {
    Dialog.confirm({ titulo: ativo ? "Reativar acesso" : "Remover acesso", mensagem: ativo ? "Liberar novamente o acesso de " + u.nome + "?" : "Remover o acesso de " + u.nome + "? A pessoa deixará de entrar no app.", okLabel: ativo ? "Reativar" : "Remover", perigo: !ativo }).then(async (ok) => {
      if (!ok) return;
      await supabase.from("perfis").update({ ativo }).eq("id", u.id);
      onRecarregar();
      showToast(ativo ? "Acesso reativado" : "Acesso removido");
    });
  };

  return (
    <div>
      <div style={{ background: C.lagoClaro, borderRadius: 14 }} className="p-3 mb-3"><div style={{ color: C.lago }} className="text-xs font-semibold uppercase">Equipe do rancho</div><div style={{ color: C.terra }} className="text-sm mt-0.5">Administradores criam e organizam. Colaboradores executam e pedem compras. {souAdmin ? "Para dar acesso a alguém, toque em Adicionar pessoa." : "Somente administradores podem alterar a equipe."}</div></div>
      {souAdmin && <button onClick={() => setNovo(true)} className="flex items-center justify-center gap-2 mb-3" style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16 }}><UserPlus size={19} /> Adicionar pessoa</button>}
      {users.map((u) => {
        const inativo = u.ativo === false;
        return (
          <div key={u.id} style={{ background: C.card, border: `1px solid ${u.id === euId ? C.pasto : C.linha}`, borderRadius: 14, opacity: inativo ? 0.6 : 1 }} className="p-3 mb-2">
            <div className="flex items-center gap-2">
              <button onClick={() => souAdmin && alternarPapel(u)} title="Trocar função" disabled={!souAdmin} style={{ background: u.papel === "admin" ? C.ambarClaro : C.pastoClaro, borderRadius: 9, padding: 7 }}>{u.papel === "admin" ? <Star size={17} style={{ color: C.ambar }} /> : <User size={17} style={{ color: C.pasto }} />}</button>
              {souAdmin ? (
                <input key={"n" + u.id + u.nome} defaultValue={u.nome} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.nome) editar(u.id, "nome", v); }} placeholder="Nome da pessoa" style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: 15, outline: "none" }} />
              ) : (
                <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{u.nome}</div>
              )}
              <span style={{ color: C.cinzaClaro, fontSize: 12 }}>{inativo ? "Sem acesso" : papelLabel(u.papel)}</span>
              {souAdmin && u.id !== euId && (
                inativo
                  ? <button onClick={() => definirAtivo(u, true)} title="Reativar" style={{ color: C.pasto, padding: 4 }}><RefreshCw size={16} /></button>
                  : <button onClick={() => definirAtivo(u, false)} title="Remover acesso" style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: 40 }}>
              <Smartphone size={13} style={{ color: C.cinzaClaro }} />
              {souAdmin ? (
                <input key={"t" + u.id + (u.telefone || "")} defaultValue={u.telefone || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (u.telefone || "")) editar(u.id, "telefone", v); }} placeholder="Telefone (ex.: 63 99999-0000)" style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: C.cinza, outline: "none" }} />
              ) : (
                <div style={{ flex: 1, fontSize: 13, color: C.cinza }}>{u.telefone || "—"}</div>
              )}
              {u.id === euId && <span style={{ background: C.pastoClaro, color: C.pastoEsc, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>VOCÊ</span>}
            </div>
            <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: 40 }}>
              <Users size={13} style={{ color: C.cinzaClaro }} />
              {souAdmin ? (
                <select value={u.setor || ""} onChange={(e) => editar(u.id, "setor", e.target.value)} style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: u.setor ? setorCor(u.setor) : C.cinzaClaro, fontWeight: u.setor ? 600 : 400, outline: "none" }}>
                  <option value="">Sem setor</option>
                  {SETORES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              ) : (
                <div style={{ flex: 1, fontSize: 13, color: u.setor ? setorCor(u.setor) : C.cinzaClaro, fontWeight: u.setor ? 600 : 400 }}>{u.setor || "Sem setor"}</div>
              )}
            </div>
          </div>
        );
      })}
      {novo && <NovaPessoaSheet showToast={showToast} onCriado={onRecarregar} onFechar={() => setNovo(false)} />}
    </div>
  );
}

// Senha fácil de ditar/digitar: palavra do rancho + 4 números.
// ponytail: senha simples (~80 mil combinações) para usuários leigos; o login do Supabase limita tentativas.
const PALAVRAS_SENHA = ["lago", "pasto", "serra", "ipe", "vento", "sol", "rio", "boi"];
const gerarSenha = () => { const r = crypto.getRandomValues(new Uint32Array(2)); return PALAVRAS_SENHA[r[0] % PALAVRAS_SENHA.length] + String(r[1] % 10000).padStart(4, "0"); };

// Tira a mensagem real de dentro do erro da Edge Function (o supabase-js esconde o corpo da resposta).
async function erroDaFuncao(error, data) {
  if (data?.error) return data.error;
  try { const corpo = await error?.context?.json(); if (corpo?.error) return corpo.error; } catch { /* sem corpo */ }
  if (error?.context?.status === 404) return "O cadastro ainda não foi ativado no servidor (função quick-service).";
  return "Não foi possível criar o acesso" + (error?.message ? ": " + error.message : ".");
}

function NovaPessoaSheet({ showToast, onCriado, onFechar }) {
  const [f, setF] = useState(() => ({ nome: "", telefone: "", email: "", senha: gerarSenha(), papel: "colaborador", setor: SETORES[0].id }));
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState(null);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErro(""); };

  const criar = async () => {
    const nome = f.nome.trim(), email = f.email.trim().toLowerCase(), telefone = f.telefone.trim();
    if (!nome) return setErro("Escreva o nome da pessoa.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErro("Confira o e-mail — parece incompleto.");
    if (f.senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    setCriando(true);
    // A função "criar-usuario" foi criada pelo painel e ficou com o endereço "quick-service".
    const { data, error } = await supabase.functions.invoke("quick-service", {
      body: { nome, email, senha: f.senha, telefone, papel: f.papel, setor: f.papel === "admin" ? "" : f.setor },
    });
    if (error || data?.error) { setErro(await erroDaFuncao(error, data)); setCriando(false); return; }
    setCriando(false);
    setCriado({ nome, email, senha: f.senha, telefone });
    onCriado();
  };

  if (criado) {
    const primeiro = criado.nome.split(" ")[0];
    const link = new URL(import.meta.env.BASE_URL, window.location.href).href;
    const msg = `Olá, ${primeiro}! Este é o seu acesso ao app do Rancho Abdalla:\n\n${link}\n\nE-mail: ${criado.email}\nSenha: ${criado.senha}`;
    const fone = criado.telefone.replace(/\D/g, "");
    const whats = "https://wa.me/" + (fone ? (fone.length <= 11 ? "55" + fone : fone) : "") + "?text=" + encodeURIComponent(msg);
    const copiar = async () => { try { await navigator.clipboard.writeText(msg); showToast("Dados copiados"); } catch { showToast("Não foi possível copiar"); } };
    const linha = (l, v) => (<div className="flex justify-between gap-3 py-2" style={{ borderTop: `1px solid ${C.bg}` }}><span style={{ color: C.cinza }}>{l}</span><span className="font-bold" style={{ wordBreak: "break-all", textAlign: "right" }}>{v}</span></div>);
    return (
      <Sheet titulo="Pessoa adicionada" onFechar={onFechar}>
        <div className="text-center py-2">
          <CheckCircle2 size={48} style={{ color: C.pasto, display: "inline" }} />
          <div className="font-bold text-lg mt-2">{primeiro} já pode entrar no app</div>
          <div style={{ color: C.cinza }} className="text-sm mt-1">Envie os dados de acesso abaixo.</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, fontSize: 14 }} className="px-3 py-1 my-3">
          {linha("E-mail", criado.email)}
          {linha("Senha", criado.senha)}
        </div>
        <a href={whats} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 mb-2" style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16, textDecoration: "none", boxSizing: "border-box" }}><MessageCircle size={19} /> Enviar pelo WhatsApp</a>
        <button onClick={copiar} className="flex items-center justify-center gap-2 mb-2" style={{ width: "100%", background: C.card, color: C.terra, border: `1px solid ${C.linha}`, borderRadius: 12, padding: 13, fontWeight: 600 }}><Copy size={17} /> Copiar dados</button>
        <button onClick={onFechar} style={{ width: "100%", color: C.cinza, padding: 12, fontWeight: 600 }}>Concluir</button>
      </Sheet>
    );
  }

  const opcao = (on, onClick, titulo, texto, key) => (
    <button key={key} type="button" onClick={onClick} style={{ flex: 1, textAlign: "left", padding: 12, borderRadius: 12, background: on ? C.pastoClaro : C.card, border: `2px solid ${on ? C.pasto : C.linha}` }}>
      <div className="font-bold text-sm" style={{ color: on ? C.pastoEsc : C.terra }}>{titulo}</div>
      {texto && <div style={{ color: C.cinza, fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{texto}</div>}
    </button>
  );

  return (
    <Sheet titulo="Adicionar pessoa" onFechar={onFechar}>
      <Campo label="Nome"><input autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: João da Silva" style={inpSt} /></Campo>
      <Campo label="WhatsApp (opcional)"><input type="tel" inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="Ex.: 63 99999-0000" style={inpSt} /></Campo>
      <Campo label="Função">
        <div className="flex gap-2">
          {opcao(f.papel === "colaborador", () => set("papel", "colaborador"), "Colaborador", "Faz as tarefas e pede compras", "c")}
          {opcao(f.papel === "admin", () => set("papel", "admin"), "Administrador", "Cria e organiza tudo", "a")}
        </div>
      </Campo>
      {f.papel !== "admin" && (
        <Campo label="Setor">
          <div className="flex gap-2">{SETORES.map((s) => opcao(f.setor === s.id, () => set("setor", s.id), s.id, null, s.id))}</div>
        </Campo>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="p-3 mb-3">
        <div className="font-semibold text-sm mb-3 flex items-center gap-2"><KeyRound size={16} style={{ color: C.ambar }} /> Dados para entrar no app</div>
        <Campo label="E-mail da pessoa"><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Ex.: joao@gmail.com" style={inpSt} /></Campo>
        <Campo label="Senha">
          <div className="flex gap-2">
            <input value={f.senha} onChange={(e) => set("senha", e.target.value)} autoCapitalize="none" autoCorrect="off" style={{ ...inpSt, flex: 1, fontWeight: 600, letterSpacing: 0.5 }} />
            <button type="button" onClick={() => set("senha", gerarSenha())} title="Gerar outra senha" style={{ background: C.bg, border: `1px solid ${C.linha}`, borderRadius: 10, padding: "0 13px", color: C.cinza }}><Shuffle size={18} /></button>
          </div>
        </Campo>
        <div style={{ color: C.cinzaClaro, fontSize: 12 }} className="flex items-center gap-1"><Info size={12} /> Já deixamos uma senha fácil pronta. No próximo passo você envia pelo WhatsApp.</div>
      </div>
      {erro && <div style={{ background: C.vermelhoClaro, color: C.vermelho, borderRadius: 10, fontSize: 14 }} className="p-3 mb-3">{erro}</div>}
      <button onClick={criar} disabled={criando} style={{ width: "100%", background: criando ? C.cinzaClaro : C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16 }}>{criando ? "Criando acesso…" : "Criar acesso"}</button>
    </Sheet>
  );
}

// Popup que convida a instalar o app na tela inicial (some quando já instalado).
function InstalarPrompt() {
  const [visivel, setVisivel] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Deixa o botão do cabeçalho reabrir este convite quando quiser.
  useEffect(() => {
    _installOpen.fn = () => { setAjuda(false); setVisivel(true); };
    return () => { _installOpen.fn = null; };
  }, []);

  // Aparece sozinho ao entrar, se ainda não instalou e não pediu para não mostrar.
  useEffect(() => {
    if (estaInstalado()) return;
    let dispensado = false;
    try { dispensado = localStorage.getItem("instalarDispensado") === "1"; } catch { /* ok */ }
    if (dispensado) return;
    const talvezMostrar = () => { if (!estaInstalado() && (iOS || _installEvt)) setVisivel(true); };
    _installSubs.add(talvezMostrar);
    const t = setTimeout(talvezMostrar, 800);
    return () => { _installSubs.delete(talvezMostrar); clearTimeout(t); };
  }, [iOS]);

  if (!visivel || estaInstalado()) return null;

  const dispensar = () => { try { localStorage.setItem("instalarDispensado", "1"); } catch { /* ok */ } setVisivel(false); };
  const instalar = async () => {
    if (_installEvt) {
      _installEvt.prompt();
      const escolha = await _installEvt.userChoice.catch(() => null);
      _installEvt = null;
      if (escolha?.outcome === "accepted") setVisivel(false);
      return;
    }
    // Sem convite automático: mostra o passo a passo (iPhone ou outros navegadores).
    setAjuda(true);
  };

  const Passo = ({ n, children }) => (
    <div className="flex items-start gap-3 mb-2">
      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, background: C.pastoClaro, color: C.pastoEsc, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <div style={{ fontSize: 14, color: C.terra, paddingTop: 1 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0007", zIndex: 85, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }} onClick={dispensar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 420, borderRadius: 20, padding: 18, boxShadow: "0 12px 34px #0004" }}>
        <div className="flex items-center gap-3 mb-2">
          <div style={{ background: C.pastoEsc, borderRadius: 14, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MapPin size={26} color="#fff" /></div>
          <div><div className="font-bold text-lg leading-tight" style={{ color: C.terra }}>Instalar o Abdalla Home</div><div style={{ color: C.cinza, fontSize: 13 }}>Fica na tela do celular como um app.</div></div>
        </div>
        {ajuda ? (
          <div style={{ background: C.bg, borderRadius: 14 }} className="p-3 mt-2 mb-3">
            {iOS ? (<>
              <Passo n={1}>Toque no botão <b>Compartilhar</b> do Safari (o quadradinho com a seta pra cima, na barra de baixo).</Passo>
              <Passo n={2}>Role e toque em <b>Adicionar à Tela de Início</b>.</Passo>
              <Passo n={3}>Toque em <b>Adicionar</b>. Pronto!</Passo>
            </>) : (<>
              <Passo n={1}>Toque no menu do navegador (os <b>três pontinhos ⋮</b> no canto de cima).</Passo>
              <Passo n={2}>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</Passo>
              <Passo n={3}>Confirme. Pronto!</Passo>
            </>)}
          </div>
        ) : (
          <div style={{ color: C.cinza, fontSize: 14 }} className="mb-3 mt-1">Abre rapidinho, sem digitar endereço, e recebe os lembretes de tarefa.</div>
        )}
        <div className="flex gap-2">
          <button onClick={dispensar} style={{ flex: 1, padding: 13, borderRadius: 12, fontWeight: 600, color: C.cinza, background: C.bg }}>{ajuda ? "Fechar" : "Agora não"}</button>
          {!ajuda && <button onClick={instalar} className="flex items-center justify-center gap-2" style={{ flex: 1.4, padding: 13, borderRadius: 12, fontWeight: 700, color: "#fff", background: C.pasto }}><ArrowDownToLine size={18} /> {iOS ? "Como instalar" : "Instalar"}</button>}
          {ajuda && <button onClick={dispensar} style={{ flex: 1.4, padding: 13, borderRadius: 12, fontWeight: 700, color: "#fff", background: C.pasto }}>Entendi</button>}
        </div>
      </div>
    </div>
  );
}

/* ============================= PAINEL ============================= */
function PainelView({ tasks, users }) {
  const [modo, setModo] = useState("mes");
  const [anchor, setAnchor] = useState(() => new Date());

  // Período selecionado (mês ou semana), como datas ISO para comparar.
  let inicio, fim, label;
  if (modo === "mes") {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    inicio = isoLocal(new Date(y, m, 1));
    fim = isoLocal(new Date(y, m + 1, 0));
    label = anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  } else {
    const seg = inicioSemana(anchor);
    const dom = new Date(seg); dom.setDate(dom.getDate() + 6);
    inicio = isoLocal(seg); fim = isoLocal(dom);
    label = `${fmtDM(seg)} – ${fmtDM(dom)}`;
  }
  const navegar = (dir) => { const d = new Date(anchor); if (modo === "mes") d.setMonth(d.getMonth() + dir); else d.setDate(d.getDate() + dir * 7); setAnchor(d); };

  // Por colaborador: META (tarefas destinadas a ele, feitas ou não) e REALIZADO (feitas por ele).
  const stats = {};
  const ensure = (id) => stats[id] || (stats[id] = { metaCount: 0, metaMin: 0, feitoCount: 0, feitoMin: 0 });
  let totalTarefas = 0, totalMin = 0;
  tasks.forEach((t) => {
    if (t.ehCompra) return; // compras não entram no painel de trabalho
    const dur = duracaoMin(t);
    // META — contada pelo responsável, pelas ocorrências agendadas no período.
    if (t.responsavelId) {
      if (t.tipo === "unica") {
        if (t.data && t.data >= inicio && t.data <= fim) { const s = ensure(t.responsavelId); s.metaCount++; s.metaMin += dur; }
      } else {
        const oc = ocorrenciasNoPeriodo(t, inicio, fim);
        if (oc) { const s = ensure(t.responsavelId); s.metaCount += oc; s.metaMin += dur * oc; }
      }
    }
    // REALIZADO — contado por quem de fato concluiu.
    if (t.tipo === "unica") {
      if (t.status === "concluida" && t.concluidaEm) {
        const iso = isoLocal(t.concluidaEm);
        if (iso >= inicio && iso <= fim) { const who = t.concluidaPorId || t.responsavelId; if (who) { const s = ensure(who); s.feitoCount++; s.feitoMin += dur; totalTarefas++; totalMin += dur; } }
      }
    } else {
      Object.entries(t.conclusoes || {}).forEach(([iso, c]) => {
        if (iso >= inicio && iso <= fim) { const who = c.userId || t.responsavelId; if (who) { const s = ensure(who); s.feitoCount++; s.feitoMin += dur; totalTarefas++; totalMin += dur; } }
      });
    }
  });
  const linhas = Object.entries(stats).map(([who, v]) => ({ who, nome: nomeUser(users, who), ...v })).sort((a, b) => b.feitoCount - a.feitoCount || b.metaCount - a.metaCount);
  const escala = Math.max(1, ...linhas.map((l) => Math.max(l.metaCount, l.feitoCount)));

  return (
    <div>
      <div style={{ background: C.pastoClaro, borderRadius: 14 }} className="p-3 mb-3">
        <div style={{ color: C.pastoEsc }} className="text-xs font-semibold uppercase mb-2">Painel de trabalho</div>
        <div className="flex gap-2 mb-3">
          {[{ id: "mes", n: "Por mês" }, { id: "semana", n: "Por semana" }].map((o) => (
            <button key={o.id} onClick={() => setModo(o.id)} style={{ flex: 1, padding: "8px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, background: modo === o.id ? C.pasto : C.card, color: modo === o.id ? "#fff" : C.cinza, border: `1px solid ${modo === o.id ? C.pasto : C.linha}` }}>{o.n}</button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => navegar(-1)} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 10, padding: 8 }}><ChevronLeft size={18} /></button>
          <div className="font-bold capitalize" style={{ color: C.pastoEsc }}>{label}</div>
          <button onClick={() => navegar(1)} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 10, padding: 8 }}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="p-3">
          <div className="flex items-center gap-1" style={{ color: C.cinza, fontSize: 12 }}><ListTodo size={13} /> Tarefas concluídas</div>
          <div className="font-bold" style={{ fontSize: 26, color: C.pasto }}>{totalTarefas}</div>
        </div>
        <div style={{ flex: 1, background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="p-3">
          <div className="flex items-center gap-1" style={{ color: C.cinza, fontSize: 12 }}><Clock size={13} /> Horas de trabalho</div>
          <div className="font-bold" style={{ fontSize: 26, color: C.lago }}>{fmtHoras(totalMin)}</div>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16 }} className="p-3 mb-3">
        <div className="font-bold mb-1">Por colaborador</div>
        <div className="flex items-center gap-3 mb-2" style={{ fontSize: 11.5, color: C.cinza }}>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, background: C.pasto, display: "inline-block" }} /> Realizado</span>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, background: C.cinzaClaro, display: "inline-block" }} /> Meta (destinadas)</span>
        </div>
        {linhas.length === 0 && <div style={{ color: C.cinzaClaro }} className="text-sm py-3 text-center">Nenhuma tarefa neste período.</div>}
        {linhas.map((l) => (
          <div key={l.who} className="py-2" style={{ borderTop: `1px solid ${C.bg}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-sm">{l.nome}</div>
              <div style={{ fontSize: 12.5 }}>
                <b style={{ color: C.pasto }}>{l.feitoCount}</b><span style={{ color: C.cinzaClaro }}>/{l.metaCount}</span> <span style={{ color: C.cinzaClaro }}>tar.</span> · <b style={{ color: C.pasto }}>{fmtHoras(l.feitoMin)}</b><span style={{ color: C.cinzaClaro }}>/{fmtHoras(l.metaMin)}</span>
              </div>
            </div>
            <div style={{ position: "relative", height: 8, background: C.bg, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(l.metaCount / escala) * 100}%`, background: C.cinzaClaro, borderRadius: 999 }} />
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(l.feitoCount / escala) * 100}%`, background: C.pasto, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ color: C.cinzaClaro, fontSize: 12 }} className="flex items-center gap-1 px-1 pb-2"><Info size={12} /> Verde = feito por quem concluiu; cinza = meta (tarefas destinadas). Horas contam tarefas com início e fim. Compras não entram.</div>
    </div>
  );
}

/* ===================== AUTOCOMPLETE DE PRODUTO ===================== */
function ProdutoAutocomplete({ produtos, valorId, onSelecionar, onCadastrarTexto, permitirCadastro = true }) {
  const [q, setQ] = useState(() => { const p = produtos.find((x) => x.id === valorId); return p ? p.nome : ""; });
  const [aberto, setAberto] = useState(false);
  useEffect(() => { const p = produtos.find((x) => x.id === valorId); if (p && p.nome !== q) setQ(p.nome); }, [valorId]);
  const termo = norm(q);
  const matches = (termo ? produtos.filter((p) => norm(p.nome).includes(termo)) : produtos).slice(0, 30);
  const exato = produtos.some((p) => norm(p.nome) === termo);
  const selecionado = produtos.find((p) => p.id === valorId);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 11, top: 13, color: C.cinzaClaro }} />
        <input value={q} placeholder="Comece a digitar o produto…"
          onChange={(e) => { setQ(e.target.value); setAberto(true); if (valorId) onSelecionar(""); }}
          onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 160)}
          style={{ ...inpSt, paddingLeft: 34, borderColor: selecionado ? C.pasto : C.linha }} />
        {selecionado && !aberto && <Check size={16} style={{ position: "absolute", right: 11, top: 13, color: C.pasto }} />}
      </div>
      {aberto && (
        <div style={{ position: "absolute", top: 48, left: 0, right: 0, background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 12, boxShadow: "0 8px 24px #0002", zIndex: 30, maxHeight: 240, overflowY: "auto" }}>
          {matches.map((p) => (
            <button key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(p.nome); onSelecionar(p.id); setAberto(false); }}
              style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: `1px solid ${C.bg}`, background: p.id === valorId ? C.pastoClaro : "#fff" }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{p.nome}</span>
              <span style={{ fontSize: 11.5, color: C.cinzaClaro }}>{p.subcategoria ? p.subcategoria + " · " : ""}{p.categoria.split(" ")[0]} · {p.unidade}</span>
            </button>
          ))}
          {permitirCadastro && q.trim() && !exato && (
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => { onCadastrarTexto(q.trim()); setAberto(false); }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 6, padding: "11px 12px", color: C.pasto, fontWeight: 700, fontSize: 13.5 }}>
              <Plus size={15} /> Cadastrar “{q.trim()}”
            </button>
          )}
          {matches.length === 0 && !q.trim() && <div style={{ padding: 12, color: C.cinzaClaro, fontSize: 13 }}>Digite para buscar…</div>}
        </div>
      )}
    </div>
  );
}

/* ===================== MODAL: PRODUTOS ===================== */
function ProdutosModal({ produtos, onCadastrar, onRemover, onRenomear, onFechar }) {
  const [nome, setNome] = useState(""); const [categoria, setCategoria] = useState("Supermercado"); const [subcategoria, setSubcategoria] = useState(""); const [unidade, setUnidade] = useState("un");
  const [busca, setBusca] = useState("");
  const add = () => { if (!nome.trim()) return; onCadastrar({ nome: nome.trim(), categoria, subcategoria: categoria === "Combustível" ? subcategoria : "", unidade }); setNome(""); setSubcategoria(""); };
  const termo = norm(busca);
  return (
    <Sheet titulo="Produtos do estoque" onFechar={onFechar}>
      <div style={{ color: C.cinza }} className="text-sm mb-3">A base já vem com muitos produtos. Cadastre novos aqui — nas compras todos escolhem da lista, então o mesmo item nunca aparece escrito de dois jeitos.</div>
      <div style={{ background: C.bg, borderRadius: 12 }} className="p-3 mb-4">
        <div className="font-semibold text-sm mb-2">Novo produto</div>
        <input placeholder="Nome do produto" value={nome} onChange={(e) => setNome(e.target.value)} style={inpSt} className="mb-2" />
        <div className="flex gap-2 mb-2">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ ...inpSt, flex: 1 }}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}</select>
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} style={{ ...inpSt, width: 90 }}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        </div>
        {categoria === "Combustível" && <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} style={inpSt} className="mb-2"><option value="">Tipo de combustível…</option>{SUBCOMBUSTIVEL.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
        <button onClick={add} style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 10, padding: 12, fontWeight: 700 }}>Cadastrar produto</button>
      </div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={16} style={{ position: "absolute", left: 11, top: 13, color: C.cinzaClaro }} />
        <input placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...inpSt, paddingLeft: 34 }} />
      </div>
      {CATEGORIAS.map((cat) => {
        const itens = produtos.filter((p) => p.categoria === cat.id).filter((p) => !termo || norm(p.nome).includes(termo));
        if (!itens.length) return null;
        return (
          <div key={cat.id} className="mb-3">
            <div style={{ color: C.cinza }} className="text-xs font-semibold uppercase mb-1">{cat.id} · {itens.length}</div>
            {itens.map((p) => (
              <div key={p.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2 mb-1.5 flex items-center gap-2">
                <input defaultValue={p.nome} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.nome) onRenomear(p.id, e.target.value.trim()); }} style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: 14, outline: "none" }} />
                <span style={{ color: C.cinzaClaro, fontSize: 12 }}>{p.subcategoria ? p.subcategoria + " · " : ""}{p.unidade}</span>
                <button onClick={() => { Dialog.confirm({ titulo: "Remover produto", mensagem: "Remover " + p.nome + "? O estoque dele também sai.", okLabel: "Remover", perigo: true }).then((ok) => { if (ok) onRemover(p.id); }); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        );
      })}
    </Sheet>
  );
}

/* ============================= MODAL: TAREFA ============================= */
function TarefaModal({ task, users, eu, produtos, ehCompraInicial, onCadastrarProduto, showToast, onFechar, onSalvar }) {
  const souAdmin = eu?.papel === "admin";
  const [f, setF] = useState(() => task || { titulo: "", descricao: "", responsavelId: eu?.id, setor: eu?.setor || "", tipo: "unica", freq: "diaria", dias: [], intervaloSemanas: 1, data: hojeISO(), dataInicio: hojeISO(), horaInicio: "", horaFim: "", imagemUrl: null, ehCompra: !!ehCompraInicial, compra: { itens: [] } });
  const [imgPreview, setImgPreview] = useState(task?.imagemUrl || null); const [salvandoImg, setSalvandoImg] = useState(false);
  const [novoProd, setNovoProd] = useState(false);
  const [np, setNp] = useState({ nome: "", categoria: "Supermercado", subcategoria: "", unidade: "un" });
  const [addProdId, setAddProdId] = useState("");
  const [addQtd, setAddQtd] = useState("");
  const [addKey, setAddKey] = useState(0);
  const fileRef = useRef();
  const camRef = useRef();

  useEffect(() => { if (!souAdmin && f.tipo !== "unica") setF((p) => ({ ...p, tipo: "unica" })); }, [souAdmin]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const itens = (f.compra && Array.isArray(f.compra.itens)) ? f.compra.itens : ((f.compra && f.compra.produtoId) ? [{ id: "leg", produtoId: f.compra.produtoId, quantidade: f.compra.quantidade }] : []);
  const setItens = (novos) => setF((p) => ({ ...p, compra: { itens: novos } }));
  const addProd = produtos.find((p) => p.id === addProdId);
  const adicionarItem = () => { if (!addProdId || !(parseFloat(addQtd) > 0)) return; setItens([...itens, { id: uid(), produtoId: addProdId, quantidade: parseFloat(addQtd) }]); setAddProdId(""); setAddQtd(""); setAddKey((k) => k + 1); };
  const removerItem = (id) => setItens(itens.filter((x) => x.id !== id));

  const escolherImg = async (e) => { const file = e.target.files?.[0]; if (!file) return; setSalvandoImg(true); try { const url = await uploadFoto(file); set("imagemUrl", url); setImgPreview(url); } catch (err) { console.error("uploadFoto", err); window.alert("Não consegui salvar a foto.\n\nMotivo: " + (err?.message || err)); } setSalvandoImg(false); };
  const toggleDia = (d) => set("dias", f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d]);
  const abrirCadastroTexto = (texto) => { setNp((p) => ({ ...p, nome: texto })); setNovoProd(true); };
  const salvarNovoProduto = async () => { if (!np.nome.trim()) return; const criado = await onCadastrarProduto({ nome: np.nome.trim(), categoria: np.categoria, subcategoria: np.categoria === "Combustível" ? np.subcategoria : "", unidade: np.unidade }); if (criado) { setAddProdId(criado.id); setAddKey((k) => k + 1); } setNovoProd(false); setNp({ nome: "", categoria: "Supermercado", subcategoria: "", unidade: "un" }); };

  // O setor da tarefa vem do responsável; só é escolhido à mão quando não dá pra deduzir.
  const respSetor = users.find((u) => u.id === f.responsavelId)?.setor || "";
  const semDiaSelecionado = f.tipo === "recorrente" && f.freq === "semanal" && (f.dias || []).length === 0;
  const podeSalvar = (f.ehCompra ? itens.length > 0 : !!f.titulo.trim()) && !semDiaSelecionado;
  const submit = () => {
    if (!podeSalvar) return;
    const dados = { ...f, setor: respSetor || f.setor || "" };
    if (f.ehCompra) {
      dados.compra = { itens };
      if (!dados.titulo.trim()) dados.titulo = "Compras";
    }
    onSalvar(dados);
  };

  return (
    <Sheet titulo={task ? "Editar tarefa" : (f.ehCompra ? "Nova compra" : "Nova tarefa")} onFechar={onFechar}>
      {!souAdmin && <div style={{ background: C.lagoClaro, borderRadius: 10 }} className="p-2.5 mb-3 flex items-center gap-2 text-sm"><Info size={15} style={{ color: C.lago }} /> <span>Como colaborador, você cria tarefas de <b>uma vez</b>.</span></div>}
      <Campo label={f.ehCompra ? "O que precisa ser feito? (opcional)" : "O que precisa ser feito?"}><input autoFocus placeholder={f.ehCompra ? "Opcional — padrão: Compras" : "Ex.: Cortar a grama do gramado"} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} style={inpSt} /></Campo>
      <Campo label="Detalhes (opcional)"><textarea placeholder="Alguma observação…" value={f.descricao} onChange={(e) => set("descricao", e.target.value)} style={{ ...inpSt, minHeight: 62, resize: "vertical" }} /></Campo>
      <Campo label="Responsável"><select value={f.responsavelId || ""} onChange={(e) => set("responsavelId", e.target.value)} style={inpSt}><option value="">Sem responsável</option>{users.filter((u) => u.ativo !== false).map((u) => <option key={u.id} value={u.id}>{u.nome}{u.papel === "admin" ? " (administrador)" : ""}</option>)}</select></Campo>
      {respSetor ? (
        <div className="mb-3">
          <div style={lblSt}>Setor</div>
          <div className="flex items-center gap-2">
            <Chip icon={Users} texto={respSetor} cor={setorCor(respSetor)} />
            <span style={{ color: C.cinzaClaro, fontSize: 12 }}>vem do responsável · quem faltar, o setor cobre</span>
          </div>
        </div>
      ) : (
        <Campo label="Setor (o responsável não tem setor — defina se quiser agrupar)"><select value={f.setor || ""} onChange={(e) => set("setor", e.target.value)} style={inpSt}><option value="">Sem setor</option>{SETORES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}</select></Campo>
      )}

      <div className="flex items-center justify-between mb-3" style={{ background: C.ambarClaro, borderRadius: 12, padding: "10px 12px" }}>
        <div className="flex items-center gap-2"><ShoppingCart size={17} style={{ color: C.ambar }} /><span className="font-semibold text-sm">É uma compra?</span></div>
        <Toggle on={f.ehCompra} onToggle={() => set("ehCompra", !f.ehCompra)} />
      </div>

      {f.ehCompra && (
        <div style={{ background: C.bg, borderRadius: 12 }} className="p-3 mb-3">
          <div style={lblSt}>Adicionar produto</div>
          <ProdutoAutocomplete key={addKey} produtos={produtos} valorId={addProdId} onSelecionar={setAddProdId} onCadastrarTexto={abrirCadastroTexto} />
          {novoProd && (
            <div style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2.5 mt-2">
              <div className="text-xs font-semibold mb-2" style={{ color: C.cinza }}>Cadastrar novo produto</div>
              <input placeholder="Nome do produto" value={np.nome} onChange={(e) => setNp({ ...np, nome: e.target.value })} style={inpSt} className="mb-2" />
              <div className="flex gap-2 mb-2">
                <select value={np.categoria} onChange={(e) => setNp({ ...np, categoria: e.target.value })} style={{ ...inpSt, flex: 1 }}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}</select>
                <select value={np.unidade} onChange={(e) => setNp({ ...np, unidade: e.target.value })} style={{ ...inpSt, width: 84 }}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              {np.categoria === "Combustível" && <select value={np.subcategoria} onChange={(e) => setNp({ ...np, subcategoria: e.target.value })} style={inpSt} className="mb-2"><option value="">Tipo…</option>{SUBCOMBUSTIVEL.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
              <div className="flex gap-2"><button onClick={salvarNovoProduto} style={{ flex: 1, background: C.pasto, color: "#fff", borderRadius: 9, padding: 10, fontWeight: 700 }}>Salvar produto</button><button onClick={() => setNovoProd(false)} style={{ color: C.cinza, padding: "0 12px", fontWeight: 600 }}>Cancelar</button></div>
            </div>
          )}
          <div className="flex gap-2 items-end mt-2">
            <div style={{ flex: 1 }}><div style={lblSt}>Quantidade</div><input type="number" placeholder="0" value={addQtd} onChange={(e) => setAddQtd(e.target.value)} style={inpSt} /></div>
            <div style={{ paddingBottom: 11, color: C.cinza, fontWeight: 600, minWidth: 22 }}>{addProd?.unidade || ""}</div>
            <button onClick={adicionarItem} disabled={!addProdId || !(parseFloat(addQtd) > 0)} style={{ background: (addProdId && parseFloat(addQtd) > 0) ? C.pasto : C.cinzaClaro, color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Plus size={16} /> Add</button>
          </div>

          <div style={{ borderTop: `1px dashed ${C.cinzaClaro}`, marginTop: 12, paddingTop: 10 }}>
            <div style={lblSt}>Itens da compra{itens.length > 0 ? ` (${itens.length})` : ""}</div>
            {itens.length === 0 && <div style={{ color: C.cinzaClaro, fontSize: 13 }}>Nenhum item ainda. Adicione acima e a lista aparece aqui.</div>}
            {itens.map((it) => { const p = produtos.find((x) => x.id === it.produtoId); return (
              <div key={it.id} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2 mb-1.5 flex items-center gap-2">
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p ? p.nome : "Produto"}</div>{p && <div style={{ color: C.cinzaClaro, fontSize: 11.5 }}>{p.subcategoria ? p.subcategoria + " · " : ""}{p.categoria}</div>}</div>
                <b style={{ color: C.pastoEsc, whiteSpace: "nowrap" }}>{it.quantidade} {p?.unidade || ""}</b>
                <button onClick={() => removerItem(it.id)} style={{ color: C.vermelho, padding: 4 }}><X size={16} /></button>
              </div>
            ); })}
          </div>
          <div style={{ color: C.cinza, fontSize: 12 }} className="flex items-center gap-1 mt-2"><Info size={12} /> Ao concluir a compra, todos os itens entram no estoque.</div>
        </div>
      )}

      {souAdmin ? (
        <Campo label="Quando?">
          <div className="flex gap-2">
            {[{ id: "unica", n: "Uma vez" }, { id: "recorrente", n: "Recorrente" }].map((o) => (
              <button key={o.id} onClick={() => set("tipo", o.id)} style={{ flex: 1, padding: "10px", borderRadius: 10, fontWeight: 600, fontSize: 14, background: f.tipo === o.id ? C.pasto : C.card, color: f.tipo === o.id ? "#fff" : C.cinza, border: `1px solid ${f.tipo === o.id ? C.pasto : C.linha}` }}>{o.n}</button>
            ))}
          </div>
        </Campo>
      ) : null}

      {f.tipo === "unica" ? (
        <Campo label="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={inpSt} /></Campo>
      ) : (
        <>
          <Campo label="Frequência">
            <div className="flex gap-2">{[{ id: "diaria", n: "Todo dia" }, { id: "semanal", n: "Dias da semana" }].map((o) => (<button key={o.id} onClick={() => set("freq", o.id)} style={{ flex: 1, padding: "9px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, background: f.freq === o.id ? C.lago : C.card, color: f.freq === o.id ? "#fff" : C.cinza, border: `1px solid ${f.freq === o.id ? C.lago : C.linha}` }}>{o.n}</button>))}</div>
          </Campo>
          {f.freq === "semanal" && (
            <>
              <div style={lblSt}>Em quais dias?</div>
              <div className="flex gap-1 mb-3">{DIAS.map((d, i) => (<button key={i} onClick={() => toggleDia(i)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: f.dias.includes(i) ? C.lago : C.card, color: f.dias.includes(i) ? "#fff" : C.cinza, border: `1px solid ${f.dias.includes(i) ? C.lago : C.linha}` }}>{d}</button>))}</div>
              <Campo label="Repetir a cada">
                <select value={f.intervaloSemanas} onChange={(e) => set("intervaloSemanas", parseInt(e.target.value))} style={inpSt}>
                  <option value={1}>Toda semana</option>
                  {[2, 3, 4, 5, 6, 8, 12].map((n) => <option key={n} value={n}>A cada {n} semanas</option>)}
                </select>
              </Campo>
            </>
          )}
          <Campo label={f.freq === "semanal" && (parseInt(f.intervaloSemanas) || 1) > 1 ? "Primeira vez em (a contagem das semanas parte daqui)" : "A partir de"}>
            <input type="date" value={f.dataInicio} onChange={(e) => set("dataInicio", e.target.value)} style={inpSt} />
          </Campo>
        </>
      )}

      <Campo label="Horário (opcional — gera lembrete 15 min antes)"><div className="flex gap-2 items-center"><input type="time" value={f.horaInicio} onChange={(e) => set("horaInicio", e.target.value)} style={{ ...inpSt, flex: 1 }} /><span style={{ color: C.cinza }}>até</span><input type="time" value={f.horaFim} onChange={(e) => set("horaFim", e.target.value)} style={{ ...inpSt, flex: 1 }} /></div></Campo>

      <Campo label="Foto de referência (opcional)">
        {imgPreview ? (<div style={{ position: "relative" }}><img src={imgPreview} alt="" style={{ borderRadius: 12, width: "100%", maxHeight: 180, objectFit: "cover" }} /><button onClick={() => { setImgPreview(null); set("imagemUrl", null); }} style={{ position: "absolute", top: 8, right: 8, background: "#000a", color: "#fff", borderRadius: 999, padding: 6 }}><X size={16} /></button></div>) : (salvandoImg ? (
          <div style={{ width: "100%", border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, textAlign: "center", fontWeight: 600 }}>Enviando…</div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => camRef.current?.click()} style={{ flex: 1, border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600 }}><Camera size={18} /> Tirar foto</button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600 }}><Images size={18} /> Da galeria</button>
          </div>
        ))}
        <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={escolherImg} style={{ display: "none" }} />
        <input ref={fileRef} type="file" accept="image/*" onChange={escolherImg} style={{ display: "none" }} />
      </Campo>

      {semDiaSelecionado && <div style={{ color: C.vermelho, fontSize: 13 }} className="mb-2">Escolha pelo menos um dia da semana.</div>}
      <button disabled={!podeSalvar} onClick={submit} style={{ width: "100%", background: podeSalvar ? C.pasto : C.cinzaClaro, color: "#fff", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, marginTop: 4 }}>{task ? "Salvar alterações" : "Criar tarefa"}</button>
    </Sheet>
  );
}

/* ============================= MODAL: MOVIMENTO ============================= */
function MovimentoModal({ tipo, produtos, estoque, onAplicar, onFechar }) {
  const ehSaida = tipo === "saida";
  const [addProdId, setAddProdId] = useState("");
  const [addQtd, setAddQtd] = useState("");
  const [addKey, setAddKey] = useState(0);
  const [itens, setItens] = useState([]);
  const addProd = produtos.find((p) => p.id === addProdId);
  const atualAdd = parseFloat(estoque[addProdId]) || 0;
  const podeAdd = addProdId && parseFloat(addQtd) > 0;
  const adicionar = () => { if (!podeAdd) return; setItens([...itens, { id: uid(), produtoId: addProdId, quantidade: parseFloat(addQtd) }]); setAddProdId(""); setAddQtd(""); setAddKey((k) => k + 1); };
  const remover = (id) => setItens(itens.filter((x) => x.id !== id));
  return (
    <Sheet titulo={ehSaida ? "Registrar saída" : "Registrar entrada"} onFechar={onFechar}>
      <div style={{ color: C.cinza }} className="text-sm mb-3">{ehSaida ? "Adicione os produtos que saíram do estoque e salve tudo de uma vez." : "Adicione os produtos que entraram no estoque e salve tudo de uma vez."}</div>
      <div style={lblSt}>Adicionar produto</div>
      <ProdutoAutocomplete key={addKey} produtos={produtos} valorId={addProdId} onSelecionar={setAddProdId} onCadastrarTexto={() => {}} permitirCadastro={false} />
      {addProd && <div style={{ background: C.bg, borderRadius: 10 }} className="p-2 mt-2 text-sm flex items-center justify-between"><span style={{ color: C.cinza }}>Em estoque agora</span><b>{atualAdd.toLocaleString("pt-BR")} {addProd.unidade}</b></div>}
      <div className="flex gap-2 items-end mt-2">
        <div style={{ flex: 1 }}><div style={lblSt}>Quantidade</div><input type="number" placeholder="0" value={addQtd} onChange={(e) => setAddQtd(e.target.value)} style={inpSt} /></div>
        <div style={{ paddingBottom: 11, color: C.cinza, fontWeight: 600, minWidth: 22 }}>{addProd?.unidade || ""}</div>
        <button onClick={adicionar} disabled={!podeAdd} style={{ background: podeAdd ? (ehSaida ? C.vermelho : C.pasto) : C.cinzaClaro, color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 700, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Plus size={16} /> Add</button>
      </div>

      <div style={{ borderTop: `1px dashed ${C.cinzaClaro}`, marginTop: 12, paddingTop: 10 }}>
        <div style={lblSt}>{ehSaida ? "Saídas" : "Entradas"} a registrar{itens.length > 0 ? ` (${itens.length})` : ""}</div>
        {itens.length === 0 && <div style={{ color: C.cinzaClaro, fontSize: 13 }}>Nenhum produto ainda. Adicione acima e a lista aparece aqui.</div>}
        {itens.map((it) => { const p = produtos.find((x) => x.id === it.produtoId); return (
          <div key={it.id} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2 mb-1.5 flex items-center gap-2">
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p ? p.nome : "Produto"}</div>{p && <div style={{ color: C.cinzaClaro, fontSize: 11.5 }}>{p.subcategoria ? p.subcategoria + " · " : ""}{p.categoria}</div>}</div>
            <b style={{ color: ehSaida ? C.vermelho : C.pastoEsc, whiteSpace: "nowrap" }}>{ehSaida ? "−" : "+"}{it.quantidade} {p?.unidade || ""}</b>
            <button onClick={() => remover(it.id)} style={{ color: C.vermelho, padding: 4 }}><X size={16} /></button>
          </div>
        ); })}
      </div>

      <button disabled={itens.length === 0} onClick={() => onAplicar(itens.map((it) => ({ produtoId: it.produtoId, quantidade: it.quantidade })))} style={{ width: "100%", background: itens.length ? (ehSaida ? C.vermelho : C.pasto) : C.cinzaClaro, color: "#fff", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, marginTop: 14 }}>{ehSaida ? "Registrar saída" : "Registrar entrada"}{itens.length ? " (" + itens.length + ")" : ""}</button>
    </Sheet>
  );
}

/* ============================= MODAL: CONCLUIR ============================= */
// Detalhes da tarefa (abre ao tocar no título). Só leitura, com botão para editar.
function DetalheTarefaModal({ t, users, onFechar, onEditar }) {
  const [zoom, setZoom] = useState(false);
  const iso = hojeISO();
  const feito = isConcluida(t, iso);
  const concluinteId = t.tipo === "unica" ? t.concluidaPorId : (t.conclusoes && t.conclusoes[iso] ? t.conclusoes[iso].userId : null);
  const fotoFeito = t.tipo === "unica" ? t.fotoConclusaoUrl : (t.conclusoes && t.conclusoes[iso] ? t.conclusoes[iso].fotoUrl : null);
  const Linha = ({ icon: Ic, label, valor }) => (
    <div className="flex items-start gap-2 py-2.5" style={{ borderTop: `1px solid ${C.bg}` }}>
      <Ic size={16} style={{ color: C.cinzaClaro, marginTop: 2, flexShrink: 0 }} />
      <div className="flex-1"><div style={{ fontSize: 11.5, color: C.cinza }}>{label}</div><div style={{ fontSize: 14.5, color: C.terra, fontWeight: 600 }}>{valor}</div></div>
    </div>
  );
  return (
    <Sheet titulo="Detalhes da tarefa" onFechar={onFechar}>
      <div className="font-bold text-lg" style={{ color: C.terra }}>{t.titulo}</div>
      {t.descricao && <div style={{ color: C.cinza }} className="text-sm mt-1">{t.descricao}</div>}
      {t.imagemUrl && (
        <button onClick={() => setZoom(true)} style={{ display: "block", width: "100%", marginTop: 12, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.linha}`, position: "relative" }}>
          <img src={t.imagemUrl} alt="Foto de referência da tarefa" style={{ display: "block", width: "100%", maxHeight: 240, objectFit: "cover" }} />
          <span style={{ position: "absolute", right: 8, bottom: 8, background: "#0009", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Search size={12} /> Ampliar</span>
        </button>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="px-3 py-0.5 mt-3">
        <Linha icon={User} label="Responsável" valor={nomeUser(users, t.responsavelId)} />
        <Linha icon={Users} label="Setor" valor={t.setor || "—"} />
        <Linha icon={t.tipo === "recorrente" ? Repeat : CalendarDays} label="Quando" valor={t.tipo === "recorrente" ? textoRecorrencia(t) : (t.data ? fmtData(t.data) : "—")} />
        <Linha icon={Clock} label="Horário" valor={(t.horaInicio || t.horaFim) ? `${t.horaInicio || "?"}${t.horaFim ? " – " + t.horaFim : ""}` : "—"} />
        <Linha icon={Check} label="Situação" valor={feito ? (concluinteId ? "Feito por " + nomeUser(users, concluinteId) : "Concluída") : "Pendente"} />
      </div>
      {fotoFeito && (<>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.cinza }} className="mt-3 mb-1">Foto da conclusão</div>
        <img src={fotoFeito} alt="Foto da conclusão" style={{ width: "100%", borderRadius: 12, border: `1px solid ${C.linha}`, maxHeight: 240, objectFit: "cover" }} />
      </>)}
      <button onClick={() => { onFechar(); onEditar(t); }} className="flex items-center justify-center gap-2" style={{ width: "100%", marginTop: 16, background: C.pasto, color: "#fff", borderRadius: 12, padding: 13, fontWeight: 700 }}><Pencil size={17} /> Editar tarefa</button>
      {zoom && t.imagemUrl && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, background: "#000000e8", zIndex: 96, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={t.imagemUrl} alt="Foto de referência da tarefa" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
          <button onClick={() => setZoom(false)} title="Fechar" style={{ position: "fixed", top: 16, right: 16, background: "#ffffff26", color: "#fff", borderRadius: 999, padding: 10, display: "flex" }}><X size={22} /></button>
        </div>
      )}
    </Sheet>
  );
}

function ConcluirModal({ task, produtos, showToast, onFechar, onConfirmar }) {
  const [foto, setFoto] = useState(null); const [url, setUrl] = useState(null); const [salvando, setSalvando] = useState(false);
  const fileRef = useRef();
  const camRef = useRef();
  const itensC = itensDaCompra(task);
  const escolher = async (e) => { const file = e.target.files?.[0]; if (!file) return; setSalvando(true); try { const u = await uploadFoto(file); setFoto(u); setUrl(u); } catch (err) { console.error("uploadFoto", err); window.alert("Não consegui salvar a foto.\n\nMotivo: " + (err?.message || err)); } setSalvando(false); };
  return (
    <Sheet titulo="Concluir tarefa" onFechar={onFechar}>
      <div style={{ background: C.pastoClaro, borderRadius: 12 }} className="p-3 mb-3"><div className="font-semibold">{task.titulo}</div>{task.ehCompra && itensC.length > 0 && <div style={{ color: C.pastoEsc }} className="text-sm mt-1.5">Entrará no estoque:{itensC.map((it, i) => { const p = produtos.find((x) => x.id === it.produtoId); return (<div key={i}>• {it.quantidade} {p?.unidade || ""} de {p?.nome || "produto"}</div>); })}</div>}</div>
      <div style={{ color: C.cinza }} className="text-sm mb-3">Quer anexar uma foto? É opcional.</div>
      {foto ? (<div style={{ position: "relative", marginBottom: 12 }}><img src={foto} alt="" style={{ borderRadius: 12, width: "100%", maxHeight: 200, objectFit: "cover" }} /><button onClick={() => { setFoto(null); setUrl(null); }} style={{ position: "absolute", top: 8, right: 8, background: "#000a", color: "#fff", borderRadius: 999, padding: 6 }}><X size={16} /></button></div>) : (salvando ? (
        <div style={{ width: "100%", border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, textAlign: "center", fontWeight: 600, marginBottom: 12 }}>Enviando…</div>
      ) : (
        <div className="flex gap-2" style={{ marginBottom: 12 }}>
          <button onClick={() => camRef.current?.click()} style={{ flex: 1, border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600 }}><Camera size={18} /> Tirar foto</button>
          <button onClick={() => fileRef.current?.click()} style={{ flex: 1, border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600 }}><Images size={18} /> Da galeria</button>
        </div>
      ))}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={escolher} style={{ display: "none" }} />
      <input ref={fileRef} type="file" accept="image/*" onChange={escolher} style={{ display: "none" }} />
      <button onClick={() => onConfirmar(url)} style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Check size={20} strokeWidth={3} /> Marcar como concluída</button>
    </Sheet>
  );
}

/* ============================= MODAL: INFO ============================= */
function InfoModal({ onFechar }) {
  const areaPrincipal = 61217.65, deck = 501.66, total = areaPrincipal + deck;
  const Linha = ({ l, v }) => (<div className="flex justify-between py-2" style={{ borderTop: `1px solid ${C.bg}` }}><span style={{ color: C.cinza }}>{l}</span><span className="font-bold">{v}</span></div>);
  return (
    <Sheet titulo="Rancho Abdalla" onFechar={onFechar}>
      <div style={{ background: C.pastoClaro, borderRadius: 14 }} className="p-4 mb-3 text-center"><div style={{ color: C.cinza }} className="text-xs uppercase font-semibold">Área total da propriedade</div><div className="font-bold" style={{ fontSize: 30, color: C.pastoEsc }}>{total.toLocaleString("pt-BR")} m²</div><div style={{ color: C.cinza }} className="text-sm">{(total / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} hectares</div></div>
      <Linha l="Área principal" v={`${areaPrincipal.toLocaleString("pt-BR")} m²`} />
      <Linha l="Deck do lago" v={`${deck.toLocaleString("pt-BR")} m²`} />
      <Linha l="Perímetro principal" v="1.208,82 m" />
      <Linha l="Localização" v="Tocantins, BR" />
      <div style={{ color: C.cinzaClaro, fontSize: 12 }} className="mt-3 flex items-center gap-1"><Info size={12} /> Área total = área principal + deck do lago.</div>
    </Sheet>
  );
}

/* ============================= BASE ============================= */
const inpSt = { width: "100%", border: `1px solid ${C.linha}`, borderRadius: 10, padding: "11px 12px", fontSize: 15, background: "#fff", outline: "none", color: C.terra, boxSizing: "border-box", fontFamily: "inherit" };
const lblSt = { fontSize: 12.5, fontWeight: 600, color: C.cinza, marginBottom: 5 };
function Campo({ label, children }) { return <div className="mb-3"><div style={lblSt}>{label}</div>{children}</div>; }
function Chip({ icon: Ic, texto, cor }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: cor + "1a", color: cor, borderRadius: 999, padding: "3px 9px", fontSize: 12, fontWeight: 600 }}>{Ic && <Ic size={12} />}{texto}</span>; }
function Toggle({ on, onToggle }) { return (<button onClick={onToggle} style={{ width: 46, height: 27, borderRadius: 999, background: on ? C.ambar : C.cinzaClaro, position: "relative" }}><span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: "#fff" }} /></button>); }
function Vazio({ icon: Ic, titulo, texto }) { return (<div className="text-center py-10"><div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 999, width: 62, height: 62, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Ic size={28} style={{ color: C.cinzaClaro }} /></div><div className="font-bold" style={{ color: C.terra }}>{titulo}</div><div style={{ color: C.cinza }} className="text-sm mt-1 px-6">{texto}</div></div>); }
function DialogHost() {
  const [d, setD] = React.useState(null);
  const [texto, setTexto] = React.useState("");
  React.useEffect(() => { _openDialog = (dd) => { setTexto(dd.valor != null ? String(dd.valor) : ""); setD(dd); }; return () => { _openDialog = null; }; }, []);
  if (!d) return null;
  const fechar = (val) => { const r = d.resolve; setD(null); r(val); };
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "#0007", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }, onClick: () => fechar(d.tipo === "confirm" ? false : null) },
    React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 360, padding: 18, boxShadow: "0 12px 34px #0004" } },
      d.titulo ? React.createElement("div", { style: { fontWeight: 700, fontSize: 17, marginBottom: 6, color: C.terra } }, d.titulo) : null,
      d.mensagem ? React.createElement("div", { style: { color: C.cinza, fontSize: 14, marginBottom: 14, lineHeight: 1.4 } }, d.mensagem) : null,
      d.tipo === "prompt" ? React.createElement("input", { autoFocus: true, value: texto, type: d.inputType || "text", onChange: (e) => setTexto(e.target.value), style: { ...inpSt, marginBottom: 14 } }) : null,
      React.createElement("div", { style: { display: "flex", gap: 8 } },
        React.createElement("button", { onClick: () => fechar(d.tipo === "confirm" ? false : null), style: { flex: 1, padding: 12, borderRadius: 10, fontWeight: 600, color: C.cinza, background: C.bg, border: "none" } }, d.cancelLabel || "Cancelar"),
        React.createElement("button", { onClick: () => fechar(d.tipo === "confirm" ? true : texto), style: { flex: 1, padding: 12, borderRadius: 10, fontWeight: 700, color: "#fff", background: d.perigo ? C.vermelho : C.pasto, border: "none" } }, d.okLabel || "OK")
      )
    )
  );
}
function Sheet({ titulo, onFechar, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0006", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
        <div style={{ position: "sticky", top: 0, background: C.bg, padding: "16px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}><div className="font-bold text-lg">{titulo}</div><button onClick={onFechar} style={{ background: C.card, borderRadius: 999, padding: 7, border: `1px solid ${C.linha}` }}><X size={18} /></button></div>
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}
