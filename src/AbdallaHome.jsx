import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ListTodo, CalendarDays, ShoppingCart, Package, Users, Plus, Check,
  Camera, Bell, X, Trash2, Pencil, Info, MapPin, Fuel, Wrench, Wine,
  ShoppingBasket, Repeat, Clock, User, RefreshCw, Star, Smartphone, Tag, Lock, Search, ArrowDownToLine, ArrowUpFromLine, Mail, LogOut, KeyRound, BarChart3, ChevronLeft, ChevronRight, UserPlus, MessageCircle, Copy, Shuffle, CheckCircle2, MoreVertical, Images, Home, Moon, Sun, Power, Layers,
  ChevronDown, Lightbulb, Fan, Snowflake, Tv, Speaker, Volume2, VolumeX, CloudSun, CloudMoon, Cloud, Cloudy, CloudFog, CloudDrizzle, CloudRain, CloudRainWind, CloudLightning, Zap, Wind, SunMedium, Umbrella, WavesLadder, Funnel, Bubbles, Flame, Link2, Radio, SkipBack, SkipForward, Play, Pause, Droplets, Blinds, DoorOpen, DoorClosed, LockOpen, Gauge, ToyBrick, ShieldCheck, Music, LayoutGrid, EyeOff, ArrowLeftRight, Undo2, Menu, ChevronUp, Rewind, FastForward, Thermometer, AirVent, CircleDot, Minus,
  LampDesk,
} from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "./supabaseClient";
import CATALOGO_LAB from "./catalogoLab.json"; // aparelhos do painel LAB do Home Assistant (lista revisada)

/* ============================================================
   ABDALLA HOME — Rancho Abdalla
   Tarefas + Compras + Estoque (catálogo + autocomplete)
   Dados no Supabase (Auth + Postgres + Realtime + Storage)
   ============================================================ */

// Cores vindas das variaveis de CSS (ver src/index.css) — permite o modo noturno.
const C = {
  bg: "var(--c-bg,#f6f3ea)", card: "var(--c-card,#ffffff)", linha: "var(--c-linha,#e6dfcd)",
  pasto: "var(--c-pasto,#2f7d4f)", pastoEsc: "var(--c-pastoEsc,#1f5c39)", pastoClaro: "var(--c-pastoClaro,#e6f2ea)",
  lago: "var(--c-lago,#2b7a8c)", lagoClaro: "var(--c-lagoClaro,#e2f0f2)", areia: "var(--c-areia,#efe7d4)",
  terra: "var(--c-terra,#33302a)", cinza: "var(--c-cinza,#726b5e)", cinzaClaro: "var(--c-cinzaClaro,#a49c8c)",
  ambar: "var(--c-ambar,#c8862a)", ambarClaro: "var(--c-ambarClaro,#fbf0dc)", vermelho: "var(--c-vermelho,#b34a3a)", vermelhoClaro: "var(--c-vermelhoClaro,#f7e6e2)",
  ambarTexto: "var(--c-ambarTexto,#8f5c10)", cabecalho: "var(--c-cabecalho,#1f5c39)",
  nivel: "var(--c-nivel,#fbf9f4)", nivelBorda: "var(--c-nivelBorda,#e6dfcd)", tela: "var(--c-tela,#f6f3ea)", aceso: "var(--c-aceso,#f2ae2e)",
  nivelSombra: "var(--c-nivelSombra,none)", comodoSombra: "var(--c-comodoSombra,none)",
};
const alfa = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}%, transparent)`;

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

// Troca claro/escuro: <html data-theme>, guarda no aparelho e pinta a barra do celular.
function aplicarTema(novo) {
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem("tema", novo); } catch { /* ok */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", novo === "dark" ? "#0e1a12" : "#1f5c39");
}

/* global __BUILD_ID__ */
// Número desta versão do app (injetado no build). Serve para detectar atualização.
const APP_BUILD = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Data de HOJE no fuso do aparelho (Tocantins). toISOString() usaria UTC e, depois
// das 21h, o app já consideraria "amanhã" (conclusões e tarefas no dia errado).
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
let _openDialog = null;
const Dialog = {
  confirm: (o) => new Promise((res) => { if (_openDialog) _openDialog({ tipo: "confirm", ...o, resolve: res }); else res(false); }),
  prompt: (o) => new Promise((res) => { if (_openDialog) _openDialog({ tipo: "prompt", ...o, resolve: res }); else res(null); }),
};
const papelLabel = (p) => (p === "admin" ? "Administrador" : p === "crianca" ? "Criança" : p === "visitante" ? "Visitante" : "Colaborador");
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
// A tarefa foi concluída em algum dia do período [de, ate] (datas ISO)?
function concluidaEntre(t, de, ate) {
  if (t.tipo === "unica") {
    if (t.status !== "concluida" || !t.concluidaEm) return false;
    const iso = isoLocal(t.concluidaEm);
    return iso >= de && iso <= ate;
  }
  return Object.keys(t.conclusoes || {}).some((iso) => iso >= de && iso <= ate);
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
const mapPerfil = (r) => ({ id: r.id, nome: r.nome, papel: r.papel, telefone: r.telefone || "", setor: r.setor || "", ativo: r.ativo !== false, podeControle: r.pode_controle === true, podeGerirControle: r.pode_gerir_controle === true, podeMenuControle: r.pode_menu_controle === true, podePersonalizar: r.pode_personalizar === true, podeGerarVisitante: r.pode_gerar_visitante === true, spotifyEntity: r.spotify_entity || null, podeGerirEquipe: r.pode_gerir_equipe !== false, expiraEm: r.expira_em ? new Date(r.expira_em).getTime() : null });
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
    imagemUrl: r.imagem_url || (Array.isArray(r.imagens) ? r.imagens[0] : null) || null, imagens: (Array.isArray(r.imagens) && r.imagens.length) ? r.imagens : (r.imagem_url ? [r.imagem_url] : []), ehCompra: !!r.eh_compra, status: r.status || "pendente", setor: r.setor || "", estoqueAplicado: !!r.estoque_aplicado, darEntrada: r.dar_entrada !== false,
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
    imagens: Array.isArray(d.imagens) ? d.imagens : (d.imagemUrl ? [d.imagemUrl] : []),
    imagem_url: (Array.isArray(d.imagens) && d.imagens[0]) || d.imagemUrl || null,
    eh_compra: !!d.ehCompra,
    dar_entrada: d.ehCompra ? (d.darEntrada !== false) : true,
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
  const [logandoQR, setLogandoQR] = useState(() => /[#&]v=/.test((typeof window !== "undefined" && window.location.hash) || ""));
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
  const [tema, setTema] = useState(() => (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark") ? "dark" : "light");
  const alternarTema = () => { const novo = tema === "dark" ? "light" : "dark"; aplicarTema(novo); setTema(novo); };
  const [rota, setRota] = useState(() => (window.location.hash || "").replace(/^#/, ""));
  useEffect(() => { const h = () => setRota((window.location.hash || "").replace(/^#/, "")); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  const [produtosAberto, setProdutosAberto] = useState(false);
  const [avisos, setAvisos] = useState([]);

  const meIdRef = useRef(null);
  const timersRef = useRef({});
  const seedRef = useRef(false);

  const eu = perfil && typeof perfil === "object" ? perfil : null;
  const euId = eu?.id || null;
  const souAdmin = eu?.papel === "admin";
  // Editar/excluir: administrador pode tudo; colaborador só o que ele mesmo criou.
  const podeMexer = (t) => souAdmin || (!!euId && t.criadoPorId === euId);
  const souCrianca = eu?.papel === "crianca";
  const souVisitante = eu?.papel === "visitante";
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
    else if (meu) setPerfil(meu.papel === "visitante" && meu.expiraEm && Date.now() > meu.expiraEm ? "expirado" : meu);
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

  // ---------- Acesso por QR Code (visitante): loga sozinho a partir da hash #v= ----------
  useEffect(() => {
    const entrarPeloQR = () => {
      const m = (window.location.hash || "").match(/[#&]v=([^&]+)/);
      if (!m) return;
      let email = "", senha = "";
      try { const dec = atob(decodeURIComponent(m[1])); const i = dec.indexOf(":"); email = dec.slice(0, i); senha = dec.slice(i + 1); } catch { /* QR inválido */ }
      history.replaceState(null, "", window.location.pathname + window.location.search); // tira a credencial da URL
      if (!email || !senha) { setLogandoQR(false); return; }
      setLogandoQR(true);
      (async () => {
        // Se já tem alguém logado neste celular, confirma antes de trocar para o visitante.
        const { data } = await supabase.auth.getSession();
        if (data.session && !window.confirm("Este QR Code é de um acesso de visitante. Entrar com ele vai sair da conta atual. Continuar?")) { setLogandoQR(false); return; }
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) { setLogandoQR(false); window.alert("Este QR Code não vale mais. Peça um novo ao administrador do rancho."); }
      })();
    };
    entrarPeloQR();
    // Também quando o app já está aberto e o link só troca o endereço (#v=...).
    window.addEventListener("hashchange", entrarPeloQR);
    return () => window.removeEventListener("hashchange", entrarPeloQR);
  }, []);
  useEffect(() => { if (session) setLogandoQR(false); }, [session]);

  // ---------- Carrega o perfil da pessoa logada ----------
  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setPerfil(null); meIdRef.current = null; setCarregado(false); return; }
    meIdRef.current = session.user.id;
    (async () => {
      const { data } = await supabase.from("perfis").select("*").eq("id", session.user.id).maybeSingle();
      if (!data || data.ativo === false) setPerfil("removido");
      else { const pf = mapPerfil(data); if (pf.papel === "visitante" && pf.expiraEm && Date.now() > pf.expiraEm) setPerfil("expirado"); else setPerfil(pf); }
    })();
  }, [session]);

  // ---------- Primeiro carregamento dos dados + Realtime ----------
  useEffect(() => {
    // Criança e visitante só usam o Controle: não carregam (nem veem) dados do app de tarefas.
    if (!eu || eu.papel === "crianca" || eu.papel === "visitante") return;
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

  // "local": sai só deste aparelho. O padrão ("global") derrubava a mesma conta em todos
  // os outros celulares — ex.: o QR do visitante aberto em dois aparelhos.
  const sair = async () => { await supabase.auth.signOut({ scope: "local" }); setPerfil(null); };

  // Visitante: se o prazo vencer com o app aberto, bloqueia na hora.
  useEffect(() => {
    if (!eu?.expiraEm) return;
    const conferir = () => { if (Date.now() > eu.expiraEm) setPerfil("expirado"); };
    conferir();
    const iv = setInterval(conferir, 60000);
    return () => clearInterval(iv);
  }, [eu?.expiraEm]);

  // ---------- Lembretes locais (15 min antes) ----------
  // Cada lembrete avisa uma vez por dia: dispensar no X não faz ele voltar.
  const avisadosRef = useRef(new Set());
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
        const chave = t.id + ":" + iso;
        if (diff <= 15 && diff >= -1 && !avisadosRef.current.has(chave)) {
          avisadosRef.current.add(chave);
          setAvisos((p) => [...p, { id: t.id, titulo: t.titulo, hora: t.horaInicio }]);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const titulo = "Abdalla Home — tarefa em breve", corpo = `${t.titulo} às ${t.horaInicio}`;
            // No Android, "new Notification" não funciona: a notificação precisa sair pelo service worker.
            // Mesma "tag" do push do servidor, então as duas não aparecem repetidas.
            const porSW = navigator.serviceWorker?.ready.then((reg) => reg.showNotification(titulo, { body: corpo, icon: "./icon-192.png", tag: "tarefa-" + t.id }));
            if (!porSW) { try { new Notification(titulo, { body: corpo }); } catch { /* sem suporte */ } }
          }
        }
      });
    };
    check(); const iv = setInterval(check, 30000); return () => clearInterval(iv);
  }, [carregado, tasks, euId]);

  // Se deixar de ser admin (ex.: rebaixado em tempo real), sai das abas restritas.
  useEffect(() => {
    if (!souAdmin && (aba === "painel" || (aba === "equipe" && !eu?.podeGerarVisitante))) setAba("tarefas");
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

  // Família (quem tem o Controle e não é colaborador): o app abre direto no Controle da Casa.
  const abriuControle = useRef(false);
  useEffect(() => {
    if (abriuControle.current || !eu) return;
    abriuControle.current = true;
    if (!window.location.hash && eu.papel !== "colaborador" && (eu.podeControle || eu.podeGerirControle)) window.location.hash = "controle";
  }, [eu]);

  const atualizarAgora = async () => {
    try { if ("caches" in window) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } } catch { /* ok */ }
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update(); } catch { /* ok */ }
    // Recarrega furando o cache do navegador (URL única).
    window.location.href = import.meta.env.BASE_URL + "?v=" + Date.now() + window.location.hash;
  };

  // ---------- Mutações (gravam no Supabase; o realtime propaga aos outros) ----------
  async function salvarTarefa(dados) {
    const row = tarefaRow(dados);
    if (dados.id) {
      const { error } = await supabase.from("tarefas").update(row).eq("id", dados.id);
      if (error) { showToast("Não consegui salvar: " + error.message); return; }
      if (dados.ehCompra) {
        const del = await supabase.from("compra_itens").delete().eq("tarefa_id", dados.id);
        const itens = itensDaCompra(dados).filter((i) => i.produtoId && parseFloat(i.quantidade) > 0);
        const ins = itens.length ? await supabase.from("compra_itens").insert(itens.map((i) => ({ tarefa_id: dados.id, produto_id: i.produtoId, quantidade: parseFloat(i.quantidade) }))) : { error: null };
        if (del.error || ins.error) { showToast("Salvei a compra, mas os itens deram erro: " + (del.error || ins.error).message); reloadTarefas(); return; }
      }
      showToast("Tarefa atualizada");
    } else {
      const { data, error } = await supabase.from("tarefas").insert({ ...row, criado_por_id: euId, status: "pendente" }).select().single();
      if (error) { showToast("Não consegui criar: " + error.message); return; }
      if (dados.ehCompra) {
        const itens = itensDaCompra(dados).filter((i) => i.produtoId && parseFloat(i.quantidade) > 0);
        const ins = itens.length ? await supabase.from("compra_itens").insert(itens.map((i) => ({ tarefa_id: data.id, produto_id: i.produtoId, quantidade: parseFloat(i.quantidade) }))) : { error: null };
        if (ins.error) { showToast("Criei a compra, mas os itens deram erro: " + ins.error.message); reloadTarefas(); setModal(null); return; }
      }
      showToast("Tarefa criada");
    }
    reloadTarefas();
    setModal(null);
  }

  async function concluirTarefa(t, fotoUrl) {
    const iso = hojeISO();
    const { error } = t.tipo === "unica"
      ? await supabase.from("tarefas").update({ status: "concluida", concluida_em: new Date().toISOString(), foto_conclusao_url: fotoUrl || t.fotoConclusaoUrl || null, concluida_por_id: euId }).eq("id", t.id)
      : await supabase.from("conclusoes").upsert({ tarefa_id: t.id, data: iso, user_id: euId, foto_url: fotoUrl || null }, { onConflict: "tarefa_id,data" });
    if (error) { showToast("Não consegui concluir: " + error.message); return; }
    const itensC = t.ehCompra ? itensDaCompra(t) : [];
    if (itensC.length && t.darEntrada !== false) {
      // Só entra no estoque na PRIMEIRA conclusão desta compra. A "reserva" é atômica:
      // só quem virar a marca de não-aplicado para aplicado dá a entrada. Evita estoque
      // em dobro com dois toques rápidos ou dois celulares ao mesmo tempo.
      const { data: reserva, error: eRes } = await supabase.from("tarefas").update({ estoque_aplicado: true }).eq("id", t.id).or("estoque_aplicado.is.null,estoque_aplicado.eq.false").select("id");
      if (eRes) showToast("Compra concluída, mas não consegui lançar no estoque: " + eRes.message);
      else if (reserva && reserva.length) {
        await aplicarMovimentos(itensC.map((it) => ({ produtoId: it.produtoId, quantidade: it.quantidade })), "entrada", "compra");
        showToast(itensC.length === 1 ? "Compra concluída • item no estoque" : `Compra concluída • ${itensC.length} itens no estoque`);
      } else {
        showToast("Compra concluída (já estava no estoque)");
      }
    } else if (t.ehCompra) {
      showToast(itensC.length && t.darEntrada === false ? "Compra concluída (sem entrada no estoque)" : "Compra concluída ✓");
    } else showToast("Tarefa concluída ✓");
    setAvisos((p) => p.filter((a) => a.id !== t.id));
    reloadTarefas();
  }

  async function reabrir(t) {
    const iso = hojeISO();
    const { error } = t.tipo === "unica"
      ? await supabase.from("tarefas").update({ status: "pendente", concluida_em: null, concluida_por_id: null }).eq("id", t.id)
      : await supabase.from("conclusoes").delete().eq("tarefa_id", t.id).eq("data", iso);
    if (error) showToast("Não consegui reabrir: " + error.message);
    reloadTarefas();
  }

  async function excluirTarefa(id) {
    await supabase.from("compra_itens").delete().eq("tarefa_id", id);
    await supabase.from("conclusoes").delete().eq("tarefa_id", id);
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    reloadTarefas();
    showToast(error ? "Não consegui excluir: " + error.message : "Tarefa excluída");
  }

  async function trocarResponsavel(t, novoId) {
    const { error } = await supabase.from("tarefas").update({ responsavel_id: novoId || null }).eq("id", t.id);
    reloadTarefas();
    showToast(error ? "Não consegui trocar: " + error.message : "Responsável alterado");
  }

  // Movimenta o estoque. Caminho principal: função "mover_estoque" no banco, que faz a
  // conta de uma vez só (dois celulares ao mesmo tempo não se apagam). Se ela ainda não
  // existir no banco, usa o cálculo antigo aqui no app.
  async function aplicarMovimento(produtoId, tipo, quantidade, origem) {
    const qtd = Math.abs(parseFloat(quantidade) || 0);
    if (!produtoId || qtd <= 0) return;
    await aplicarMovimentos([{ produtoId, quantidade: qtd }], tipo, origem);
  }

  async function aplicarMovimentos(lista, tipo, origem) {
    const validos = (lista || []).filter((m) => m.produtoId && (parseFloat(m.quantidade) || 0) > 0);
    if (!validos.length) return;
    let semFuncao = false;
    for (const m of validos) {
      const { error } = await supabase.rpc("mover_estoque", { p_produto: m.produtoId, p_tipo: tipo, p_qtd: Math.abs(parseFloat(m.quantidade)), p_origem: origem || "manual" });
      if (error?.code === "PGRST202") { semFuncao = true; break; } // função ainda não criada no banco
      if (error) { showToast("Não consegui atualizar o estoque: " + error.message); break; }
    }
    if (semFuncao) await aplicarMovimentosNoApp(validos, tipo, origem);
    reloadEstoque(); reloadMovs();
  }

  // Cálculo antigo (lê, soma e grava) — só usado enquanto "mover_estoque" não existir.
  async function aplicarMovimentosNoApp(validos, tipo, origem) {
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
    const { error } = await supabase.from("estoque").upsert(Object.entries(ups).map(([produto_id, quantidade]) => ({ produto_id, quantidade })), { onConflict: "produto_id" });
    if (error) { showToast("Não consegui atualizar o estoque: " + error.message); return; }
    if (novasMovs.length) await supabase.from("movimentacoes").insert(novasMovs);
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

  // Barra "Nova versão" (bottom: altura acima da barra de abas; no Controle não há abas).
  const barraAtualizar = (bottom) => temAtualizacao && (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom, width: "calc(100% - 24px)", maxWidth: 436, background: C.pastoEsc, color: "#fff", borderRadius: 14, padding: "10px 12px", zIndex: 65, boxShadow: "0 8px 22px #0004", display: "flex", alignItems: "center", gap: 10 }}>
      <RefreshCw size={18} style={{ flexShrink: 0 }} />
      <div className="flex-1" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>Nova versão disponível</div>
      <button onClick={() => setTemAtualizacao(false)} title="Agora não" style={{ color: "#ffffffcc", padding: 4 }}><X size={18} /></button>
      <button onClick={atualizarAgora} style={{ background: C.card, color: C.pastoEsc, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 14 }}>Atualizar</button>
    </div>
  );

  // ---------- Telas de porta de entrada ----------
  if (session === undefined || perfil === undefined) return <TelaCarregando />;
  if (!session) return logandoQR ? <TelaCarregando /> : (<><LoginScreen /><InstalarPrompt /><DialogHost /></>);
  if (perfil === "removido") return (<><AcessoRemovido onSair={sair} /><DialogHost /></>);
  if (perfil === "expirado") return (<><AcessoExpirado onSair={sair} /><DialogHost /></>);
  // Criança e visitante: só o Controle da Casa, sem o app de tarefas (nem carregam os dados dele).
  if (souCrianca || souVisitante) {
    return (<><ControleApp eu={eu} onSair={sair} />{barraAtualizar(16)}</>);
  }
  if (!carregado) return <TelaCarregando />;

  // App separado de Controle da Casa (mesmo login), aberto por #controle.
  if (rota === "controle") {
    return (<>{barraAtualizar(16)}{(eu?.podeControle || eu?.podeGerirControle)
      ? <ControleApp eu={eu} onVoltar={() => { window.location.hash = ""; }} onSair={sair}
          onEquipe={souAdmin || eu?.podeGerarVisitante ? () => { setAba("equipe"); window.location.hash = ""; } : null}
          onSobre={souAdmin ? () => { setInfoAberto(true); window.location.hash = ""; } : null} />
      : <ControleSemAcesso onVoltar={() => { window.location.hash = ""; }} />}</>);
  }

  const ABAS = [
    { id: "tarefas", nome: "Tarefas", icon: ListTodo },
    { id: "agenda", nome: "Agenda", icon: CalendarDays },
    { id: "compras", nome: "Compras", icon: ShoppingCart },
    { id: "estoque", nome: "Estoque", icon: Package },
    ...(souAdmin ? [{ id: "painel", nome: "Painel", icon: BarChart3 }] : []), // Equipe fica no menu ⋮
  ];

  return (
    <div style={{ background: C.tela, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: C.terra }}>
      <div className="mx-auto" style={{ maxWidth: 460, position: "relative", minHeight: "100vh", paddingBottom: 88 }}>

        {/* Cabeçalho fixo no alto (não rola com a tela). */}
        <header style={{ background: C.cabecalho, color: "#fff", padding: "14px 16px 14px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22, position: "sticky", top: 0, zIndex: 45 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Ícone de localização: leva ao Controle da Casa (quem tem acesso). */}
              {(eu?.podeControle || eu?.podeGerirControle)
                ? <button onClick={() => { window.location.hash = "controle"; }} title="Ir para o Controle da Casa" aria-label="Ir para o Controle da Casa" style={{ background: "#ffffff22", borderRadius: 12, padding: 7, display: "flex", color: "#fff" }}><MapPin size={20} /></button>
                : <div style={{ background: "#ffffff22", borderRadius: 12, padding: 7 }}><MapPin size={20} /></div>}
              <div><div className="font-bold text-lg leading-tight">Abdalla Home</div><div style={{ color: "#ffffffcc" }} className="text-xs leading-tight">Rancho Abdalla</div></div>
            </div>
            <div className="flex items-center gap-2">
              <BotaoTempo />
              <MenuPontinhos aberto={menuAberto} setAberto={setMenuAberto} itens={[
                ...(!estaInstalado() ? [{ key: "inst", icon: ArrowDownToLine, cor: C.pasto, txt: "Instalar app", on: () => _installOpen.fn && _installOpen.fn() }] : []),
                ...(souAdmin || eu?.podeGerarVisitante ? [{ key: "equipe", icon: Users, cor: C.pasto, txt: "Equipe", on: () => setAba("equipe") }] : []),
                { key: "tema", icon: tema === "dark" ? Sun : Moon, cor: C.ambar, txt: tema === "dark" ? "Modo claro" : "Modo noturno", on: alternarTema },
                ...(souAdmin ? [{ key: "sobre", icon: Info, cor: C.lago, txt: "Sobre a propriedade", on: () => setInfoAberto(true) }] : []),
                { key: "sair", icon: LogOut, cor: C.vermelho, txt: "Sair", on: async () => { if (await Dialog.confirm({ titulo: "Sair", mensagem: "Deseja sair desta conta?", okLabel: "Sair" })) sair(); } },
              ]} />
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
              <div key={a.id} style={{ background: C.ambarClaro, border: `1px solid ${alfa(C.ambar, 33)}`, borderRadius: 12 }} className="p-3 mb-2 flex items-center gap-2">
                <Bell size={18} style={{ color: C.ambar }} /><div className="flex-1 text-sm"><b>Começa às {a.hora}:</b> {a.titulo}</div>
                <button onClick={() => setAvisos((p) => p.filter((x) => x.id !== a.id))}><X size={16} style={{ color: C.cinza }} /></button>
              </div>
            ))}
          </div>
        )}

        <main className="px-3 pt-3">
          {aba === "tarefas" && <TarefasView {...{ tasks, users, euId, souAdmin, meuSetor: eu?.setor || "", filtro, setFiltro, podeMexer, onConcluir: (t) => setModal({ tipo: "concluir", task: t }), onReabrir: reabrir, onEditar: (t) => setModal({ tipo: "tarefa", task: t }), onExcluir: excluirTarefa, onTrocar: trocarResponsavel, onAbrir: (t) => setModal({ tipo: "detalhe", task: t }) }} />}
          {aba === "agenda" && <AgendaView {...{ tasks, users, souAdmin, meuSetor: eu?.setor || "", euId }} />}
          {aba === "compras" && <ComprasView {...{ tasks, produtos, podeMexer, onConcluir: (t) => setModal({ tipo: "concluir", task: t }), onEditar: (t) => setModal({ tipo: "tarefa", task: t }), onExcluir: excluirTarefa, onReabrir: reabrir, onAbrir: (t) => setModal({ tipo: "detalhe", task: t }) }} />}
          {aba === "estoque" && <EstoqueView {...{ produtos, estoque, movs, users, onAjustar: ajustarEstoque, onAbrirProdutos: () => setProdutosAberto(true), onMovimento: (mv) => setModal({ tipo: "movimento", mov: mv }), onSaidaRapida: saidaRapida }} />}
          {aba === "painel" && souAdmin && <PainelView {...{ tasks, users }} />}
          {/* Admin com "Pode mexer na equipe" desligado vê a Equipe como quem só gera visitante. */}
          {aba === "equipe" && (souAdmin || eu?.podeGerarVisitante) && <EquipeView {...{ users, souAdmin: souAdmin && eu?.podeGerirEquipe !== false, euId, showToast, onRecarregar: reloadPerfis }} />}
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
        {modal?.tipo === "detalhe" && <DetalheTarefaModal {...{ t: modal.task, users, produtos, podeEditar: podeMexer(modal.task), onFechar: () => setModal(null), onEditar: (t) => setModal({ tipo: "tarefa", task: t }) }} />}
        {modal?.tipo === "concluir" && <ConcluirModal {...{ task: modal.task, produtos, showToast, onFechar: () => setModal(null), onConfirmar: (fotoUrl) => { concluirTarefa(modal.task, fotoUrl); setModal(null); } }} />}
        {infoAberto && <InfoModal onFechar={() => setInfoAberto(false)} />}
        {produtosAberto && <ProdutosModal {...{ produtos, onCadastrar: cadastrarProduto, onRemover: removerProduto, onRenomear: renomearProduto, onFechar: () => setProdutosAberto(false) }} />}
        {modal?.tipo === "movimento" && <MovimentoModal {...{ tipo: modal.mov, produtos, estoque, onFechar: () => setModal(null), onAplicar: (lista) => { aplicarMovimentos(lista, modal.mov, "manual"); showToast((modal.mov === "saida" ? "Saída" : "Entrada") + " registrada (" + lista.length + (lista.length === 1 ? " item" : " itens") + ")"); setModal(null); } }} />}

        {toast && <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: C.terra, color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 60, boxShadow: "0 4px 14px #0003", whiteSpace: "nowrap" }}>{toast}</div>}
        {barraAtualizar(74)}
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

function AcessoExpirado({ onSair }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: C.terra, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="mx-auto w-full px-5 text-center" style={{ maxWidth: 400 }}>
        <div style={{ background: C.ambarClaro, borderRadius: 18, width: 66, height: 66, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Clock size={30} style={{ color: C.ambar }} /></div>
        <div className="font-bold text-2xl" style={{ color: C.terra }}>Acesso expirado</div>
        <div style={{ color: C.cinza }} className="text-sm mt-2 px-2">O prazo do seu acesso de visitante terminou. Peça um novo QR Code ao administrador do Rancho Abdalla.</div>
        <button onClick={onSair} style={{ marginTop: 22, background: C.pasto, color: "#fff", borderRadius: 12, padding: "13px 22px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}><LogOut size={17} /> Sair</button>
      </div>
    </div>
  );
}

/* ============================= TAREFAS ============================= */
function TarefasView({ tasks, users, euId, souAdmin, meuSetor, filtro, setFiltro, podeMexer, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }) {
  const [periodoFeitas, setPeriodoFeitas] = useState("hoje"); // hoje | semana
  let lista = tasks.filter((t) => !t.ehCompra);
  // Colaborador só enxerga o próprio setor (e o que estiver no nome dele).
  if (!souAdmin) lista = lista.filter((t) => (meuSetor && t.setor === meuSetor) || t.responsavelId === euId);
  if (filtro === "minhas") lista = lista.filter((t) => t.responsavelId === euId);
  else if (filtro.startsWith("setor:")) { const s = filtro.slice(6); lista = lista.filter((t) => t.setor === s); }
  const pendentes = lista.filter((t) => !isConcluida(t));
  const hoje = hojeISO();
  const feitasHoje = lista.filter((t) => concluidaEntre(t, hoje, hoje));
  // Histórico da semana: cada conclusão (dia + quem fez) desta semana.
  const segIso = isoLocal(inicioSemana(new Date()));
  const historicoSemana = [];
  lista.forEach((t) => {
    if (t.tipo === "unica") {
      if (t.status === "concluida" && t.concluidaEm) { const iso = isoLocal(t.concluidaEm); if (iso >= segIso && iso <= hoje) historicoSemana.push({ t, iso, userId: t.concluidaPorId || t.responsavelId }); }
    } else {
      Object.entries(t.conclusoes || {}).forEach(([iso, c]) => { if (iso >= segIso && iso <= hoje) historicoSemana.push({ t, iso, userId: c.userId || t.responsavelId }); });
    }
  });
  historicoSemana.sort((a, b) => b.iso.localeCompare(a.iso));
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
      {pendentes.map((t) => <CardTarefa key={t.id} {...{ t, users, podeMexer, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }} />)}
      {(feitasHoje.length > 0 || historicoSemana.length > 0) && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div style={{ color: C.cinza }} className="text-xs font-semibold uppercase flex-1">Concluídas</div>
            {[{ id: "hoje", n: "Hoje" }, { id: "semana", n: "Na semana" }].map((o) => (
              <button key={o.id} onClick={() => setPeriodoFeitas(o.id)} style={{ background: periodoFeitas === o.id ? C.pasto : C.card, color: periodoFeitas === o.id ? "#fff" : C.cinza, border: `1px solid ${periodoFeitas === o.id ? C.pasto : C.linha}`, borderRadius: 999, padding: "4px 12px", fontWeight: 600, fontSize: 12 }}>{o.n}</button>
            ))}
          </div>
          {periodoFeitas === "hoje"
            ? (feitasHoje.length ? feitasHoje.map((t) => <CardTarefa key={t.id} {...{ t, users, podeMexer, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }} />) : <div style={{ color: C.cinzaClaro, fontSize: 13 }} className="px-1 pb-2">Nenhuma tarefa concluída hoje.</div>)
            : (historicoSemana.length ? historicoSemana.map((h, i) => (
                <div key={h.t.id + h.iso + i} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12 }} className="p-3 mb-2 flex items-center gap-3">
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: C.pasto, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={15} color="#fff" strokeWidth={3} /></div>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate" style={{ fontSize: 14.5, color: C.terra }}>{h.t.titulo}</div><div style={{ color: C.cinzaClaro, fontSize: 12 }}>Feito por {nomeUser(users, h.userId)}</div></div>
                  <span style={{ color: C.cinza, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtData(h.iso)}</span>
                </div>
              )) : <div style={{ color: C.cinzaClaro, fontSize: 13 }} className="px-1 pb-2">Nenhuma tarefa concluída nesta semana.</div>)}
        </div>
      )}
    </div>
  );
}
function CardTarefa({ t, users, podeMexer, onConcluir, onReabrir, onEditar, onExcluir, onTrocar, onAbrir }) {
  const iso = hojeISO();
  const feito = isConcluida(t, iso);
  const [abrirResp, setAbrirResp] = useState(false);
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
          {(t.imagens && t.imagens.length > 0) && (
            <button onClick={() => onAbrir && onAbrir(t)} title="Ver fotos e detalhes" style={{ display: "block", position: "relative", width: "100%", marginTop: 8, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.linha}` }}>
              <img src={t.imagens[0]} alt="Foto da tarefa" style={{ display: "block", maxHeight: 130, width: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", right: 8, bottom: 8, background: "#0009", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Search size={12} /> {t.imagens.length > 1 ? `Ver ${t.imagens.length} fotos` : "Ver foto"}</span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="relative">
              <button onClick={() => setAbrirResp((v) => !v)} title="Responsável (de quem é a tarefa)" style={{ background: C.pastoClaro, color: C.pastoEsc, borderRadius: 999, padding: "4px 11px", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><User size={13} /> {nomeUser(users, t.responsavelId)} <RefreshCw size={11} /></button>
              {abrirResp && (
                <div style={{ position: "absolute", top: 34, left: 0, background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12, boxShadow: "0 6px 18px #0002", zIndex: 20, minWidth: 180, overflow: "hidden" }}>
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
        {podeMexer(t) && (
          <div className="flex flex-col gap-1.5">
            <button onClick={() => onEditar(t)} style={{ color: C.cinza, padding: 4 }}><Pencil size={17} /></button>
            <button onClick={async () => { if (await Dialog.confirm({ titulo: "Excluir tarefa", mensagem: "Deseja excluir esta tarefa?", okLabel: "Excluir", perigo: true })) onExcluir(t.id); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={17} /></button>
          </div>
        )}
      </div>
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
function ComprasView({ tasks, produtos, podeMexer, onConcluir, onEditar, onExcluir, onReabrir, onAbrir }) {
  const compras = tasks.filter((t) => t.ehCompra);
  const pendentes = compras.filter((t) => !isConcluida(t));
  // "Compradas" mostra só os últimos 30 dias (as antigas continuam no banco).
  const limite = Date.now() - 30 * 864e5;
  const feitas = compras.filter((t) => isConcluida(t) && (!t.concluidaEm || t.concluidaEm >= limite)).sort((a, b) => (b.concluidaEm || 0) - (a.concluidaEm || 0));
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
            <div className="flex-1 min-w-0" onClick={() => onAbrir && onAbrir(t)} style={{ cursor: "pointer" }}>
              <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold" style={{ fontSize: 15 }}>{t.titulo}</span>{t.darEntrada === false && <Chip icon={Package} texto="Sem estoque" cor={C.cinza} />}</div>
              <div className="flex flex-col gap-1 mt-1.5">
                {itens.map((it, i) => { const p = prodDe(it.produtoId); return (<div key={i} className="flex items-center gap-2 text-sm"><span style={{ width: 6, height: 6, borderRadius: 999, background: C.ambar, flexShrink: 0 }} /><span className="flex-1 min-w-0 truncate">{p ? p.nome : "Produto"}{p?.subcategoria ? " · " + p.subcategoria : ""}</span><b style={{ color: C.pastoEsc, whiteSpace: "nowrap" }}>{it.quantidade} {p?.unidade || ""}</b></div>); })}
              </div>
            </div>
            {podeMexer(t) && (
              <div className="flex flex-col gap-1">
                <button onClick={() => onEditar(t)} style={{ color: C.cinza, padding: 4 }}><Pencil size={16} /></button>
                <button onClick={async () => { if (await Dialog.confirm({ titulo: "Excluir", mensagem: "Deseja excluir?", okLabel: "Excluir", perigo: true })) onExcluir(t.id); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>
              </div>
            )}
          </div>
        );
      })}
      {feitas.length > 0 && (
        <div className="mt-4"><div style={{ color: C.cinza }} className="text-xs font-semibold mb-2 uppercase">Compradas · últimos 30 dias</div>
          {feitas.map((t) => (
            <div key={t.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, opacity: 0.7 }} className="p-3 mb-2 flex items-center gap-3">
              <button onClick={() => onReabrir(t)} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: C.pasto, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={16} color="#fff" strokeWidth={3} /></button>
              <div className="flex-1 font-medium" style={{ textDecoration: "line-through" }}>{t.titulo}</div>
              {podeMexer(t) && <button onClick={async () => { if (await Dialog.confirm({ titulo: "Excluir", mensagem: "Deseja excluir?", okLabel: "Excluir", perigo: true })) onExcluir(t.id); }} style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>}
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
          <button onClick={onAbrirProdutos} style={{ background: C.card, color: C.pastoEsc, border: `1px solid ${C.pasto}`, borderRadius: 999, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Tag size={14} /> Produtos</button>
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
// Convite pelo WhatsApp: só o link (com ?instalar=1, o app já abre oferecendo instalar com 1 toque). Vai para o número da pessoa
// (sem número, o WhatsApp abre para escolher o contato). Senha não vai: o app não a conhece.
function linkConviteWhats(u) {
  const primeiro = String(u.nome || "").split(" ")[0] || "tudo bem";
  const link = new URL(import.meta.env.BASE_URL, window.location.href).href;
  const msg = `Olá, ${primeiro}! Toque no link para instalar o app do Rancho Abdalla:

${link}?instalar=1`;
  const fone = String(u.telefone || "").replace(/\D/g, "");
  return "https://wa.me/" + (fone ? (fone.length <= 11 ? "55" + fone : fone) : "") + "?text=" + encodeURIComponent(msg);
}
function EquipeView({ users, souAdmin, euId, showToast, onRecarregar }) {
  const [novo, setNovo] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const [senhaPara, setSenhaPara] = useState(null); // pessoa recebendo senha nova
  // E-mail de cada pessoa: fica no Auth; a função emails_equipe (supabase/sql/equipe-email-senha.sql) só responde ao admin.
  const [emails, setEmails] = useState({});
  useEffect(() => {
    if (!souAdmin) return;
    supabase.rpc("emails_equipe").then(({ data }) => { if (Array.isArray(data)) setEmails(Object.fromEntries(data.map((x) => [x.id, x.email]))); });
  }, [souAdmin, users.length]);
  const editar = async (id, campo, valor) => {
    const { error } = await supabase.from("perfis").update({ [campo]: valor }).eq("id", id);
    if (error) { showToast("Erro ao salvar: " + error.message); return; }
    onRecarregar();
  };
  const alternarPapel = async (u) => {
    if (u.papel === "crianca") { showToast("Conta de criança: mude a função pelo campo, se precisar."); return; }
    if (u.papel === "visitante") { showToast("Visitante não muda de função: gere um acesso novo se precisar."); return; }
    if (u.id === euId) { showToast("Você não pode mudar a sua própria função."); return; }
    const virarAdmin = u.papel !== "admin";
    if (!(await Dialog.confirm(virarAdmin
      ? { titulo: "Tornar administrador", mensagem: `${u.nome} vai poder ver e mudar tudo no app, inclusive a equipe. Continuar?`, okLabel: "Tornar administrador", perigo: true }
      : { titulo: "Tirar de administrador", mensagem: `${u.nome} volta a ser colaborador. Continuar?`, okLabel: "Tirar de administrador" }))) return;
    const { error } = await supabase.from("perfis").update({ papel: virarAdmin ? "admin" : "colaborador" }).eq("id", u.id);
    if (error) { showToast("Erro ao salvar: " + error.message); return; }
    onRecarregar();
  };
  // Remover = ativo:false. A pessoa some da equipe, mas o histórico (quem fez o quê) continua.
  const remover = (u) => {
    Dialog.confirm({ titulo: "Remover pessoa", mensagem: "Remover " + u.nome + " da equipe? A pessoa deixa de entrar no app e sai desta lista.", okLabel: "Remover", perigo: true }).then(async (ok) => {
      if (!ok) return;
      const { error } = await supabase.from("perfis").update({ ativo: false }).eq("id", u.id);
      if (error) { showToast("Não consegui remover: " + error.message); return; }
      onRecarregar();
      showToast(u.nome + " foi removido(a)");
    });
  };

  if (!souAdmin) return (
    // Quem tem só "Pode gerar acesso de visitante": a Equipe mostra apenas o QR Code de visitante.
    <div>
      <button onClick={() => setVisitante(true)} className="flex items-center justify-center gap-2 mb-3" style={{ width: "100%", background: C.card, color: C.lago, border: `1px solid ${C.lago}`, borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16 }}><Clock size={18} /> Gerar acesso de visitante (QR Code)</button>
      {visitante && <VisitanteSheet showToast={showToast} onCriado={onRecarregar} onFechar={() => setVisitante(false)} />}
    </div>
  );
  return (
    <div>
      <div style={{ background: C.lagoClaro, borderRadius: 14 }} className="p-3 mb-3"><div style={{ color: C.lago }} className="text-xs font-semibold uppercase">Equipe do rancho</div><div style={{ color: C.terra }} className="text-sm mt-0.5">Administradores criam e organizam. Colaboradores executam e pedem compras. {souAdmin ? "Para dar acesso a alguém, toque em Adicionar pessoa." : "Somente administradores podem alterar a equipe."}</div></div>
      {souAdmin && <button onClick={() => setNovo(true)} className="flex items-center justify-center gap-2 mb-2" style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16 }}><UserPlus size={19} /> Adicionar pessoa</button>}
      {souAdmin && <button onClick={() => setVisitante(true)} className="flex items-center justify-center gap-2 mb-3" style={{ width: "100%", background: C.card, color: C.lago, border: `1px solid ${C.lago}`, borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 15 }}><Clock size={18} /> Gerar acesso de visitante (QR Code)</button>}
      {users.filter((u) => u.ativo !== false).map((u) => {
        return (
          <div key={u.id} style={{ background: C.card, border: `1px solid ${u.id === euId ? C.pasto : C.linha}`, borderRadius: 14 }} className="p-3 mb-2">
            <div className="flex items-center gap-2">
              <button onClick={() => souAdmin && alternarPapel(u)} title="Trocar função" disabled={!souAdmin} style={{ background: u.papel === "admin" ? C.ambarClaro : C.pastoClaro, borderRadius: 9, padding: 7 }}>{u.papel === "admin" ? <Star size={17} style={{ color: C.ambar }} /> : <User size={17} style={{ color: C.pasto }} />}</button>
              {souAdmin ? (
                <input key={"n" + u.id + u.nome} defaultValue={u.nome} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.nome) editar(u.id, "nome", v); }} placeholder="Nome da pessoa" style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontWeight: 600, fontSize: 15, outline: "none" }} />
              ) : (
                <div className="truncate" style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 15 }}>{u.nome}</div>
              )}
              <span style={{ color: C.cinzaClaro, fontSize: 12, flexShrink: 0, whiteSpace: "nowrap" }}>{(u.papel === "visitante" && u.expiraEm && Date.now() > u.expiraEm) ? "Visitante (expirado)" : papelLabel(u.papel)}</span>
              {souAdmin && u.id !== euId && u.papel !== "visitante" && (
                <a href={linkConviteWhats(u)} target="_blank" rel="noreferrer" title="Enviar convite pelo WhatsApp" aria-label={`Enviar convite para ${u.nome} pelo WhatsApp`}
                  style={{ color: C.pasto, padding: 4, display: "flex", flexShrink: 0 }}><MessageCircle size={17} /></a>
              )}
              {souAdmin && u.id !== euId && <button onClick={() => remover(u)} title="Remover pessoa" style={{ color: C.vermelho, padding: 4, flexShrink: 0 }}><Trash2 size={16} /></button>}
            </div>
            {souAdmin && u.papel !== "visitante" && (
              <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: 40 }}>
                <Mail size={13} style={{ color: C.cinzaClaro, flexShrink: 0 }} />
                <div className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.cinza }}>{emails[u.id] || "—"}</div>
                <button onClick={() => setSenhaPara(u)} className="flex items-center gap-1" style={{ flexShrink: 0, background: C.pastoClaro, color: C.pastoEsc, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
                  <KeyRound size={13} /> Nova senha
                </button>
              </div>
            )}
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
            {souAdmin && (<>
              <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                <Home size={13} style={{ color: C.cinzaClaro }} />
                <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Pode controlar a casa</div>
                <Toggle on={u.podeControle === true} onToggle={() => editar(u.id, "pode_controle", !(u.podeControle === true))} />
              </div>
              {u.papel === "admin" && u.id !== euId && (
                <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                  <Users size={13} style={{ color: C.cinzaClaro }} />
                  <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Pode mexer na equipe (desligado: só gera visitante)</div>
                  <Toggle on={u.podeGerirEquipe !== false} onToggle={() => editar(u.id, "pode_gerir_equipe", u.podeGerirEquipe === false)} />
                </div>
              )}
              {u.papel !== "admin" && u.papel !== "visitante" && (
                <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                  <Clock size={13} style={{ color: C.cinzaClaro }} />
                  <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Pode gerar acesso de visitante</div>
                  <Toggle on={u.podeGerarVisitante === true} onToggle={() => editar(u.id, "pode_gerar_visitante", !(u.podeGerarVisitante === true))} />
                </div>
              )}
              {u.podeControle && (
                <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                  <LayoutGrid size={13} style={{ color: C.cinzaClaro }} />
                  <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Pode montar o próprio painel</div>
                  <Toggle on={u.podePersonalizar === true} onToggle={() => editar(u.id, "pode_personalizar", !(u.podePersonalizar === true))} />
                </div>
              )}
              {u.podeControle && (
                <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                  <MoreVertical size={13} style={{ color: C.cinzaClaro }} />
                  <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Menu ⋮ do Controle</div>
                  <Toggle on={u.podeMenuControle === true} onToggle={() => editar(u.id, "pode_menu_controle", !(u.podeMenuControle === true))} />
                </div>
              )}
              {u.papel === "admin" && (
                <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                  <Wrench size={13} style={{ color: C.cinzaClaro }} />
                  <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Pode configurar o controle</div>
                  <Toggle on={u.podeGerirControle === true} onToggle={async () => { const novo = !(u.podeGerirControle === true); const { error } = await supabase.from("perfis").update(novo ? { pode_gerir_controle: true, pode_controle: true } : { pode_gerir_controle: false }).eq("id", u.id); if (error) { showToast("Erro ao salvar: " + error.message); return; } onRecarregar(); }} />
                </div>
              )}
            </>)}
          </div>
        );
      })}
      {novo && <NovaPessoaSheet showToast={showToast} onCriado={onRecarregar} onFechar={() => setNovo(false)} />}
      {visitante && <VisitanteSheet showToast={showToast} onCriado={onRecarregar} onFechar={() => setVisitante(false)} />}
      {senhaPara && <NovaSenhaSheet u={senhaPara} email={emails[senhaPara.id]} showToast={showToast} onFechar={() => setSenhaPara(null)} />}
    </div>
  );
}

// Senha nova para alguém da equipe (admin): já vem uma sugestão fácil; depois de salvar, mostra
// os dados e envia pelo WhatsApp, como no "Pessoa adicionada".
function NovaSenhaSheet({ u, email, showToast, onFechar }) {
  const [senha, setSenha] = useState(gerarSenha);
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState(""), [feito, setFeito] = useState(false);
  const primeiro = String(u.nome || "").split(" ")[0];
  const salvar = async () => {
    const v = senha.trim();
    if (v.length < 6) { setErro("A senha precisa ter pelo menos 6 caracteres."); return; }
    setSalvando(true); setErro("");
    const { error } = await supabase.rpc("definir_senha", { p_user: u.id, p_senha: v });
    setSalvando(false);
    if (error) { setErro(/definir_senha/.test(error.message) ? "Falta rodar o SQL equipe-email-senha.sql no Supabase." : error.message); return; }
    setSenha(v); setFeito(true);
  };
  if (feito) {
    const link = new URL(import.meta.env.BASE_URL, window.location.href).href;
    const msg = `Olá, ${primeiro}! Sua nova senha do app do Rancho Abdalla:\n\n${link}\n\n${email ? `E-mail: ${email}\n` : ""}Senha: ${senha}`;
    const fone = String(u.telefone || "").replace(/\D/g, "");
    const whats = "https://wa.me/" + (fone ? (fone.length <= 11 ? "55" + fone : fone) : "") + "?text=" + encodeURIComponent(msg);
    const copiar = async () => { try { await navigator.clipboard.writeText(msg); showToast("Dados copiados"); } catch { showToast("Não foi possível copiar"); } };
    return (
      <Sheet titulo="Senha alterada" onFechar={onFechar}>
        <div className="text-center py-2">
          <CheckCircle2 size={44} style={{ color: C.pasto, display: "inline" }} />
          <div className="font-bold text-lg mt-2">Nova senha de {primeiro}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, fontSize: 14 }} className="px-3 py-1 my-3">
          {email && <div className="flex justify-between gap-3 py-2"><span style={{ color: C.cinza }}>E-mail</span><span className="font-bold" style={{ wordBreak: "break-all", textAlign: "right" }}>{email}</span></div>}
          <div className="flex justify-between gap-3 py-2" style={{ borderTop: email ? `1px solid ${C.bg}` : "none" }}><span style={{ color: C.cinza }}>Senha</span><span className="font-bold">{senha}</span></div>
        </div>
        <a href={whats} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 mb-2" style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16, textDecoration: "none", boxSizing: "border-box" }}><MessageCircle size={19} /> Enviar pelo WhatsApp</a>
        <button onClick={copiar} className="flex items-center justify-center gap-2 mb-2" style={{ width: "100%", background: C.card, color: C.terra, border: `1px solid ${C.linha}`, borderRadius: 12, padding: 13, fontWeight: 600 }}><Copy size={17} /> Copiar dados</button>
        <button onClick={onFechar} style={{ width: "100%", color: C.cinza, padding: 12, fontWeight: 600 }}>Concluir</button>
      </Sheet>
    );
  }
  return (
    <Sheet titulo={`Nova senha · ${u.nome}`} onFechar={onFechar}>
      <Campo label="Nova senha">
        <div className="flex gap-2">
          <input value={senha} onChange={(e) => setSenha(e.target.value)} style={{ ...inpSt, flex: 1, minWidth: 0 }} />
          <button onClick={() => setSenha(gerarSenha())} title="Sugerir outra" aria-label="Sugerir outra senha" style={{ flexShrink: 0, background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12, padding: "0 12px", color: C.terra }}><RefreshCw size={17} /></button>
        </div>
      </Campo>
      {erro && <div style={{ color: C.vermelho, fontSize: 13.5, marginBottom: 8 }}>{erro}</div>}
      <button onClick={salvar} disabled={salvando} className="flex items-center justify-center gap-2" style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16, opacity: salvando ? 0.6 : 1 }}>
        <KeyRound size={18} /> {salvando ? "Salvando…" : "Salvar nova senha"}
      </button>
    </Sheet>
  );
}

// Senha fácil de ditar/digitar: palavra do rancho + 6 números (~8 milhões de combinações).
// ponytail: continua simples para usuários leigos; o login do Supabase limita tentativas.
const PALAVRAS_SENHA = ["lago", "pasto", "serra", "ipe", "vento", "sol", "rio", "boi"];
const gerarSenha = () => { const r = crypto.getRandomValues(new Uint32Array(2)); return PALAVRAS_SENHA[r[0] % PALAVRAS_SENHA.length] + String(r[1] % 1000000).padStart(6, "0"); };
// Senha forte e aleatória (ninguém digita: vai dentro do QR Code do visitante).
const senhaForte = () => { const b = crypto.getRandomValues(new Uint8Array(18)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_"); };

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
      body: { nome, email, senha: f.senha, telefone, papel: f.papel === "crianca" ? "colaborador" : f.papel, setor: (f.papel === "admin" || f.papel === "crianca") ? "" : f.setor },
    });
    if (error || data?.error) { setErro(await erroDaFuncao(error, data)); setCriando(false); return; }
    // Criança: só controle da casa, sem tarefas. Ajusta o perfil recém-criado.
    if (f.papel === "crianca" && data?.id) {
      const { error: e2 } = await supabase.from("perfis").update({ papel: "crianca", pode_controle: true, setor: null }).eq("id", data.id);
      if (e2) {
        // Não deixa a conta como colaborador (com acesso às tarefas) se não virou criança.
        await supabase.from("perfis").update({ ativo: false }).eq("id", data.id);
        onCriado();
        setErro("Não consegui criar a conta de criança: " + e2.message); setCriando(false); return;
      }
    }
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
        <div className="flex flex-col gap-2">
          {opcao(f.papel === "colaborador", () => set("papel", "colaborador"), "Colaborador", "Faz as tarefas e pede compras", "c")}
          {opcao(f.papel === "admin", () => set("papel", "admin"), "Administrador", "Cria e organiza tudo", "a")}
          {opcao(f.papel === "crianca", () => set("papel", "crianca"), "Criança", "Só o controle da casa (sem tarefas)", "k")}
        </div>
      </Campo>
      {f.papel === "colaborador" && (
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

// Acesso de visitante: cria um perfil temporário (só controle) e um QR Code de entrada rápida.
function VisitanteSheet({ showToast, onCriado, onFechar }) {
  const [dias, setDias] = useState("1");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(null); // { qr, url, dias, ate }

  const gerar = async () => {
    const d = Math.max(1, Math.min(90, parseInt(dias) || 1));
    setCriando(true); setErro("");
    const email = `visitante-${uid()}@convidado.local`;
    const senha = senhaForte();
    const { data, error } = await supabase.functions.invoke("quick-service", {
      body: { nome: "Visitante", email, senha, telefone: "", papel: "colaborador", setor: "", visitante: true, dias: d },
    });
    if (error || data?.error) { setErro(await erroDaFuncao(error, data)); setCriando(false); return; }
    const ate = new Date(Date.now() + d * 86400000);
    if (data?.id && !data?.visitante) {
      const { error: e2 } = await supabase.from("perfis").update({ papel: "visitante", pode_controle: true, expira_em: ate.toISOString(), nome: `Visitante · ${d}d` }).eq("id", data.id);
      if (e2) {
        // Não deixa para trás uma conta de colaborador sem dono.
        await supabase.from("perfis").update({ ativo: false }).eq("id", data.id);
        onCriado && onCriado();
        setErro("Não consegui criar o acesso de visitante: " + e2.message); setCriando(false); return;
      }
    }
    const url = new URL(import.meta.env.BASE_URL, window.location.href).href + "#v=" + encodeURIComponent(btoa(email + ":" + senha));
    let qr = null;
    try { qr = await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "M" }); } catch { /* sem imagem de QR */ }
    setPronto({ qr, url, dias: d, ate });
    setCriando(false);
    onCriado();
  };

  if (pronto) {
    const copiar = async () => { try { await navigator.clipboard.writeText(pronto.url); showToast("Link copiado"); } catch { showToast("Não foi possível copiar"); } };
    return (
      <Sheet titulo="Acesso de visitante" onFechar={onFechar}>
        <div className="text-center">
          <div style={{ color: C.cinza }} className="text-sm mb-3">Peça para o visitante ler este QR Code com a câmera do celular. Ele entra direto no Controle, sem senha.</div>
          {pronto.qr
            ? <img src={pronto.qr} alt="QR Code de acesso" style={{ width: 260, height: 260, maxWidth: "100%", borderRadius: 14, border: `1px solid ${C.linha}`, background: "#fff", padding: 8, display: "inline-block" }} />
            : <div style={{ color: C.vermelho }} className="text-sm">Não consegui gerar a imagem do QR. Use o link abaixo.</div>}
          <div style={{ background: C.pastoClaro, color: C.pastoEsc, borderRadius: 999, fontSize: 13, fontWeight: 700 }} className="inline-block px-4 py-1.5 mt-3">Válido por {pronto.dias} {pronto.dias === 1 ? "dia" : "dias"} · até {pronto.ate.toLocaleDateString("pt-BR")}</div>
        </div>
        <button onClick={copiar} className="flex items-center justify-center gap-2 mt-4" style={{ width: "100%", background: C.card, color: C.terra, border: `1px solid ${C.linha}`, borderRadius: 12, padding: 13, fontWeight: 600 }}><Copy size={17} /> Copiar link de acesso</button>
        <button onClick={onFechar} style={{ width: "100%", color: C.cinza, padding: 12, fontWeight: 600 }}>Concluir</button>
        <div style={{ color: C.cinzaClaro, fontSize: 11.5 }} className="text-center mt-1 flex items-center justify-center gap-1"><Info size={12} /> Quando o prazo acabar, gere um novo QR Code.</div>
      </Sheet>
    );
  }

  return (
    <Sheet titulo="Acesso de visitante" onFechar={onFechar}>
      <div style={{ color: C.cinza }} className="text-sm mb-3">Gera um acesso temporário que abre <b>só o Controle da Casa</b> (sem tarefas), por QR Code — sem precisar de e-mail e senha.</div>
      <Campo label="Quantos dias de acesso?">
        <div className="flex items-center gap-2">
          <button onClick={() => setDias((v) => String(Math.max(1, (parseInt(v) || 1) - 1)))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.linha}`, background: C.card, color: C.terra, fontSize: 20, fontWeight: 700 }}>−</button>
          <input type="number" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} style={{ ...inpSt, textAlign: "center", fontWeight: 700, fontSize: 18 }} />
          <button onClick={() => setDias((v) => String(Math.min(90, (parseInt(v) || 1) + 1)))} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.linha}`, background: C.card, color: C.terra, fontSize: 20, fontWeight: 700 }}>+</button>
        </div>
      </Campo>
      {erro && <div style={{ background: C.vermelhoClaro, color: C.vermelho, borderRadius: 10, fontSize: 14 }} className="p-3 mb-3">{erro}</div>}
      <button onClick={gerar} disabled={criando} style={{ width: "100%", background: criando ? C.cinzaClaro : C.lago, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16 }}>{criando ? "Gerando…" : "Gerar QR Code"}</button>
    </Sheet>
  );
}

// Popup que convida a instalar o app na tela inicial (some quando já instalado).
function InstalarPrompt() {
  const [visivel, setVisivel] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [convite, setConvite] = useState(!!_installEvt); // o navegador oferece instalar com 1 toque?
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPad se passa por Mac
  const samsung = /SamsungBrowser/i.test(ua);

  // Deixa o botão do cabeçalho reabrir este convite quando quiser.
  useEffect(() => {
    _installOpen.fn = () => { setAjuda(false); setVisivel(true); };
    return () => { _installOpen.fn = null; };
  }, []);

  // Na primeira vez que abre (em qualquer navegador), se ainda não instalou e não dispensou.
  // Sem o convite de 1 toque do navegador, o botão mostra o passo a passo.
  useEffect(() => {
    const atualizar = () => setConvite(!!_installEvt);
    _installSubs.add(atualizar);
    let dispensado = false;
    try { dispensado = localStorage.getItem("instalarDispensado") === "1"; } catch { /* ok */ }
    // Veio pelo link do convite: oferece instalar mesmo se já tinha dispensado antes.
    if (new URLSearchParams(window.location.search).has("instalar")) dispensado = false;
    const t = (!dispensado && !estaInstalado()) ? setTimeout(() => { if (!estaInstalado()) setVisivel(true); }, 1500) : null;
    return () => { _installSubs.delete(atualizar); clearTimeout(t); };
  }, []);

  if (!visivel || estaInstalado()) return null;

  const dispensar = () => { try { localStorage.setItem("instalarDispensado", "1"); } catch { /* ok */ } setVisivel(false); };
  const instalar = async () => {
    if (_installEvt) {
      _installEvt.prompt();
      const escolha = await _installEvt.userChoice.catch(() => null);
      _installEvt = null; setConvite(false);
      if (escolha?.outcome === "accepted") setVisivel(false);
      return;
    }
    // Sem convite automático: mostra o passo a passo (iPhone, Samsung ou outros navegadores).
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
              <Passo n={1}>Toque no botão <b>Compartilhar</b> (o quadradinho com a seta pra cima). No Safari fica na barra de baixo; no Chrome, no alto à direita.</Passo>
              <Passo n={2}>Role e toque em <b>Adicionar à Tela de Início</b> (se não aparecer, toque em <b>Ver mais</b>).</Passo>
              <Passo n={3}>Toque em <b>Adicionar</b>. Pronto!</Passo>
            </>) : samsung ? (<>
              <Passo n={1}>Toque no menu do navegador (os <b>três risquinhos ☰</b>, embaixo à direita).</Passo>
              <Passo n={2}>Toque em <b>Adicionar página a</b> e depois em <b>Tela inicial</b>.</Passo>
              <Passo n={3}>Confirme em <b>Adicionar</b>. Pronto!</Passo>
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
          {!ajuda && <button onClick={instalar} className="flex items-center justify-center gap-2" style={{ flex: 1.4, padding: 13, borderRadius: 12, fontWeight: 700, color: "#fff", background: C.pasto }}><ArrowDownToLine size={18} /> {convite ? "Instalar" : "Como instalar"}</button>}
          {ajuda && <button onClick={dispensar} style={{ flex: 1.4, padding: 13, borderRadius: 12, fontWeight: 700, color: "#fff", background: C.pasto }}>Entendi</button>}
        </div>
      </div>
    </div>
  );
}

/* ===================== CONTROLE DA CASA (Home Assistant) ===================== */

// Tipos de controle que o app entende (o gestor escolhe ao vincular o aparelho).
const CTRL_TIPOS = [
  { id: "interruptor", nome: "Liga / Desliga", ajuda: "Luz, tomada, ventilador" },
  { id: "persiana", nome: "Persiana / Cortina / Flap / Portão", ajuda: "Abrir · Parar · Fechar" },
  { id: "ar", nome: "Ar-condicionado", ajuda: "Temperatura, modo e vento" },
  { id: "tv", nome: "TV / Mídia", ajuda: "Liga, volume, play/pausa" },
  { id: "irrigacao", nome: "Irrigação", ajuda: "Iniciar · Parar" },
  { id: "fechadura", nome: "Fechadura", ajuda: "Trancar / destrancar" },
  { id: "sensor", nome: "Só leitura (sensor)", ajuda: "Mostra o valor" },
  { id: "alexa", nome: "Alexa (Spotify)", ajuda: "Toca/pausa o seu Spotify na Alexa" },
  { id: "botao", nome: "Botão (apertar)", ajuda: "Um toque; sem ligado/desligado" },
];
const CTRL_TIPO_NOME = Object.fromEntries(CTRL_TIPOS.map((t) => [t.id, t.nome]));
const CTRL_EMOJI = { botao: "🔘", interruptor: "💡", persiana: "🪟", ar: "❄️", tv: "📺", irrigacao: "💧", fechadura: "🔒", sensor: "📊" };
const CTRL_LARGO = ["ar", "tv", "persiana", "irrigacao", "alexa", "grupoPersianas", "grupoLuzes", "grupoBotoes"]; // ocupam a linha inteira (têm mais botões)
const CTRL_COMPACTAVEL = ["ar", "persiana", "grupoLuzes"]; // começam pequenos; tocar no quadro amplia; encolhem ao recarregar
// Botões de ação que dá para renomear, por tipo de aparelho. [chave, nome padrão].
const ROTULOS_POR_TIPO = {
  persiana: [["abrir", "Abrir"], ["parar", "Parar"], ["fechar", "Fechar"]],
};
const rotulo = (e, chave, padrao) => (e?.rotulos && e.rotulos[chave]) || padrao;

// Só guardamos/ouvimos estes domínios: evita a enxurrada de eventos de câmeras,
// sensores e switches de rede (isso causava lentidão / "lag" na tela).
// As câmeras não entram em HA_SHOW (geram muitos eventos); só as do portão são acompanhadas.
// Mesa de som Behringer X Air XR18 da fonte TV (Entrada 1 do AAT). Ela liga quando recebe energia:
// o liga/desliga é o plug. Os faders vão de 0 a 1 (0,75 ≈ 0 dB); "on" = canal ativo (sem mudo).
const MESA_TV = {
  fonte: "Entrada 1", plug: "switch.plug_mesa_de_som_behring",
  canais: [
    { nome: "TV", fader: "number.channel_1_fader", on: "switch.channel_1_on" },        // canal 1
    { nome: "Microfone", fader: "number.channel_4_fader", on: "switch.channel_4_on" }, // canal 4
    { nome: "Mesa Som", fader: "number.main_fader", on: "switch.main_on" },            // main
  ],
};
const MESA_IDS = [MESA_TV.plug, ...MESA_TV.canais.flatMap((c) => [c.fader, c.on])];
// Bateria da fechadura Yale da Porta da Frente: em 35% ou menos o app avisa (popup, 1x por dia em
// cada aparelho) e cria uma tarefa para a Ana Carolina comprar as pilhas (só se não houver uma aberta).
// Acima de 60% (pilhas trocadas) o aviso "zera" para a próxima vez.
const BATERIA_PORTA = {
  sensor: "sensor.fechadura_porta_frente_battery", limite: 35, recupera: 60, responsavel: "ana carolina",
  titulo: "Comprar 4 pilhas AA (fechadura da porta da frente)",
};
// Alarmes Intelbras (integrações amt8000 e amt4010). O administrador arma/desarma com a senha
// guardada no servidor (alarme_senha); os demais digitam a senha da central. "zonas" = sensores de porta/janela/movimento (on = aberta/violada);
// "memoria" = zonas que dispararam (atributo zones), que é o que diz onde disparou.
const ALARMES = [
  { nome: "Casa principal", painel: "alarm_control_panel.intelbras_amt_8000_all_groups",
    zona: /^binary_sensor\.intelbras_amt_8000_(\d{2}_|sensor_\d+$)/, memoria: "binary_sensor.intelbras_amt_8000_memoria_de_disparo", sirene: "binary_sensor.intelbras_amt_8000_siren" },
  { nome: "Casa Baixa", painel: "alarm_control_panel.amt_4010_central",
    zona: /^binary_sensor\.amt_4010_zona_\d+$/, memoria: "binary_sensor.amt_4010_memoria_de_disparo", sirene: "binary_sensor.amt_4010_sirene",
    // A central pode seguir "desarmada" enquanto as partições estão armadas: conta como armado.
    partes: ["alarm_control_panel.amt_4010_particao_a", "alarm_control_panel.amt_4010_particao_b", "alarm_control_panel.amt_4010_particao_c"] },
];
const ehDoAlarme = (id) => ALARMES.some((a) => id === a.painel || id === a.memoria || id === a.sirene || a.zona.test(id) || (a.partes || []).includes(id));
const ehTomAAT = (id) => /^number\.aat_pmr7_zona_\d+_(graves|agudos|balanco)$/.test(id);
const acompanhar = (id, attrs) => (HA_SHOW.has(id.split(".")[0]) || ehTomAAT(id) || ehDoAlarme(id) || MESA_IDS.includes(id) || id === BATERIA_PORTA.sensor || [...PORTAO_CAMERAS, ...PORTA_CAMERAS].some((c) => c.id === id)) && !ehGrupoLuz(id, attrs);
const HA_SHOW = new Set(["light", "switch", "climate", "fan", "media_player", "cover", "lock", "input_boolean", "input_button", "remote"]);
const ABERTOS_TTL = 8 * 3600000; // 8h sem uso: o Controle volta a mostrar só os pavimentos
const PROXY_FN = "controle-proxy"; // intermediário no servidor (supabase/functions/controle-proxy)
// Grupo de luz (entidade light que só junta outras) — não mostramos para não duplicar.
const ehGrupoLuz = (id, attrs) => id.split(".")[0] === "light" && Array.isArray(attrs?.entity_id);
// Domínios que aparecem para o gestor escolher (o resto é ruído).
const HA_ESCOLHIVEIS = ["light", "switch", "fan", "cover", "climate", "media_player", "lock", "input_boolean", "input_button"];

// Sugere um tipo de controle a partir do identificador do aparelho (ex.: climate.sala).
function tipoSugerido(entityId) {
  const d = String(entityId).split(".")[0];
  if (d === "cover") return "persiana";
  if (d === "climate") return "ar";
  if (d === "media_player") return "tv";
  if (d === "lock") return "fechadura";
  if (d === "input_button") return "botao";
  if (["light", "switch", "fan", "input_boolean"].includes(d)) return "interruptor";
  return "sensor";
}

// Nomes amigáveis para modos e ventos do ar-condicionado.
const AR_MODO_NOME = { off: "Desligado", cool: "Frio", heat: "Quente", dry: "Seco", fan_only: "Ventilar", heat_cool: "Auto", auto: "Auto" };
const AR_VENTO_NOME = { auto: "Auto", low: "Baixo", medium: "Médio", middle: "Médio", high: "Alto", quiet: "Silencioso", silent: "Silencioso", focus: "Focado", diffuse: "Difuso", on: "Ligado", off: "Desligado" };

function haEstado(s, attrs) {
  const map = {
    on: ["Ligado", "#2f7d4f"], off: ["Desligado", "#a49c8c"],
    open: ["Aberto", "#c8862a"], closed: ["Fechado", "#a49c8c"], opening: ["Abrindo…", "#c8862a"], closing: ["Fechando…", "#c8862a"],
    locked: ["Trancado", "#2f7d4f"], unlocked: ["Destrancado", "#c8862a"],
    home: ["Em casa", "#2f7d4f"], not_home: ["Fora", "#a49c8c"],
    playing: ["Tocando", "#2b7a8c"], paused: ["Pausado", "#a49c8c"], idle: ["Parado", "#a49c8c"], standby: ["Repouso", "#a49c8c"],
    unavailable: ["Indisponível", "#c9c2b2"], unknown: ["—", "#c9c2b2"],
    cool: ["Frio", "#2b7a8c"], heat: ["Quente", "#c8862a"], dry: ["Seco", "#c8862a"], fan_only: ["Ventilando", "#2b7a8c"], heat_cool: ["Auto", "#2b7a8c"], auto: ["Auto", "#2b7a8c"],
  };
  if (map[s]) return { texto: map[s][0], cor: map[s][1] };
  const u = attrs?.unit_of_measurement;
  return { texto: u ? `${s} ${u}` : String(s), cor: "#2b7a8c" };
}

const LAGO = "#2b7a8c", LAGO_ESC = "#1f5c6b";
const inpControle = { flex: 1, minWidth: 0, border: `1px solid ${C.linha}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, background: C.card, color: C.terra, outline: "none" };

function ControleSemAcesso({ onVoltar }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div className="text-center" style={{ maxWidth: 360 }}>
        <div style={{ background: C.vermelhoClaro, borderRadius: 18, width: 66, height: 66, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Lock size={30} style={{ color: C.vermelho }} /></div>
        <div className="font-bold text-xl" style={{ color: C.terra }}>Sem acesso ao Controle</div>
        <div style={{ color: C.cinza }} className="text-sm mt-2">Você não tem permissão para controlar a casa. Fale com um administrador.</div>
        <button onClick={onVoltar} style={{ marginTop: 20, background: C.pasto, color: "#fff", borderRadius: 12, padding: "12px 22px", fontWeight: 700 }}>Voltar ao app</button>
      </div>
    </div>
  );
}

/* ---- Peças visuais reutilizáveis ---- */
function PillToggle({ on, cor, onClick, disabled, pequeno }) {
  const w = pequeno ? 44 : 50, h = pequeno ? 26 : 30, k = h - 6;
  return (
    <button onClick={onClick} disabled={disabled} title={on ? "desligar" : "ligar"}
      role="switch" aria-checked={!!on}
      style={{ width: w, height: h, borderRadius: 999, background: on ? (cor || C.pasto) : alfa(C.cinzaClaro, 45), position: "relative", flexShrink: 0, border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? w - k - 3 : 3, width: k, height: k, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.28)", transition: "left .2s cubic-bezier(.25,1,.5,1)" }} />
    </button>
  );
}
function RoundBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: 46, height: 46, borderRadius: 999, border: `1px solid ${C.linha}`, background: disabled ? C.bg : C.card, color: C.terra, fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}
function CtrlChip({ ativo, onClick, children, cor }) {
  return (
    <button onClick={onClick}
      style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, border: `1px solid ${ativo ? (cor || LAGO) : C.linha}`, background: ativo ? (cor || LAGO) : C.card, color: ativo ? "#fff" : C.cinza, cursor: "pointer" }}>
      {children}
    </button>
  );
}
function BotaoAcao({ icon: Icon, label, cor, onClick, disabled }) {
  const sec = cor === C.cinza; // cinza = ação secundária (fechar, parar...): fundo suave, legível nos dois temas
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, background: disabled ? C.bg : sec ? alfa(C.cinza, 20) : cor, color: disabled ? C.cinzaClaro : sec ? C.terra : "#fff", borderRadius: 12, padding: "8px 6px", fontWeight: 700, fontSize: 13, border: "none", cursor: disabled ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {Icon && <Icon size={17} />}{label}
    </button>
  );
}

/* ---- Controle remoto da TV ----
   O cartão "TV Sala" (Chromecast da TV) comanda a Android TV de verdade: liga/desliga por ela e
   os botões vão pelo remote.send_command (teclas Android). Volume e mudo vão para o receiver Denon,
   por onde sai o som da sala. As mesmas ligações ficam liberadas no intermediário (controle-proxy). */
const TV_SALA = { nome: "TV Sala", tv: "media_player.smarttv_4k_ffm", remote: "remote.smarttv_4k_ffm", som: "media_player.denon_avr_s770h" };
const TV_CONTROLE = { "media_player.tv_sala": TV_SALA, "media_player.smarttv_4k_ffm": TV_SALA };
const TVS_COM_CONTROLE = [TV_SALA];
const tvLigada = (v) => !!v && !["off", "standby", "unavailable", "unknown"].includes(v.state);
// Desenho de controle remoto (o lucide não tem): mesmo estilo de traço dos outros ícones.
function IconeControleRemoto({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="7" y="2" width="10" height="20" rx="3" />
      <circle cx="12" cy="7.5" r="2" />
      <path d="M10 13h.01M14 13h.01M10 16.5h.01M14 16.5h.01" />
    </svg>
  );
}
// Apps abertos direto na TV (media_player.play_media, tipo "app"): o Android TV Remote abre o app
// pelo link dele (o nome do pacote sozinho não abre).
const TV_APPS = [
  { nome: "Netflix", id: "https://www.netflix.com/title", marca: <span style={{ color: "#e50914", fontWeight: 900, fontSize: 22, fontFamily: "Arial Black, Arial, sans-serif" }}>N</span> },
  { nome: "YouTube", id: "https://www.youtube.com", marca: <svg width="28" height="20" viewBox="0 0 28 20"><rect width="28" height="20" rx="5" fill="#ff0000" /><path d="M11 5.5v9l8-4.5z" fill="#fff" /></svg> },
  { nome: "Disney+", id: "https://www.disneyplus.com", marca: <span style={{ color: "#2b5bd7", fontWeight: 900, fontSize: 17 }}>D+</span> },
  { nome: "Prime Video", id: "https://app.primevideo.com", marca: <span style={{ background: "#1fa0e3", color: "#fff", fontWeight: 900, fontSize: 14, borderRadius: 5, padding: "1px 6px" }}>P</span> },
];
// Volume do receiver da sala: no Denon 80% = 0 dB (referência); acima disso fica alto demais.
const TV_VOL_MAX = 0.8; // ajuste se quiser liberar mais
function TvControleModal({ cfg, ent, entSom, enviar, onFechar, topo }) {
  const ind = !ent || ["unavailable", "unknown"].includes(ent.state);
  const toque = () => { try { navigator.vibrate?.(12); } catch { /* ok */ } };
  const tecla = (k) => enviar("remote", "send_command", cfg.remote, { command: k });
  const app = (id) => enviar("media_player", "play_media", cfg.tv, { media_content_type: "app", media_content_id: id });
  const grande = topo != null;
  const seta = (k, Icone, rot) => (
    <button onClick={() => tecla(k)} aria-label={rot} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: C.terra, cursor: "pointer" }}>
      <Icone size={grande ? 34 : 28} strokeWidth={2.4} />
    </button>
  );
  const linha = { display: "flex", gap: 8, flexShrink: 0 };
  const som = entSom ? { ...entSom, id: cfg.som, disponivel: !["unavailable", "unknown"].includes(entSom.state) } : null;
  return (
    <Sheet titulo={`Controle · ${cfg.nome}`} onFechar={onFechar} topo={topo}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, ...(grande ? { flex: 1, minHeight: 0, justifyContent: "space-evenly" } : {}) }}>
        <div style={linha}>
          <BotaoAcao icon={Power} label="Desligar" cor={C.vermelho} disabled={ind} onClick={() => { enviar("media_player", "turn_off", cfg.tv); onFechar(); }} />
          <BotaoAcao icon={Undo2} label="Voltar" cor={C.cinza} onClick={() => tecla("BACK")} />
          <BotaoAcao icon={Home} label="Início" cor={C.cinza} onClick={() => tecla("HOME")} />
        </div>
        {/* Direcional: setas em volta do OK. */}
        <div style={{ alignSelf: "center", width: grande ? "min(70vw, 28dvh, 280px)" : 210, aspectRatio: "1 / 1", borderRadius: 999, background: C.card, border: `1px solid ${C.linha}`,
          boxShadow: "0 6px 18px #0001", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", flexShrink: 0 }}>
          <div /> {seta("DPAD_UP", ChevronUp, "Para cima")} <div />
          {seta("DPAD_LEFT", ChevronLeft, "Para a esquerda")}
          <button onClick={() => tecla("DPAD_CENTER")} aria-label="OK" style={{ margin: "8%", borderRadius: 999, border: "none", background: C.pasto, color: "#fff", fontWeight: 800, fontSize: grande ? 20 : 17, cursor: "pointer" }}>OK</button>
          {seta("DPAD_RIGHT", ChevronRight, "Para a direita")}
          <div /> {seta("DPAD_DOWN", ChevronDown, "Para baixo")} <div />
        </div>
        {/* Volume do receiver: arrasta e solta; o alto-falante liga/desliga o mudo. */}
        {som && (
          <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16, padding: "4px 12px", flexShrink: 0 }}>
            <BarraVolume e={som} enviar={enviar} onSoltar={(v) => { toque(); enviar("media_player", "volume_set", cfg.som, { volume_level: Math.min(TV_VOL_MAX, v) }); }} />
          </div>
        )}
        <div style={linha}>
          <BotaoAcao icon={Rewind} label="Retroceder" cor={C.cinza} onClick={() => tecla("MEDIA_REWIND")} />
          <BotaoAcao icon={Play} label="Play / Pausa" cor={LAGO} onClick={() => tecla("MEDIA_PLAY_PAUSE")} />
          <BotaoAcao icon={FastForward} label="Avançar" cor={C.cinza} onClick={() => tecla("MEDIA_FAST_FORWARD")} />
        </div>
        <div style={linha}>
          {TV_APPS.map((a) => (
            <button key={a.nome} onClick={() => app(a.id)} disabled={ind} aria-label={`Abrir ${a.nome}`}
              style={{ flex: 1, minWidth: 0, background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", opacity: ind ? 0.5 : 1 }}>
              <span style={{ height: 24, display: "flex", alignItems: "center" }}>{a.marca}</span>
              <span className="truncate" style={{ fontSize: 12, fontWeight: 700, color: C.terra, maxWidth: "100%" }}>{a.nome}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/* ---- Alarme (menu ⋮ do Controle) ---- */
const ESTADO_ALARME = {
  disarmed: ["Desarmado", "#2f7d4f"], armed_away: ["Armado", "#c8862a"], armed_home: ["Armado (em casa)", "#c8862a"], armed_night: ["Armado (noite)", "#c8862a"],
  arming: ["Armando…", "#c8862a"], pending: ["Disparando em instantes…", "#b34a3a"], disarming: ["Desarmando…", "#2f7d4f"], triggered: ["DISPARADO", "#b34a3a"],
};
// Número da zona no nome ("03-Esq Garagem", "AMT 4010 05 Entr SL Var") para casar com a memória de disparo.
const numeroZona = (id, nome) => { const m = String(nome || "").replace(/^AMT 4010\s*/i, "").match(/^(\d{1,2})/) || String(id).match(/_(\d{2})(?:_|$)/) || String(id).match(/sensor_(\d+)$/); return m ? String(Number(m[1])) : null; };
function lerAlarme(cfg, ents) {
  const painel = ents[cfg.painel];
  const zonas = Object.keys(ents).filter((id) => cfg.zona.test(id)).map((id) => {
    const v = ents[id]; const nome = String(v?.attributes?.friendly_name || id).replace(/^AMT 4010\s*/i, "");
    return { id, nome, num: numeroZona(id, v?.attributes?.friendly_name), aberta: v?.state === "on", fora: !v || ["unavailable", "unknown"].includes(v.state) };
  }).sort((a, b) => Number(a.num || 999) - Number(b.num || 999));
  const mem = (ents[cfg.memoria]?.attributes?.zones || []).map((z) => String(Number(String(z).replace(/\D/g, "")) || z));
  const disparadas = zonas.filter((z) => mem.includes(z.num));
  // Estado de verdade: o da central, ou o das partições/atributo partitions_armed (AMT 4010).
  const partes = (cfg.partes || []).map((id) => ents[id]?.state).filter(Boolean);
  let estado = painel?.state;
  const at = painel?.attributes || {};
  if (partes.includes("triggered") || (at.partitions_alarmed || []).length > 0) estado = "triggered";
  else if (!/^armed|arming|triggered|pending/.test(estado || "") && (partes.some((x) => /^armed/.test(x)) || at.armed_bit === true || (at.partitions_armed || []).length > 0)) estado = "armed_away";
  return { painel, estado, zonas, disparadas, memoria: mem, sirene: ents[cfg.sirene]?.state === "on" };
}
// Com a senha salva no servidor (tabela alarme_senha), armar/desarmar vai pelo intermediário, que
// põe a senha — o celular nunca a vê. Sem senha salva, o app pede a senha como antes.
function AlarmeModal({ ents, enviar, souAdmin, onFechar }) {
  const [comSenha, setComSenha] = useState(() => new Set());
  const [aviso, setAviso] = useState("");
  const lerSalvas = () => supabase.rpc("alarmes_com_senha").then(({ data }) => { if (Array.isArray(data)) setComSenha(new Set(data.map((x) => (typeof x === "string" ? x : x.alarmes_com_senha)))); });
  useEffect(() => { lerSalvas(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pedirSenha = async (cfg, armar) => {
    const code = await Dialog.prompt({ titulo: armar ? `Armar · ${cfg.nome}` : `Desarmar · ${cfg.nome}`, mensagem: "Digite a senha da central do alarme.", valor: "", inputType: "password", okLabel: armar ? "Armar" : "Desarmar" });
    if (code) enviar("alarm_control_panel", armar ? "alarm_arm_away" : "alarm_disarm", cfg.painel, { code: String(code).trim() });
  };
  const comando = async (cfg, armar) => {
    // Senha salva só vale para administrador; os demais digitam a senha da central.
    if (!souAdmin || !comSenha.has(cfg.painel)) { pedirSenha(cfg, armar); return; }
    if (!(await Dialog.confirm({ titulo: armar ? "Armar o alarme" : "Desarmar o alarme", mensagem: `${armar ? "Armar" : "Desarmar"} o alarme da ${cfg.nome}?`, okLabel: armar ? "Armar" : "Desarmar", perigo: !armar }))) return;
    setAviso("Enviando…");
    const { data, error } = await supabase.functions.invoke(PROXY_FN, { body: { acao: "alarme", painel: cfg.painel, armar } });
    if (!error && data?.ok) { setAviso(""); return; }
    setAviso("");
    pedirSenha(cfg, armar); // não deu pelo servidor (função antiga ou senha errada): pede a senha
  };
  const salvarSenha = async (cfg) => {
    const v = await Dialog.prompt({ titulo: `Senha · ${cfg.nome}`, mensagem: "Senha da central (fica guardada só no servidor; deixe em branco para apagar).", valor: "", inputType: "password", okLabel: "Salvar" });
    if (v === null) return;
    const { error } = await supabase.rpc("definir_senha_alarme", { p_painel: cfg.painel, p_senha: v });
    setAviso(error ? (/definir_senha_alarme/.test(error.message) ? "Falta rodar o SQL alarme-senha.sql no Supabase." : error.message) : "");
    lerSalvas();
  };
  return (
    <Sheet titulo="Alarme" onFechar={onFechar}>
      {aviso && <div style={{ color: aviso === "Enviando…" ? C.cinza : C.vermelho, fontSize: 13.5, marginBottom: 8 }}>{aviso}</div>}
      {ALARMES.map((cfg) => {
        const al = lerAlarme(cfg, ents);
        const [txt, cor] = ESTADO_ALARME[al.estado] || [al.painel ? haEstado(al.estado).texto : "Sem sinal da central", C.cinza];
        const armado = /^armed|arming|triggered|pending/.test(al.estado || "");
        const abertas = al.zonas.filter((z) => z.aberta);
        return (
          <div key={cfg.painel} style={{ background: C.card, border: `1px solid ${al.estado === "triggered" ? "#b34a3a" : C.linha}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} style={{ color: cor, flexShrink: 0 }} />
              <span className="flex-1 font-bold" style={{ fontSize: 16 }}>{cfg.nome}</span>
              <span className={al.estado === "triggered" ? "ah-pisca" : ""} style={{ fontSize: 13, fontWeight: 800, color: cor }}>{txt}</span>
            </div>
            {al.estado === "triggered" && (
              <div style={{ marginTop: 8, background: alfa("#b34a3a", 12), borderRadius: 10, padding: "8px 10px", color: "#b34a3a", fontSize: 14, fontWeight: 700 }}>
                {al.disparadas.length ? `Disparou: ${al.disparadas.map((z) => z.nome).join(", ")}` : al.memoria.length ? `Disparou: zona ${al.memoria.join(", ")}` : "Disparou (zona não informada)"}
                {al.sirene && " · sirene tocando"}
              </div>
            )}
            <div className="flex gap-2" style={{ marginTop: 10 }}>
              <BotaoAcao icon={Lock} label="Armar" cor={C.ambar} disabled={!al.painel || armado} onClick={() => comando(cfg, true)} />
              <BotaoAcao icon={LockOpen} label="Desarmar" cor={C.pasto} disabled={!al.painel || !armado} onClick={() => comando(cfg, false)} />
            </div>
            {souAdmin && (
              <button onClick={() => salvarSenha(cfg)} className="flex items-center gap-1" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: comSenha.has(cfg.painel) ? C.pasto : C.cinza }}>
                <KeyRound size={13} /> {comSenha.has(cfg.painel) ? "Senha salva (trocar)" : "Salvar a senha da central"}
              </button>
            )}
            <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: C.cinza }}>
              {abertas.length ? `Abertas agora (${abertas.length}): ${abertas.map((z) => z.nome).join(", ")}` : "Todas as zonas fechadas"}
            </div>
            {al.memoria.length > 0 && al.estado !== "triggered" && (
              <div style={{ marginTop: 4, fontSize: 12, color: C.cinzaClaro }}>Último disparo na memória: {al.disparadas.length ? al.disparadas.map((z) => z.nome).join(", ") : `zona ${al.memoria.join(", ")}`}</div>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}

/* ---- Popup do PORTÃO (menu ⋮ do Controle) ---- */
const PORTAO_ID = "cover.portao_garagem";
// Câmeras do Frigate que mostram o portão, na ordem em que aparecem no popup (29 em cima, 28 embaixo).
const PORTAO_CAMERAS = [{ id: "camera.cam29", nome: "Câmera 29" }, { id: "camera.cam28", nome: "Câmera 28" }];
const PORTAO_MS = 6000; // tempo da animação de abrir/fechar
// Popup da PORTA DE ENTRADA: fechadura Yale da Porta da Frente + câmeras G5 do UniFi Protect
// (119 em cima, 109 embaixo). Só há o canal de alta resolução (2688×1512): a foto vem reduzida
// pelo HA (largura) para não pesar no celular.
const PORTA_ID = "lock.fechadura_porta_frente";
const PORTA_CAMERAS = [
  { id: "camera.g5_turret_ultra_high_resolution_channel_23", nome: "Câmera 119", largura: 960 },
  { id: "camera.g5_turret_ultra_high_resolution_channel_3", nome: "Câmera 109", largura: 960 },
];
// Desenho de um portão de correr: a folha desliza para a direita ao abrir e volta ao fechar.
// Mexe na hora em que o comando é enviado e depois acompanha o estado que o Home Assistant informa.
function PortaoModal({ ent, enviar, onFechar, cameras = [], topo }) {
  const st = ent?.state;
  // Último comando enviado. Vale até o Home Assistant informar um estado diferente do que havia
  // na hora do toque (se o sensor do portão não atualizar, o desenho não "volta" sozinho).
  const [cmd, setCmd] = useState(null); // { alvo: "aberto" | "fechado", st0 }
  const [animando, setAnimando] = useState(false);
  useEffect(() => { if (cmd && st !== cmd.st0) setCmd(null); }, [st, cmd]);
  useEffect(() => { if (!animando) return; const t = setTimeout(() => setAnimando(false), PORTAO_MS); return () => clearTimeout(t); }, [animando, cmd]);
  const doHA = st === "open" || st === "opening" ? "aberto" : st === "closed" || st === "closing" ? "fechado" : null;
  const alvo = cmd?.alvo || doHA || "fechado";
  const movendo = animando || st === "opening" || st === "closing";
  const ind = ent && ["unavailable", "unknown"].includes(st);
  const texto = movendo ? (alvo === "aberto" ? "Abrindo…" : "Fechando…")
    : cmd ? (cmd.alvo === "aberto" ? "Aberto" : "Fechado")
      : st === "open" ? "Aberto" : st === "closed" ? "Fechado" : ind ? "Sem resposta do portão" : !ent ? "Sem sinal do portão" : haEstado(st).texto;
  const acionar = (abrir) => { enviar("cover", abrir ? "open_cover" : "close_cover", PORTAO_ID); setCmd({ alvo: abrir ? "aberto" : "fechado", st0: st }); setAnimando(true); };
  const barras = Array.from({ length: 14 }, (_, i) => i);
  return (
    <Sheet titulo="Portão" onFechar={onFechar} topo={topo}>
      {/* Câmeras no tamanho original (16:9). Quem cresce para ocupar a tela é o desenho do portão. */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
        {cameras.map((c) => <CameraAoVivo key={c.id} cam={c} topo={topo} />)}
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16, padding: "8px 10px 6px",
        ...(topo != null ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}) }}>
        <svg viewBox="0 0 320 172" role="img" aria-label={`Portão: ${texto}`} style={{ width: "100%", display: "block", ...(topo != null ? { flex: 1, minHeight: 60, height: "100%" } : { height: 76 }) }}>
          <defs><clipPath id="vao-portao"><rect x="30" y="18" width="260" height="130" /></clipPath></defs>
          <rect x="0" y="146" width="320" height="26" rx="5" style={{ fill: alfa(C.cinzaClaro, 22) }} />
          <rect x="8" y="143" width="304" height="4" rx="2" style={{ fill: alfa(C.cinzaClaro, 70) }} />
          <g clipPath="url(#vao-portao)">
            <g style={{ transform: `translateX(${alvo === "aberto" ? 252 : 0}px)`, transition: `transform ${PORTAO_MS}ms cubic-bezier(.45,.05,.35,1)` }}>
              <rect x="30" y="32" width="260" height="9" rx="3" style={{ fill: C.pastoEsc }} />
              <rect x="30" y="128" width="260" height="9" rx="3" style={{ fill: C.pastoEsc }} />
              {barras.map((i) => <rect key={i} x={37 + i * 18.4} y="41" width="6" height="87" rx="2" style={{ fill: C.pasto }} />)}
              <circle cx="62" cy="141" r="4.5" style={{ fill: C.terra }} />
              <circle cx="258" cy="141" r="4.5" style={{ fill: C.terra }} />
            </g>
          </g>
          <rect x="14" y="16" width="16" height="131" rx="3" style={{ fill: C.cinza }} />
          <rect x="290" y="16" width="16" height="131" rx="3" style={{ fill: C.cinza }} />
          {/* luz de aviso: pisca em âmbar enquanto o portão se move */}
          <circle cx="22" cy="9" r="6" className={movendo ? "ah-pisca" : ""} style={{ fill: movendo ? C.ambar : alfa(C.cinzaClaro, 60) }} />
        </svg>
        <div className="text-center" style={{ marginTop: 2, flexShrink: 0, fontSize: topo != null ? 16 : 14, fontWeight: 800, color: movendo ? C.ambarTexto : alvo === "aberto" ? C.ambarTexto : C.terra }}>{texto}</div>
      </div>
      {/* Botões maiores no popup de tela cheia (crescem com a tela, de 56 a 84 px). */}
      <div className="flex gap-2" style={{ marginTop: 10, flexShrink: 0 }}>
        <button onClick={() => acionar(true)} className="flex items-center justify-center gap-2" style={{ flex: 1, background: C.pasto, color: "#fff", borderRadius: 16, padding: 12, fontWeight: 800, fontSize: topo != null ? 18 : 16, minHeight: topo != null ? "clamp(56px, 10dvh, 84px)" : undefined }}><DoorOpen size={topo != null ? 22 : 19} /> Abrir</button>
        <button onClick={() => acionar(false)} className="flex items-center justify-center gap-2" style={{ flex: 1, background: alfa(C.cinza, 20), color: C.terra, borderRadius: 16, padding: 12, fontWeight: 800, fontSize: topo != null ? 18 : 16, minHeight: topo != null ? "clamp(56px, 10dvh, 84px)" : undefined }}><DoorClosed size={topo != null ? 22 : 19} /> Fechar</button>
      </div>
    </Sheet>
  );
}

// Mesma lógica do portão: câmeras no alto e, embaixo, a porta com a fechadura e os botões.
// O toque já mostra "Destrancando…/Trancando…" até o Home Assistant informar outro estado.
function PortaModal({ ent, enviar, onFechar, cameras = [], topo }) {
  const st = ent?.state;
  const [cmd, setCmd] = useState(null); // { alvo: "unlocked" | "locked", st0 }
  useEffect(() => { if (cmd && st !== cmd.st0 && !["locking", "unlocking"].includes(st)) setCmd(null); }, [st, cmd]);
  useEffect(() => { if (!cmd) return; const t = setTimeout(() => setCmd(null), 15000); return () => clearTimeout(t); }, [cmd]); // sem resposta: volta ao estado do HA
  const ind = !ent || ["unavailable", "unknown"].includes(st);
  const movendo = !!cmd || st === "locking" || st === "unlocking";
  const aberta = cmd ? cmd.alvo === "unlocked" : st === "unlocked" || st === "unlocking";
  const texto = cmd ? (cmd.alvo === "unlocked" ? "Destrancando…" : "Trancando…")
    : st === "unlocking" ? "Destrancando…" : st === "locking" ? "Trancando…"
      : st === "locked" ? "Trancada" : st === "unlocked" ? "Destrancada" : st === "jammed" ? "Travou no meio — tente de novo"
        : !ent ? "Sem sinal da fechadura" : "Sem resposta da fechadura";
  const acionar = (abrir) => { enviar("lock", abrir ? "unlock" : "lock", PORTA_ID); setCmd({ alvo: abrir ? "unlocked" : "locked", st0: st }); };
  const cor = ind ? C.cinzaClaro : aberta ? C.ambar : C.pasto;
  const Icone = aberta ? LockOpen : Lock;
  const grande = topo != null;
  return (
    <Sheet titulo="Porta Entrada" onFechar={onFechar} topo={topo}>
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
        {cameras.map((c) => <CameraAoVivo key={c.id} cam={c} topo={topo} />)}
      </div>
      <div className="flex flex-col items-center justify-center" style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16, padding: "10px 12px", gap: 6,
        ...(grande ? { flex: 1, minHeight: 0 } : {}) }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.cinza }}>Porta da Frente</div>
        <div className={movendo ? "ah-pisca" : ""} style={{ width: grande ? "clamp(56px, 11dvh, 96px)" : 56, height: grande ? "clamp(56px, 11dvh, 96px)" : 56, borderRadius: 999,
          background: alfa(cor, 16), color: cor, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .25s, color .25s" }}>
          <Icone size={grande ? 40 : 28} strokeWidth={2.2} />
        </div>
        <div className="text-center" style={{ fontSize: grande ? 16 : 14, fontWeight: 800, color: aberta && !ind ? C.ambarTexto : C.terra }}>{texto}</div>
      </div>
      <div className="flex gap-2" style={{ marginTop: 10, flexShrink: 0 }}>
        <button onClick={() => acionar(true)} disabled={ind} className="flex items-center justify-center gap-2" style={{ flex: 1, background: ind ? C.bg : C.pasto, color: ind ? C.cinzaClaro : "#fff", borderRadius: 16, padding: 12, fontWeight: 800, fontSize: grande ? 18 : 16, minHeight: grande ? "clamp(56px, 10dvh, 84px)" : undefined }}><LockOpen size={grande ? 22 : 19} /> Destrancar</button>
        <button onClick={() => acionar(false)} disabled={ind} className="flex items-center justify-center gap-2" style={{ flex: 1, background: ind ? C.bg : alfa(C.cinza, 20), color: ind ? C.cinzaClaro : C.terra, borderRadius: 16, padding: 12, fontWeight: 800, fontSize: grande ? 18 : 16, minHeight: grande ? "clamp(56px, 10dvh, 84px)" : undefined }}><Lock size={grande ? 22 : 19} /> Trancar</button>
      </div>
    </Sheet>
  );
}

// Câmera "ao vivo" leve para o celular: uma foto nova da câmera a cada ~1 s (camera_proxy).
// A foto seguinte só troca quando terminou de carregar (sem piscar); para quando o popup fecha
// ou o app vai para segundo plano. O token da câmera muda a cada ~5 min e a URL acompanha.
const CAMERA_MS = 1000;
function CameraAoVivo({ cam, topo }) {
  const [src, setSrc] = useState(null);
  const [falhou, setFalhou] = useState(false);
  const urlRef = useRef(cam.url);
  urlRef.current = cam.url;
  useEffect(() => {
    if (!cam.url) return;
    let vivo = true, timer = null, erros = 0;
    const proxima = () => {
      if (!vivo) return;
      if (document.visibilityState !== "visible") { timer = setTimeout(proxima, CAMERA_MS); return; }
      const img = new Image();
      const t0 = Date.now();
      img.onload = () => { if (!vivo) return; erros = 0; setFalhou(false); setSrc(img.src); timer = setTimeout(proxima, Math.max(150, CAMERA_MS - (Date.now() - t0))); };
      img.onerror = () => { if (!vivo) return; erros++; if (erros >= 3) setFalhou(true); timer = setTimeout(proxima, CAMERA_MS * 2); };
      img.src = `${urlRef.current}&t=${Date.now()}`;
    };
    proxima();
    return () => { vivo = false; clearTimeout(timer); };
  }, [!!cam.url]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = cam.url && src && !falhou;
  return (
    // Cada câmera fica em 16:9, mas nunca mais alta que metade do espaço que sobra na tela
    // (o resto do popup ocupa ~280 px): assim tudo cabe sem rolagem.
    // 16:9 sempre (sem cortar a imagem). Numa tela baixa demais a câmera fica menor e centralizada,
    // para sobrar ~240 px ao portão e aos botões.
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", aspectRatio: "16 / 9", alignSelf: "center",
      width: `min(100%, calc(${topo != null ? `(100dvh - ${topo}px - 300px)` : "(92dvh - 280px)"} / 2 * 16 / 9))` }}>
      {ok
        ? <img src={src} alt={cam.nome} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <div className="flex items-center justify-center" style={{ width: "100%", height: "100%", color: "#ffffffaa", fontSize: 13.5, padding: 16, textAlign: "center" }}>{cam.aviso || (falhou ? "Câmera sem imagem agora." : "Carregando a câmera…")}</div>}
      <span style={{ position: "absolute", left: 10, top: 10, background: "#0009", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {ok && <span className="ah-pisca" style={{ width: 7, height: 7, borderRadius: 999, background: "#e5484d" }} />}{cam.nome}
      </span>
    </div>
  );
}

/* ===================== TEMPO (estação Ecowitt GW3000C + Open-Meteo) =====================
   Os números vêm da estação do rancho no HA (pelo intermediário, para todos os usuários); o
   desenho do céu (sol, nublado...) vem do Open-Meteo pela localização da casa. Chuva ou raio
   medidos pela estação têm prioridade sobre o Open-Meteo. */
const CLIMA_PAPEIS = [
  ["temp", /outdoor temp/], ["sensacao", /feels like/], ["umidade", /^gw3000c (outdoor )?humidity$/],
  ["rajadaMax", /max.*gust|gust.*max/], ["rajada", /gust/], ["vento", /wind speed/], ["direcao", /wind dir/],
  ["uv", /\buv\b/], ["lux", /lux|illuminance|light intensity/], ["radiacao", /solar rad/],
  ["chuvaTaxa", /rain rate/], ["chuvaHoje", /daily rain|rain daily|24h rain/], ["chuvaMes", /monthly rain/], ["chuvaAno", /yearly rain/],
  ["raios", /lightning (strikes|count)/], ["raioDist", /lightning dist/], ["raioHora", /last lightning|lightning (time|strike)$/],
];
// Procura pelo identificador (sensor.gw3000c_outdoor_temperature → "gw3000c outdoor temperature"),
// que não muda quando alguém renomeia o sensor no HA; o nome fica de reserva.
const textoSensor = (x) => String(x.id || "").replace(/^sensor\./, "").replace(/_/g, " ");
function lerClima(sensores) {
  const out = {}, usados = new Set();
  for (const [papel, re] of CLIMA_PAPEIS) {
    const ok = (x) => !usados.has(x.id) && !["unknown", "unavailable", ""].includes(x.state);
    const s = sensores.find((x) => ok(x) && re.test(textoSensor(x))) || sensores.find((x) => ok(x) && re.test(norm(x.nome)));
    if (s) { out[papel] = s; usados.add(s.id); }
  }
  return out;
}
const numC = (s) => { const n = Number(s?.state); return Number.isFinite(n) ? n : null; };
const fmtC = (s, casas = 1) => { const n = numC(s); return n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: casas }); };
const DIRECOES = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
const direcaoTexto = (g) => (g == null ? "" : DIRECOES[Math.round(((g % 360) + 360) % 360 / 45) % 8]);

// Busca a estação a cada 60 s (só com o app na tela) e o céu do Open-Meteo a cada 15 min.
function useClima() {
  const [est, setEst] = useState(null);
  const [ceu, setCeu] = useState(null);
  useEffect(() => {
    let vivo = true, t;
    const buscar = async () => {
      if (document.visibilityState === "visible") {
        const { data, error } = await supabase.functions.invoke(PROXY_FN, { body: { acao: "clima" } });
        if (vivo && !error && Array.isArray(data?.sensores) && data.sensores.length) setEst({ s: lerClima(data.sensores), lat: data.lat, lon: data.lon, em: Date.now() });
      }
      if (vivo) t = setTimeout(buscar, 60000);
    };
    buscar();
    const voltar = () => { if (document.visibilityState === "visible") { clearTimeout(t); buscar(); } };
    document.addEventListener("visibilitychange", voltar);
    return () => { vivo = false; clearTimeout(t); document.removeEventListener("visibilitychange", voltar); };
  }, []);
  useEffect(() => {
    if (est?.lat == null || est?.lon == null) return;
    let vivo = true, t;
    const buscar = async () => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${est.lat}&longitude=${est.lon}&current=weather_code,is_day,cloud_cover&daily=precipitation_probability_max&forecast_days=1&timezone=auto`);
        const j = await r.json();
        if (vivo && j?.current) setCeu({ ...j.current, chanceChuva: j.daily?.precipitation_probability_max?.[0] ?? null });
      } catch { /* sem internet: fica com a estação */ }
      if (vivo) t = setTimeout(buscar, 15 * 60000);
    };
    buscar();
    return () => { vivo = false; clearTimeout(t); };
  }, [est?.lat, est?.lon]);
  return est ? { ...est, ceu } : null;
}

const FUNDOS_TEMPO = {
  sol: "linear-gradient(160deg, #f7bb4f 0%, #e57a35 100%)",
  parcial: "linear-gradient(160deg, #4f9fd4 0%, #e8b25e 100%)",
  nublado: "linear-gradient(160deg, #8492a0 0%, #4c5a68 100%)",
  chuva: "linear-gradient(160deg, #3f72a3 0%, #213f5c 100%)",
  raio: "linear-gradient(160deg, #474b80 0%, #1b1d3a 100%)",
  neblina: "linear-gradient(160deg, #a2acb4 0%, #6a757e 100%)",
  noite: "linear-gradient(160deg, #26356a 0%, #0d1330 100%)",
  noiteNuvem: "linear-gradient(160deg, #3b4766 0%, #161c33 100%)",
};
function condicaoTempo(cl) {
  const s = cl.s, c = cl.ceu;
  const h = new Date().getHours();
  const dia = c ? c.is_day === 1 : h >= 6 && h < 18;
  const taxa = numC(s.chuvaTaxa);
  const ultimoRaio = s.raioHora ? Date.parse(s.raioHora.state) : NaN;
  if (Number.isFinite(ultimoRaio) && Date.now() - ultimoRaio < 30 * 60000) return { Icon: CloudLightning, texto: "Raios por perto", fundo: "raio" };
  if (taxa != null && taxa > 0) return taxa >= 10 ? { Icon: CloudRainWind, texto: "Chuva forte", fundo: "chuva" } : { Icon: CloudRain, texto: "Chovendo", fundo: "chuva" };
  const code = c?.weather_code;
  if (code != null) {
    if (code === 0) return dia ? { Icon: Sun, texto: "Céu limpo", fundo: "sol" } : { Icon: Moon, texto: "Céu limpo", fundo: "noite" };
    if (code <= 2) return dia ? { Icon: CloudSun, texto: code === 1 ? "Poucas nuvens" : "Parcialmente nublado", fundo: "parcial" } : { Icon: CloudMoon, texto: code === 1 ? "Poucas nuvens" : "Parcialmente nublado", fundo: "noiteNuvem" };
    if (code === 3) return { Icon: Cloudy, texto: "Nublado", fundo: dia ? "nublado" : "noiteNuvem" };
    if (code === 45 || code === 48) return { Icon: CloudFog, texto: "Neblina", fundo: "neblina" };
    if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, texto: "Garoa", fundo: "chuva" };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { Icon: CloudRain, texto: "Chuva", fundo: "chuva" };
    if (code >= 95) return { Icon: CloudLightning, texto: "Tempestade", fundo: "raio" };
    return { Icon: Cloud, texto: "Nublado", fundo: dia ? "nublado" : "noiteNuvem" };
  }
  // Sem o Open-Meteo: usa a luz medida pela estação.
  const lux = numC(s.lux);
  if (!dia) return { Icon: Moon, texto: "Noite", fundo: "noite" };
  if (lux != null && lux < 8000) return { Icon: Cloudy, texto: "Nublado", fundo: "nublado" };
  return { Icon: Sun, texto: "Sol", fundo: "sol" };
}

// Ilustração colorida do tempo (para o destaque do popup): sol amarelo, nuvem branca,
// gotas azuis, raio amarelo, lua dourada. Escolhida a partir do ícone da condição.
function ArteTempo({ Icon, size = 72 }) {
  const tipo = new Map([[Sun, "sol"], [Moon, "lua"], [CloudSun, "solNuvem"], [CloudMoon, "luaNuvem"], [Cloudy, "nuvens"], [Cloud, "nuvens"],
    [CloudFog, "neblina"], [CloudDrizzle, "garoa"], [CloudRain, "chuva"], [CloudRainWind, "chuvaForte"], [CloudLightning, "raio"]]).get(Icon) || "nuvens";
  const sol = (cx, cy, r) => (
    <g>
      {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={cx + Math.cos(a) * (r + 4)} y1={cy + Math.sin(a) * (r + 4)} x2={cx + Math.cos(a) * (r + 9)} y2={cy + Math.sin(a) * (r + 9)} stroke="#FFB52E" strokeWidth="3.2" strokeLinecap="round" />; })}
      <circle cx={cx} cy={cy} r={r} fill="url(#solG)" />
    </g>
  );
  const lua = (dx = 0, dy = 0, k = 1) => <path transform={`translate(${dx} ${dy}) scale(${k})`} d="M38 8a20 20 0 1 0 18 28A16 16 0 1 1 38 8z" fill="url(#luaG)" />;
  const nuvem = (dx = 0, dy = 0, k = 1, cor = "#FFFFFF", sombra = "#D7E2EC") => (
    <g transform={`translate(${dx} ${dy}) scale(${k})`}>
      <path d="M17 50h31a11 11 0 0 0 1-22 15 15 0 0 0-28.6-3.6A12.5 12.5 0 0 0 17 50z" fill={cor} />
      <path d="M17 50h31a11 11 0 0 0 10.6-8H6.5A12.5 12.5 0 0 0 17 50z" fill={sombra} opacity=".9" />
    </g>
  );
  const gotas = (n, forte) => Array.from({ length: n }, (_, i) => <line key={i} x1={20 + i * 10} y1={54} x2={(forte ? 15 : 17) + i * 10} y2={forte ? 63 : 61} stroke="#4FA8FF" strokeWidth="3.2" strokeLinecap="round" />);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0, filter: "drop-shadow(0 6px 10px rgba(0,0,0,.25))" }}>
      <defs>
        <radialGradient id="solG" cx="40%" cy="35%" r="70%"><stop offset="0%" stopColor="#FFE680" /><stop offset="100%" stopColor="#FFA31A" /></radialGradient>
        <linearGradient id="luaG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF4C2" /><stop offset="100%" stopColor="#F2C65B" /></linearGradient>
      </defs>
      {tipo === "sol" && sol(32, 32, 14)}
      {tipo === "lua" && lua(-4, 4)}
      {tipo === "solNuvem" && <>{sol(40, 22, 11)}{nuvem(-2, 6, 0.95)}</>}
      {tipo === "luaNuvem" && <>{lua(8, -2, 0.75)}{nuvem(-2, 6, 0.95)}</>}
      {tipo === "nuvens" && <>{nuvem(10, -6, 0.75, "#EEF3F8", "#C9D5E1")}{nuvem(-3, 4)}</>}
      {tipo === "neblina" && <>{nuvem(0, -6, 0.9)}{[48, 55, 62].map((y, i) => <line key={y} x1={10 + i * 3} y1={y - 4} x2={54 - i * 4} y2={y - 4} stroke="#EEF3F7" strokeWidth="3.2" strokeLinecap="round" />)}</>}
      {tipo === "garoa" && <>{nuvem(0, -6)}{gotas(3)}</>}
      {tipo === "chuva" && <>{nuvem(0, -6)}{gotas(4)}</>}
      {tipo === "chuvaForte" && <>{nuvem(0, -8, 1, "#E4EBF2", "#B9C7D5")}{gotas(4, true)}</>}
      {tipo === "raio" && <>{nuvem(0, -8, 1, "#DCE3EC", "#AEBCCB")}<path d="M33 40l-8 13h7l-4 11 12-15h-7l5-9z" fill="#FFD43B" stroke="#E8A400" strokeWidth="1.2" strokeLinejoin="round" /></>}
    </svg>
  );
}

// Botão do cabeçalho: ícone do céu + temperatura da estação.
function BotaoTempo() {
  const cl = useClima();
  const [aberto, setAberto] = useState(false);
  if (!cl || !cl.s.temp) return null;
  const cond = condicaoTempo(cl);
  return (
    <>
      <button onClick={() => setAberto(true)} title={`${cond.texto} · toque para ver o tempo`} aria-label={`Tempo: ${cond.texto}, ${fmtC(cl.s.temp, 0)} graus`}
        className="flex items-center" style={{ background: "#ffffff22", borderRadius: 10, padding: "6px 10px", gap: 6, color: "#fff", fontWeight: 800, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
        <cond.Icon size={19} /> {fmtC(cl.s.temp, 0)}°
      </button>
      {aberto && <TempoModal cl={cl} cond={cond} onFechar={() => setAberto(false)} />}
    </>
  );
}

const nivelUV = (uv) => (uv == null ? null : uv < 3 ? ["Baixo", "#3aa35b"] : uv < 6 ? ["Moderado", "#d8a32a"] : uv < 8 ? ["Alto", "#e2732f"] : uv < 11 ? ["Muito alto", "#d4483b"] : ["Extremo", "#8b4bc4"]);

function TempoModal({ cl, cond, onFechar }) {
  const s = cl.s;
  const graus = numC(s.direcao);
  const uv = numC(s.uv), nUV = nivelUV(uv);
  const chuvaHoje = numC(s.chuvaHoje), taxa = numC(s.chuvaTaxa);
  const raios = numC(s.raios);
  const chance = cl.ceu?.chanceChuva ?? null; // Open-Meteo: chance máxima de chuva hoje (%)
  const raioH = s.raioHora ? new Date(Date.parse(s.raioHora.state)) : null;
  const raioHoje = raioH && !isNaN(raioH) && raioH.toDateString() === new Date().toDateString();
  const un = (x, padrao) => x?.unidade || padrao;
  const atualizado = s.temp?.mudou ? Math.max(0, Math.round((Date.now() - Date.parse(s.temp.mudou)) / 60000)) : null;
  const Bloco = ({ Icon, titulo, children, largo, cor }) => (
    <div style={{ gridColumn: largo ? "1 / -1" : "auto", background: C.card, border: `1px solid ${C.linha}`, borderRadius: 16, padding: "11px 12px" }}>
      <div className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 700, color: C.cinza, marginBottom: 6 }}>
        <Icon size={15} style={{ color: cor || C.lago }} /> {titulo}
      </div>
      {children}
    </div>
  );
  const Grande = ({ v, u }) => (<div style={{ fontSize: 22, fontWeight: 800, color: C.terra, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{v}<span style={{ fontSize: 13, fontWeight: 700, color: C.cinza, marginLeft: 3 }}>{u}</span></div>);
  const Linha = ({ r, v }) => (<div className="flex items-center justify-between" style={{ fontSize: 13.5, padding: "3px 0" }}><span style={{ color: C.cinza }}>{r}</span><b style={{ color: C.terra, fontVariantNumeric: "tabular-nums" }}>{v}</b></div>);
  return (
    <Sheet titulo="Tempo no rancho" onFechar={onFechar}>
      {/* Destaque: céu, temperatura e sensação, com fundo na cor do tempo. */}
      <div style={{ background: FUNDOS_TEMPO[cond.fundo], color: "#fff", borderRadius: 20, padding: "16px 18px", marginBottom: 10, boxShadow: "0 14px 30px -18px rgba(0,0,0,.6)" }}>
        <div className="flex items-center gap-3">
          <ArteTempo Icon={cond.Icon} size={76} />
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmtC(s.temp, 1)}°</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{cond.texto}</div>
          </div>
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: 10, fontSize: 13, opacity: 0.92 }}>
          {s.sensacao ? <span>Sensação térmica <b>{fmtC(s.sensacao, 1)}°</b></span> : <span />}
          {atualizado != null && <span>{atualizado < 1 ? "agora" : `há ${atualizado} min`}</span>}
        </div>
      </div>
      {/* Ordem: umidade e chance de chuva · luminosidade e UV · vento · chuva (histórico) · raios. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {s.umidade && <Bloco Icon={Droplets} titulo="Umidade externa"><Grande v={fmtC(s.umidade, 0)} u="%" /></Bloco>}
        {chance != null && (
          <Bloco Icon={CloudRain} titulo="Chance de chuva hoje">
            <Grande v={Math.round(chance)} u="%" />
            <div style={{ height: 6, borderRadius: 999, background: alfa(C.lago, 16), marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.max(0, chance))}%`, height: "100%", borderRadius: 999, background: C.lago }} />
            </div>
            <div style={{ fontSize: 12, color: C.cinza, marginTop: 4 }}>{chance < 20 ? "Pouco provável" : chance < 50 ? "Pode chover" : chance < 80 ? "Provável" : "Muito provável"}</div>
          </Bloco>
        )}
        {(s.lux || s.radiacao) && (
          <Bloco Icon={Sun} titulo="Luminosidade" cor={C.ambar}>
            {s.lux ? <Grande v={fmtC(s.lux, 0)} u={un(s.lux, "lx")} /> : <Grande v={fmtC(s.radiacao, 0)} u={un(s.radiacao, "W/m²")} />}
            {s.lux && s.radiacao && <div style={{ fontSize: 12.5, color: C.cinza, marginTop: 2 }}>{fmtC(s.radiacao, 0)} {un(s.radiacao, "W/m²")}</div>}
          </Bloco>
        )}
        {uv != null && (
          <Bloco Icon={SunMedium} titulo="Índice UV" cor={nUV[1]}>
            <Grande v={fmtC(s.uv, 1)} u="" />
            <div style={{ fontSize: 12.5, fontWeight: 800, color: nUV[1], marginTop: 2 }}>{nUV[0]}</div>
          </Bloco>
        )}
        {(s.vento || s.rajada || s.rajadaMax || graus != null) && (
          <Bloco Icon={Wind} titulo="Vento" largo>
            <div className="flex items-center gap-4">
              {graus != null && (
                // Rosa dos ventos: a seta aponta para onde o vento vai (vem de graus°).
                <svg viewBox="0 0 64 64" width="64" height="64" aria-label={`Vento de ${direcaoTexto(graus)}`} style={{ flexShrink: 0 }}>
                  <circle cx="32" cy="32" r="29" fill="none" stroke={C.linha} strokeWidth="2" />
                  {["N", "L", "S", "O"].map((d, i) => <text key={d} x={32 + 21 * Math.sin(i * Math.PI / 2)} y={32 - 21 * Math.cos(i * Math.PI / 2) + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.cinza}>{d}</text>)}
                  <g transform={`rotate(${graus + 180} 32 32)`}><path d="M32 12 L38 34 L32 30 L26 34 Z" fill={C.lago} /></g>
                </svg>
              )}
              <div className="flex-1 min-w-0">
                {s.vento && <Grande v={fmtC(s.vento, 1)} u={un(s.vento, "km/h")} />}
                {graus != null && <div style={{ fontSize: 13, color: C.cinza, marginTop: 2 }}>Vindo de <b style={{ color: C.terra }}>{direcaoTexto(graus)}</b> ({fmtC(s.direcao, 0)}°)</div>}
                {s.rajada && <Linha r="Rajada agora" v={`${fmtC(s.rajada, 1)} ${un(s.rajada, "km/h")}`} />}
                {s.rajadaMax && <Linha r="Rajada máxima hoje" v={`${fmtC(s.rajadaMax, 1)} ${un(s.rajadaMax, "km/h")}`} />}
              </div>
            </div>
          </Bloco>
        )}
        {(s.chuvaHoje || s.chuvaMes || s.chuvaAno || s.chuvaTaxa) && (
          <Bloco Icon={Umbrella} titulo="Chuva" largo>
            {taxa != null && taxa > 0 && <div style={{ fontSize: 14, fontWeight: 800, color: C.lago, marginBottom: 4 }}>Chovendo agora · {fmtC(s.chuvaTaxa, 1)} {un(s.chuvaTaxa, "mm/h")}</div>}
            {s.chuvaHoje && <Linha r="Hoje" v={chuvaHoje > 0 ? `${fmtC(s.chuvaHoje, 1)} ${un(s.chuvaHoje, "mm")}` : "Ainda não choveu"} />}
            {s.chuvaMes && <Linha r="No mês" v={numC(s.chuvaMes) > 0 ? `${fmtC(s.chuvaMes, 1)} ${un(s.chuvaMes, "mm")}` : "Ainda não choveu"} />}
            {s.chuvaAno && <Linha r="No ano" v={numC(s.chuvaAno) > 0 ? `${fmtC(s.chuvaAno, 1)} ${un(s.chuvaAno, "mm")}` : "Ainda não choveu"} />}
          </Bloco>
        )}
        {((raios != null && raios > 0) || raioHoje) && (
          <Bloco Icon={Zap} titulo="Raios" largo cor="#8b4bc4">
            {raios != null && <Linha r="Hoje" v={`${fmtC(s.raios, 0)} ${raios === 1 ? "raio" : "raios"}`} />}
            {s.raioDist && <Linha r="Último a" v={`${fmtC(s.raioDist, 0)} ${un(s.raioDist, "km")}`} />}
            {raioHoje && <Linha r="Último às" v={raioH.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} />}
          </Bloco>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: C.cinzaClaro, textAlign: "center", marginTop: 10 }}>Estação meteorológica do rancho · céu: Open-Meteo</div>
    </Sheet>
  );
}

/* ---- Menu ⋮ do cabeçalho (o mesmo no app de tarefas e no Controle) ---- */
function MenuPontinhos({ aberto, setAberto, itens }) {
  return (
    <div className="relative">
      <button onClick={() => setAberto((v) => !v)} title="Mais opções" aria-expanded={aberto} style={{ background: "#ffffff22", borderRadius: 10, padding: 8, display: "flex" }}><MoreVertical size={18} /></button>
      {aberto && (<>
        <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 44 }} />
        <div style={{ position: "absolute", top: 42, right: 0, background: C.card, color: C.terra, border: `1px solid ${C.linha}`, borderRadius: 12, boxShadow: "0 8px 22px #0003", zIndex: 45, minWidth: 210, overflow: "hidden" }}>
          {itens.map((it, i) => { const Ic = it.icon; return (
            <button key={it.key} onClick={() => { setAberto(false); it.on(); }} className="flex items-center gap-2" style={{ width: "100%", textAlign: "left", padding: "12px 14px", fontSize: 14, fontWeight: 600, color: it.cor === C.vermelho ? C.vermelho : C.terra, borderTop: i ? `1px solid ${C.linha}` : "none" }}><Ic size={16} style={{ color: it.cor }} /> {it.txt}</button>
          ); })}
        </div>
      </>)}
    </div>
  );
}

/* ---- Nomes das entradas do amplificador AAT (o comando continua usando "Entrada N") ---- */
// Só estas entradas aparecem na lista "Fonte" das zonas, nesta ordem e com estes nomes.
const FONTE_NOME_AAT = { "Entrada 1": "TV", "Entrada 2": "Som Térreo", "Entrada 4": "Som Subsolo", "Entrada 5": "Som Térreo 1" };
const ehZonaAAT = (id) => String(id || "").startsWith("media_player.aat_pmr7_zona_");
const nomeFonte = (e, f) => (ehZonaAAT(e?.id) && FONTE_NOME_AAT[f]) || f;
// Entradas do amplificador que vêm de um streamer AAT: com a zona nessa fonte, o controle do
// streamer aparece dentro do cartão da zona.
const STREAMER_DA_FONTE = { "Entrada 2": "media_player.som_terreo", "Entrada 4": "media_player.aat_audiocast_ac_1_aeab", "Entrada 5": "media_player.som_terreo_1" };
// Nome de cada streamer na lista de dispositivos do Spotify (Spotify Connect).
const STREAMER_CONNECT = { "media_player.som_terreo": "SOM TERREO", "media_player.aat_audiocast_ac_1_aeab": "SOM SUBSOLO", "media_player.som_terreo_1": "SOM TERREO 1" }; // WiiM Mini na Entrada 5
// Cada pessoa usa o próprio Spotify: no HA cada conta vira media_player.spotify_<nome da conta>
// ("Spotify Leo Abdalla"). Acha a da pessoa logada pelo nome do perfil no app.
// Nome igual, ou mesmo primeiro e último nome ("Carlos Abdalla" = "Carlos Maurício Abdalla").
const palavrasNome = (t) => norm(t).replace(/^spotify\s*/, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
function mesmaPessoa(perfil, conta) {
  const a = palavrasNome(perfil), b = palavrasNome(conta);
  if (!a.length || !b.length) return false;
  return a.join(" ") === b.join(" ") || (a.length > 1 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]);
}
function spotifyDaPessoa(ents, nome, fixo) {
  if (fixo && ents[fixo]) return fixo; // vínculo feito pelo gestor (Configuração → Spotify de cada pessoa)
  if (!palavrasNome(nome).length) return null;
  const ids = Object.keys(ents).filter((id) => id.startsWith("media_player.spotify_"));
  const exato = (t) => palavrasNome(t).join(" ") === palavrasNome(nome).join(" ");
  // Primeiro o nome exato; depois primeiro + último nome (pelo nome no HA ou pelo identificador).
  return ids.find((id) => exato(ents[id]?.attributes?.friendly_name || "")) || ids.find((id) => exato(id.slice("media_player.spotify_".length)))
    || ids.find((id) => mesmaPessoa(nome, ents[id]?.attributes?.friendly_name || "")) || ids.find((id) => mesmaPessoa(nome, id.slice("media_player.spotify_".length))) || null;
}

/* ---- Resposta imediata ao toque ----
   Algumas integrações (ex.: o amplificador AAT) demoram a avisar o novo estado. O app mostra o
   resultado esperado do comando na hora e mantém isso até o Home Assistant informar uma mudança
   (ou por até 20 s); aí vale o estado real. */
const OTIMISTA_MS = 20000;
const assinatura = (v) => JSON.stringify([v?.state, v?.attributes?.volume_level, v?.attributes?.is_volume_muted, v?.attributes?.source, v?.attributes?.temperature, v?.attributes?.fan_mode]);
function previsto(service, v, data = {}) {
  const a = v?.attributes || {};
  const vol = (d) => (typeof a.volume_level === "number" ? { attributes: { volume_level: Math.min(1, Math.max(0, Math.round((a.volume_level + d) * 100) / 100)) } } : null);
  switch (service) {
    case "toggle": return v ? { state: v.state === "on" ? "off" : "on" } : null;
    case "turn_on": {
      const at = {}; // brilho/temperatura da luz já aparecem antes de o HA confirmar
      if (data.brightness_pct != null) at.brightness = Math.round(data.brightness_pct * 2.55);
      if (data.color_temp_kelvin != null) at.color_temp_kelvin = data.color_temp_kelvin;
      return Object.keys(at).length ? { state: "on", attributes: at } : { state: "on" };
    }
    case "turn_off": return { state: "off" };
    case "set_value": return data.value != null ? { state: String(data.value) } : null; // number (agudo/grave/balanço)
    case "volume_mute": return { attributes: { is_volume_muted: !!data.is_volume_muted } };
    case "select_source": return { attributes: { source: data.source } };
    case "volume_up": return vol(0.05);
    case "volume_down": return vol(-0.05);
    case "volume_set": return { attributes: { volume_level: data.volume_level } };
    case "media_play_pause": return { state: v?.state === "playing" ? "paused" : "playing" };
    case "media_pause": return { state: "paused" };
    case "media_play": return { state: "playing" };
    case "set_temperature": return { ...(data.hvac_mode ? { state: data.hvac_mode } : {}), attributes: { temperature: data.temperature } };
    case "set_hvac_mode": return { state: data.hvac_mode };
    case "set_fan_mode": return { attributes: { fan_mode: data.fan_mode } };
    case "open_cover": return { state: "opening" };
    case "close_cover": return { state: "closing" };
    // Fechadura (lock/unlock) fica de fora de propósito: só mostra trancada/destrancada quando a
    // fechadura confirmar (o cartão e o popup mostram "Trancando…/Destrancando…" enquanto isso).
    default: return null;
  }
}

/* ---- Cômodo com mais de uma zona de som (ex.: Varanda = Varanda + Churrasqueira) ----
   Vira um cartão só: liga/desliga e a fonte valem para todas as zonas do cômodo. */
function juntarZonasDoComodo(itens) {
  const zonas = itens.filter((x) => ehZonaAAT(x.id));
  if (zonas.length < 2) return itens;
  const n = (id) => Number(String(id).split("_").pop()) || 0;
  const ord = zonas.slice().sort((x, y) => n(x.id) - n(y.id));
  const algumaLigada = ord.some((z) => z.state === "on");
  // O principal é a primeira zona ligada (ou a de menor número); dele vêm volume e fonte.
  const base = ord.find((z) => z.state === "on") || ord[0];
  // dbId fixo (o da 1ª zona) e a lista das zonas de dentro, para o arrasto mover todas juntas.
  const unico = { ...base, dbId: ord[0].dbId, tamanho: ord[0].tamanho, nome: "Som", state: algumaLigada ? "on" : base.state, zonasComodo: ord.map((z) => z.id), dbIdsZonas: ord.map((z) => z.dbId) };
  const pos = itens.findIndex((x) => ehZonaAAT(x.id));
  const fora = itens.filter((x) => !ehZonaAAT(x.id));
  fora.splice(pos, 0, unico);
  return fora;
}
// Liga/desliga todas as zonas do cômodo; ao ligar, deixa todas na fonte da principal.
// Se o cômodo tem fonte padrão (ex.: Térreo → Som Térreo), ela é escolhida a cada vez que liga.
// Receiver que também é o streamer (Denon da Sala de TV, HEOS embutido). O cartão "Som" liga o
// receiver já na entrada de música e conecta o Spotify; desligar volta para a TV e depois desliga.
// connect: nome do Denon no Spotify (quando souber, o app já conecta a música nele).
const RECEIVERS_SOM = {
  "media_player.denon_avr_s770h": { musica: "HEOS Music", tv: "TV Audio", connect: null, esperaMs: 4000, tvId: "media_player.smarttv_4k_ffm" },
};
function acionarReceiver(e, ligar, enviar) {
  const r = e.receiver;
  if (!ligar) {
    enviar("media_player", "select_source", e.id, { source: r.tv });
    // Com a TV ligada o receiver fica ligado (é por ele que sai o som da TV); senão desliga.
    if (!e.tvNaSala) setTimeout(() => enviar("media_player", "turn_off", e.id), 1500);
    return;
  }
  const jaLigado = !!e.state && !["off", "standby", "unavailable", "unknown"].includes(e.state);
  if (!jaLigado) enviar("media_player", "turn_on", e.id);
  // Logo depois de ligar o receiver ainda não aceita trocar de entrada: espera um pouco.
  setTimeout(() => {
    enviar("media_player", "select_source", e.id, { source: r.musica });
    if (r.connect && e.spotify) e.conectarSpotify?.(e.spotify, r.connect);
  }, jaLigado ? 0 : r.esperaMs);
}
function acionarZonas(e, ligar, enviar) {
  if (e.receiver) return acionarReceiver(e, ligar, enviar);
  const ids = e.zonasComodo || [e.id];
  if (!ligar) {
    // Desliga também as zonas sincronizadas (ligadas tocando a mesma fonte deste cartão), menos as
    // que estão com outra pessoa.
    const fonte = e.attributes?.source;
    const juntas = fonte ? (e.zonas || []).filter((z) => !ids.includes(z.id) && !z.deOutro && z.state === "on" && z.attributes?.source === fonte).map((z) => z.id) : [];
    [...ids, ...juntas].forEach((id) => enviar("media_player", "turn_off", id));
    return;
  }
  ids.forEach((id) => enviar("media_player", "turn_on", id));
  const fonte = e.fontePadrao || e.attributes?.source;
  if (fonte && (e.fontePadrao || ids.length > 1)) setTimeout(() => ids.forEach((id) => enviar("media_player", "select_source", id, { source: fonte })), 900);
}
// Fonte que o som de cada pavimento usa ao ligar: no Térreo, o streamer Som Térreo (Entrada 2).
const FONTE_PADRAO_PAVIMENTO = { terreo: "Entrada 2" };
const comFontePadrao = (itens, pavNome) => {
  const f = FONTE_PADRAO_PAVIMENTO[norm(pavNome).replace(/[^a-z0-9]/g, "")];
  return f ? itens.map((x) => (ehZonaAAT(x.id) ? { ...x, fontePadrao: f } : x)) : itens;
};

// Som ligado (ou Alexa tocando) sobe para o 1º lugar do cômodo; desligado volta à posição salva (sort é estável).
const somLigado = (x) => (ehZonaAAT(x.id) && x.state === "on") || (x.tipo === "alexa" && ["playing", "paused"].includes(x.state))
  || (!!x.receiver && estadoMidia(x).ligado);
const somPrimeiro = (itens) => itens.slice().sort((x, y) => somLigado(y) - somLigado(x));

// Controles de música de um streamer: se o Spotify da pessoa está tocando nele, comanda o
// Spotify (que aceita anterior/próxima); senão, o próprio streamer (só tocar/pausar).
// Sem nada carregado, o "tocar" leva o Spotify da pessoa para o streamer (ou abre o app).
function acoesMusica(st, enviar) {
  if (!st || st.semSinal || !st.disponivel) return null;
  const sp = st.spotifyEnt;
  const spAqui = sp && (st.qualquerFonte || sp.attributes?.source === st.connect) && ["playing", "paused"].includes(sp.state);
  const a = st.attributes || {};
  const semMusica = !a.media_title && !["playing", "paused"].includes(st.state);
  const alvo = spAqui ? st.spotify : st.id;
  // Voltar/próxima aparecem sempre (tocando ou pausado). Vão para o Spotify da pessoa quando ela
  // tem um ligado ao HA (o Spotify comanda o aparelho em que está tocando); senão, para o streamer.
  const alvoPulo = spAqui || st.spotify ? st.spotify : st.id;
  return {
    tocando: (spAqui ? sp.state : st.state) === "playing",
    tocar: () => {
      if (!spAqui && semMusica) {
        if (!st.spotify || !st.connect) { abrirSpotify(); return; }
        st.conectarSpotify(st.spotify, st.connect, (v) => { if (v.state !== "playing") enviar("media_player", "media_play", st.spotify); });
        return;
      }
      enviar("media_player", "media_play_pause", alvo);
    },
    anterior: () => enviar("media_player", "media_previous_track", alvoPulo),
    proxima: () => enviar("media_player", "media_next_track", alvoPulo),
  };
}
// Do conjunto de aparelhos de um cômodo/pavimento, o 1º som ligado tocando um streamer.
const musicaDe = (itens, enviar) => {
  const som = itens.find((x) => somLigado(x) && !x.alheio && x.streamer && !x.streamer.semSinal);
  if (som) return acoesMusica(som.streamer, enviar);
  // Alexa tocando (ou pausada) o Spotify da pessoa: os botões comandam o Spotify.
  const alexa = itens.find((x) => x.tipo === "alexa" && x.spotify && !x.soArmado && !x.alheio && ["playing", "paused"].includes(x.state));
  if (!alexa) return null;
  const sp = (serv) => () => enviar("media_player", serv, alexa.spotify);
  return { tocando: alexa.state === "playing", tocar: sp("media_play_pause"), anterior: sp("media_previous_track"), proxima: sp("media_next_track") };
};

/* ---- Alexa pelo Spotify ----
   O HA não comanda a Alexa; o Spotify da pessoa, sim (Spotify Connect). O cartão "Alexa" toca e
   pausa a música do Spotify nela; a Alexa em si nunca é desligada. */
const ALEXAS = {}; // Alexa sozinha (sem chaves): id do cartão -> nome(s) dela no Spotify
// Spotify ligado às Echos na Alexa (conta ranchoabdalla). Quem tem um Spotify que não enxerga as
// Echos do cartão usa este para as chaves funcionarem. ponytail: é uma conta só — tocar por ela
// num cômodo para a música dela em outro; uma conta "da casa" própria resolveria.
const SPOTIFY_CASA = "media_player.spotify_leo_abdalla";
// Cartões com várias Alexas: uma chave por Alexa ([rótulo, nomes no Spotify]) e os grupos de música
// criados no app Alexa ([nomes do grupo no Spotify, quais Alexas]). O Spotify toca num aparelho por
// vez; cada grupo aparece para ele como mais um. Combinação sem grupo: o app pede para criar um.
const ALEXA_CARTOES = {
  "alexa.quarto_leo_e_pri": {
    alexas: [["Quarto", ["Quarto Leo e Pri Echo"]], ["Banheiro", ["Banheiro Leo e Pri Echo"]]],
    grupos: [[["Som quarto e banheiro Leo e Pri", "Quarto e Banheiro Leo e Pri"], [0, 1]]],
  },
  "alexa.quarto_lele_e_lala": {
    alexas: [["Quarto", ["Quarto Lele e Lala Echo"]], ["Banheiro", ["Banheiro Lele e Lala Echo"]]],
    grupos: [[["Som quarto e banheiro Lele e Lala"], [0, 1]]],
  },
  "alexa.quarto_carlos_e_sandra": {
    alexas: [["Quarto", ["Quarto Master Echo"]], ["Closet", ["Closet Master Echo"]], ["Sala", ["Sala Quarto Master Echo"]], ["Banheiro", ["Banheiro Master Echo"]]],
    grupos: [[["Som quarto closet sala e banheiro Master"], [0, 1, 2, 3]]],
  },
};
function acharConnect(sp, nomes) {
  const lista = sp?.attributes?.source_list || [];
  const alvo = (nomes || []).map((n) => norm(n));
  return lista.find((x) => alvo.includes(norm(x))) || lista.find((x) => alvo.some((n) => norm(x).startsWith(n))) || null;
}
// sel: quais Alexas devem tocar (índices). Nenhuma = pausa; uma = só ela; várias = o grupo com
// exatamente essas (ou o menor grupo que as tenha).
function escolherAlexas(e, sel, enviar) {
  if (!e.spotify) { abrirSpotify(); return; }
  if (!sel.length) { enviar("media_player", "media_pause", e.spotify); return; }
  let destino;
  if (sel.length === 1) destino = e.alexas[sel[0]]?.connect;
  else {
    const cabem = e.grupos.filter((g) => sel.every((i) => g.membros.includes(i))).sort((a, b) => a.membros.length - b.membros.length);
    if (!cabem.length) { e.avisar?.("Para tocar só nessas, crie um grupo com elas no app Alexa."); return; }
    destino = cabem[0].connect;
    // Sem um grupo com exatamente essas: toca no menor grupo que as tem e avisa.
    if (cabem[0].membros.length !== sel.length) e.avisar?.(`Tocando em ${cabem[0].membros.map((i) => e.alexas[i]?.rotulo).join(", ")}. Para tocar só nessas, crie um grupo com elas no app Alexa.`);
  }
  if (!destino) return;
  // Sair de um grupo: o multiambiente da Alexa ignora a transferência direta.
  const grupoAgora = e.grupos.find((g) => g.connect === e.fonteSp);
  if (grupoAgora && e.tocandoSp && destino !== grupoAgora.connect) { e.sairDoGrupo(e.spotify, destino, grupoAgora.connect); return; }
  e.conectarSpotify(e.spotify, destino, (v) => { if (v.state !== "playing") enviar("media_player", "media_play", e.spotify); });
}
// Chave do cartão: ligar só "arma" o cartão (música pausada, escolha Quarto/Banheiro para tocar);
// com uma Alexa só (sem grupo), ligar já toca nela. Desligar pausa.
function ligarAlexa(e, ligar, enviar) {
  if (!e.spotify) { abrirSpotify(); return; }
  e.marcarDesligada?.(!ligar);
  e.armar?.(ligar);
  if (!ligar) { if (e.tocandoSp && e.aquiFonte) enviar("media_player", "media_pause", e.spotify); return; }
  if (e.multi) return;
  if (!e.connect) return;
  e.conectarSpotify(e.spotify, e.connect, (v) => { if (v.state !== "playing") enviar("media_player", "media_play", e.spotify); });
}

/* ---- Grupo de persianas numeradas (ex.: Varanda: Persiana 1 … Persiana 11) ----
   Viram um cartão "Persianas" que abre mostrando todas para escolher qual usar. */
// "Persiana 3", "Persiana Sala TV 1", "Cortina 2"…: começa com persiana/cortina e termina no número.
const RE_PERSIANA_N = /^(?:persiana|cortina)\b.*?(\d+)$/i;
// Quem comanda todas juntas vira os botões do grupo: a "Todas" (grupo do HA) ou a de número 0
// (Varanda: 0 comanda as 1–11; Sala de TV: 0 comanda a 1 e a 2).
const ehPersianaTodas = (x) => x.tipo === "persiana" && /todas/i.test(`${x.nome || ""} ${x.id}`);
const ehPersianaZero = (x) => x.tipo === "persiana" && (/^(?:persiana|cortina)\b.*?\b0$/i.test(String(x.nome || "").trim()) || /_0$/.test(String(x.id)));
function agruparPersianas(itens, comodoId) {
  const todas = itens.find(ehPersianaTodas);
  // A 0 tem preferência (o Leonardo usa a 0 para abrir/fechar todas); a "Todas" do HA só sem a 0.
  const numeradas = itens.filter((x) => x.tipo === "persiana" && !ehPersianaTodas(x) && RE_PERSIANA_N.test(String(x.nome || "").trim()));
  const zero = itens.find(ehPersianaZero);
  const mestre = [zero, todas].find((x) => x && x.disponivel) || null;
  const membros = numeradas.filter((x) => x !== mestre && !ehPersianaZero(x));
  if (membros.length < (mestre ? 2 : 3)) return itens;
  const n = (x) => Number(String(x.nome).trim().match(RE_PERSIANA_N)[1]);
  const pos = itens.indexOf(membros[0]);
  const grupo = { dbId: "grupo-persianas-" + comodoId, id: "grupo.persianas_" + comodoId, tipo: "grupoPersianas", nome: "Persianas", rotulos: {},
    // Dentro do cartão "Persianas", cada uma aparece só pelo número (cabe numa linha).
    tamanho: "g", membros: membros.slice().sort((x, y) => n(x) - n(y)).map((m) => ({ ...m, nome: `Nº ${n(m)}` })), mestre,
    disponivel: membros.some((m) => m.disponivel) || !!mestre?.disponivel, state: "" };
  const resto = itens.filter((x) => !membros.includes(x) && x !== mestre && !ehPersianaTodas(x));
  resto.splice(Math.min(pos, resto.length), 0, grupo);
  return resto;
}

/* ---- Grupo de luzes pelo começo do nome (ex.: Varanda: as 6 luzes "Banheiro …") ---- */
// tipos: o que entra no grupo (padrão só luzes); icone: desenho do cartão (padrão lâmpada).
const GRUPOS_LUZES = [
  { re: /^banheiro\b/i, nome: "Banheiros" },
  { re: /brinquedoteca/i, nome: "Brinquedoteca", tipos: ["interruptor", "ar"], icone: ToyBrick, min: 2 },
];
function agruparLuzes(itens, comodoId) {
  let lista = itens;
  GRUPOS_LUZES.forEach((g, gi) => {
    const membros = lista.filter((x) => (g.tipos || ["interruptor"]).includes(x.tipo)
      && g.re.test(`${String(x.nome || "").trim()} ${x.attributes?.friendly_name || ""} ${x.id}`));
    if (membros.length < (g.min || 3)) return;
    const pos = lista.indexOf(membros[0]);
    const grupo = { dbId: `grupo-luzes-${gi}-${comodoId}`, id: `grupo.luzes_${gi}_${comodoId}`, tipo: "grupoLuzes", nome: g.nome, icone: g.icone, rotulos: {},
      // Tamanho escolhido pelo gestor fica gravado nas luzes do grupo; dentro do grupo elas são pequenas.
      tamanho: membros[0].tamanho === "g" ? "g" : "p", membros: membros.map((m) => ({ ...m, tamanho: "p" })),
      disponivel: membros.some((m) => m.disponivel), state: membros.some(estaLigado) ? "on" : "off" };
    const resto = lista.filter((x) => !membros.includes(x));
    resto.splice(Math.min(pos, resto.length), 0, grupo);
    lista = resto;
  });
  return lista;
}

/* ---- Botões do HA do mesmo aparelho viram um cartão (ex.: input_button.coifa_* → "Coifa") ---- */
const chaveBotao = (x) => (String(x.id).match(/^input_button\.([a-z0-9]+)_/) || [])[1];
function agruparBotoes(itens, comodoId) {
  let lista = itens;
  const chaves = [...new Set(itens.filter((x) => x.tipo === "botao").map(chaveBotao).filter(Boolean))];
  chaves.forEach((k) => {
    const membros = lista.filter((x) => x.tipo === "botao" && chaveBotao(x) === k);
    if (membros.length < 2) return;
    const pos = lista.indexOf(membros[0]);
    const grupo = { dbId: `grupo-botoes-${k}-${comodoId}`, id: `grupo.botoes_${k}_${comodoId}`, tipo: "grupoBotoes", nome: k[0].toUpperCase() + k.slice(1), rotulos: {},
      tamanho: "g", membros: membros.slice().sort((a, b) => acaoBotao(a).ordem - acaoBotao(b).ordem), disponivel: membros.some((m) => m.disponivel), state: "" };
    const resto = lista.filter((x) => !membros.includes(x));
    resto.splice(Math.min(pos, resto.length), 0, grupo);
    lista = resto;
  });
  return lista;
}
// Nome curto e ícone de cada botão, pelo que ele faz.
function acaoBotao(m) {
  const t = norm(`${m.nome} ${m.id}`);
  if (/luz/.test(t)) return { label: "Luz", Icon: Lightbulb, ordem: 0 };
  if (/diminu|menos/.test(t)) return { label: "Velocidade −", Icon: Minus, ordem: 1 };
  if (/aument|mais/.test(t)) return { label: "Velocidade +", Icon: Plus, ordem: 2 };
  return { label: m.nome, Icon: CircleDot, ordem: 3 };
}

/* ---- Contagem "ligados/total" e "Desligar tudo" ---- */
// Só entra o que liga/desliga: persiana/portão, fechadura e sensor ficam de fora.
const ehDesligavel = (e) => !["persiana", "fechadura", "sensor", "grupoPersianas", "grupoLuzes", "botao", "grupoBotoes"].includes(e.tipo);
const estaLigado = (e) => {
  if (!e.disponivel) return false;
  if (e.tipo === "ar") return e.state !== "off";
  if (e.receiver) return estadoMidia(e).ligado;
  if (e.tipo === "tv") return midiaRecursos(e).liga ? !["off", "idle", "standby"].includes(e.state) : e.state === "playing";
  if (e.tipo === "alexa") return ["playing", "paused"].includes(e.state);
  return e.state === "on";
};
// O que um media_player aceita (supported_features do HA). Sem a informação, supõe tudo.
// Ex.: as zonas do amplificador AAT não têm play/pausa; os streamers AAT não têm liga/desliga.
const midiaRecursos = (e) => {
  const f = Number(e?.attributes?.supported_features) || 0;
  const tem = (bits) => f === 0 || (f & bits) !== 0;
  const lista = Array.isArray(e?.attributes?.source_list) ? e.attributes.source_list : [];
  // Zonas do AAT: só as entradas usadas (a que estiver tocando também aparece, para a lista não mentir).
  const fontes = ehZonaAAT(e?.id) ? Object.keys(FONTE_NOME_AAT).filter((f) => lista.includes(f) || f === e.attributes?.source)
    .concat(e.attributes?.source && !FONTE_NOME_AAT[e.attributes.source] ? [e.attributes.source] : []) : lista;
  return { liga: tem(128 | 256), play: tem(1 | 16384), volSet: tem(4), fonte: (f & 2048) !== 0 && fontes.length > 0, fontes };
};
const servicoDesligar = (e) => (e.tipo === "ar" ? ["climate", "turn_off"]
  : e.tipo === "tv" ? (midiaRecursos(e).liga ? ["media_player", "turn_off"] : ["media_player", "media_pause"])
    : ["homeassistant", "turn_off"]);
// Grupos de luzes contam (e desligam) cada luz de dentro.
const achatar = (itens) => itens.flatMap((x) => (x.tipo === "grupoLuzes" ? x.membros : [x]));
const contarLigados = (itens) => { const d = achatar(itens).filter(ehDesligavel); return { on: d.filter(estaLigado).length, total: d.length }; };

// Cabeçalho de pavimento/cômodo: [⏻ desligar tudo] · nome · ligados/total ⌄ (tocar abre/fecha).
function CabecalhoNivel({ nome, sub, grande, aberto, onAlternar, itens, onDesligarTudo, musica }) {
  const { on, total } = contarLigados(itens);
  const aceso = on > 0;
  const toque = { background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: grande ? 52 : 44 };
  // Botão ⏻ "Desligar tudo": fica no lugar do ícone do pavimento / do pontinho do cômodo.
  // Aceso (âmbar, com brilho) = tem algo ligado; apagado (cinza) = nada ligado, não faz nada.
  const tam = grande ? 34 : 30;
  // No pavimento (grande) o fundo é verde: textos com as cores do nível (branco no modo claro).
  const corNome = grande ? "var(--c-nivelTexto)" : C.terra, corSub = grande ? "var(--c-nivelSub)" : C.cinza;
  const corAceso = grande ? "var(--c-nivelAceso)" : C.ambarTexto, corApagado = grande ? "var(--c-nivelSub)" : C.cinzaClaro;
  return (
    <div className="flex items-center" style={{ gap: grande ? 9 : 10 }}>
      {total > 0 ? (
        <button onClick={() => aceso && onDesligarTudo(itens)} disabled={!aceso} aria-label={aceso ? `Desligar tudo em ${nome}` : `Nada ligado em ${nome}`}
          style={{ width: tam, height: tam, borderRadius: grande ? 11 : 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none",
            cursor: aceso ? "pointer" : "default", background: aceso ? alfa(C.ambar, 22) : alfa(C.cinzaClaro, 16), color: aceso ? (grande ? corAceso : C.ambar) : corApagado,
            boxShadow: aceso ? `0 0 0 1px ${alfa(C.ambar, 35)}, 0 6px 18px -6px ${alfa(C.ambar, 75)}` : "none", transition: "background .25s, color .25s, box-shadow .25s" }}>
          <Power size={grande ? 18 : 15} strokeWidth={2.5} />
        </button>
      ) : grande ? (
        <span aria-hidden="true" style={{ width: tam, height: tam, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: alfa(C.cinzaClaro, 16), color: corApagado }}><Layers size={17} /></span>
      ) : null}
      <button onClick={onAlternar} aria-expanded={aberto} className="flex-1 min-w-0 flex flex-col justify-center text-left" style={toque}>
        <span className="truncate" style={{ fontWeight: grande ? 800 : 650, fontSize: grande ? 16.5 : 15, color: corNome, letterSpacing: grande ? "-0.01em" : 0, lineHeight: 1.2 }}>{nome}</span>
        {sub && (
          <span className="truncate" style={{ fontSize: 12, color: corSub, marginTop: 2 }}>
            {aceso ? <b style={{ color: corAceso, fontWeight: 700 }}>{on} {on === 1 ? "ligado" : "ligados"}</b> : sub}
          </span>
        )}
      </button>
      {musica && (
        // Trocar a música sem abrir o cômodo.
        <div className="flex items-center" style={{ gap: 3, flexShrink: 0 }}>
          {musica.anterior && <BotaoMini Ic={SkipBack} rot="Música anterior" onClick={musica.anterior} sobreNivel={grande} />}
          <BotaoMini Ic={musica.tocando ? Pause : Play} rot={musica.tocando ? "Pausar" : "Tocar"} onClick={musica.tocar} cheio />
          {musica.proxima && <BotaoMini Ic={SkipForward} rot="Próxima música" onClick={musica.proxima} sobreNivel={grande} />}
        </div>
      )}
      <button onClick={onAlternar} aria-label={aberto ? "Fechar" : "Abrir"} className="flex items-center justify-end" style={{ ...toque, flexShrink: 0, width: 54, gap: 4 }}>
        {total > 0 && (
          <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            <b style={{ color: aceso ? corAceso : corSub, fontWeight: 800 }}>{on}</b><span style={{ color: corApagado, fontWeight: 600 }}>/{total}</span>
          </span>
        )}
        <ChevronDown size={18} style={{ color: corSub, flexShrink: 0, transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />
      </button>
    </div>
  );
}

function BotaoMini({ Ic, rot, onClick, cheio, sobreNivel }) {
  return (
    <button onClick={onClick} aria-label={rot} title={rot}
      style={{ width: 30, height: 30, borderRadius: 999, border: "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        // sobreNivel: no título do pavimento (fundo verde), os botões de voltar/próxima ficam visíveis.
        background: cheio ? LAGO : sobreNivel ? "color-mix(in srgb, var(--c-nivelTexto) 18%, transparent)" : alfa(LAGO, 14), color: cheio ? "#fff" : sobreNivel ? "var(--c-nivelTexto)" : LAGO }}>
      <Ic size={cheio ? 15 : 14} strokeWidth={2.4} />
    </button>
  );
}

// Aparência de cada aparelho: ícone do tipo e a cor quando está "ativo"
// (ligado, aberto, destrancado...). Desligado = ícone apagado.
// Cascata: não existe no lucide; desenhada no mesmo estilo (traço, 24×24, cor do texto).
function IconeCascata({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 4h12v3H3z" />
      <path d="M7 7c0 3.5.6 6.5.6 10" />
      <path d="M10.5 7c0 3.5.8 6.5.8 10" />
      <path d="M14 7c0 3.5 1 6.5 1 10" />
      <path d="M2 20c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </svg>
  );
}
// Chafariz: também não existe no lucide. Bacia embaixo, coluna, taça em cima e o jato de água.
function IconeChafariz({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 10V3" />
      <path d="M12 3C9.5 3 7.5 4.8 7 8M12 3c2.5 0 4.5 1.8 5 5" />
      <path d="M6 10h12c0 2-2.7 3.5-6 3.5S6 12 6 10z" />
      <path d="M12 13.5V17M7.5 14.5v1.5M16.5 14.5v1.5" />
      <path d="M3 17h18c0 2.5-2 4-4.5 4h-9C5 21 3 19.5 3 17z" />
    </svg>
  );
}
// Ícone pela finalidade, a partir do nome (vale em qualquer cômodo).
const ICONE_POR_NOME = [
  [/borda/, WavesLadder, "lago"], [/cascata/, IconeCascata, "lago"], [/filtro/, Funnel, "lago"],
  [/hidro/, Bubbles, "lago"], [/aquec/, Flame, "ambar"], [/coifa/, AirVent, "lago"], [/chafariz/, IconeChafariz, "lago"], [/abajur/, LampDesk, "ambar", true],
];

function visualEquip(e) {
  const v = visualPorTipo(e);
  const alvo = norm((e.nome || "") + " " + e.id);
  const achou = ICONE_POR_NOME.find(([re]) => re.test(alvo));
  return achou ? { ...v, Icon: achou[1], cor: C[achou[2]], luz: !!achou[3] } : v;
}
function visualPorTipo(e) {
  if (e.tipo === "grupoPersianas") return { Icon: Blinds, ativo: e.membros.some((m) => visualPorTipo(m).ativo), cor: C.ambar };
  if (e.tipo === "grupoLuzes") return { Icon: e.icone || Lightbulb, ativo: e.membros.some(estaLigado), cor: C.ambar, luz: true };
  if (e.tipo === "botao" || e.tipo === "grupoBotoes") return { Icon: CircleDot, ativo: false, cor: C.lago };
  if (e.tipo === "alexa") return { Icon: Speaker, ativo: ["playing", "paused"].includes(e.state), cor: C.lago };
  const dom = String(e.id).split(".")[0];
  const alvo = ((e.nome || "") + " " + e.id).toLowerCase();
  if (e.tipo === "persiana") {
    const inv = ehInvertido(e);
    const aberto = e.disponivel && ((inv ? e.state === "closed" : e.state === "open") || ["opening", "closing"].includes(e.state));
    const portao = /port[aã]o|gate/.test(alvo);
    return { Icon: portao ? (aberto ? DoorOpen : DoorClosed) : Blinds, ativo: aberto, cor: C.ambar };
  }
  if (e.tipo === "ar") return { Icon: Snowflake, ativo: estaLigado(e), cor: AZUL_AR };
  if (e.tipo === "tv") return { Icon: ["speaker", "receiver"].includes(e.attributes?.device_class) ? Speaker : Tv, ativo: estaLigado(e), cor: C.lago };
  if (e.tipo === "irrigacao") return { Icon: Droplets, ativo: estaLigado(e), cor: C.lago };
  if (e.tipo === "fechadura") { const aberta = e.disponivel && e.state === "unlocked"; return { Icon: aberta ? LockOpen : Lock, ativo: aberta, cor: C.ambar }; }
  if (e.tipo === "sensor") return { Icon: Gauge, ativo: e.disponivel, cor: C.lago };
  return { Icon: dom === "fan" ? Fan : Lightbulb, ativo: estaLigado(e), cor: C.ambar, luz: dom !== "fan" };
}
function IconeEquip({ v, disponivel }) {
  const { Icon, ativo, cor, luz } = v;
  return (
    <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: ativo ? alfa(cor, 20) : alfa(C.cinzaClaro, 16), color: ativo ? cor : C.cinzaClaro, opacity: disponivel ? 1 : 0.55,
      boxShadow: ativo ? `0 0 0 1px ${alfa(cor, 32)}, 0 6px 18px -6px ${alfa(cor, 70)}` : "none",
      transition: "background .25s, color .25s, box-shadow .25s" }}>
      <Icon size={21} strokeWidth={2} fill={ativo && luz ? alfa(cor, 40) : "none"} />
    </span>
  );
}

/* ---- Controles por tipo de aparelho ---- */
function CtrlInterruptor({ e, enviar, cardClicavel }) {
  const on = e.state === "on"; const ind = !e.disponivel;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 text-sm" style={{ color: ind ? C.cinzaClaro : (on ? C.terra : C.cinza), fontWeight: 600 }}>{ind ? "Indisponível" : (on ? "Ligado" : "Desligado")}</div>
      {/* Quando o quadro inteiro já é clicável, a chave é só um indicador visual. */}
      <PillToggle on={on} cor={visualEquip(e).cor} disabled={ind} onClick={cardClicavel ? undefined : () => enviar("homeassistant", "toggle", e.id)} />
    </div>
  );
}
// Luz com brilho (e às vezes temperatura de cor): o cartão ganha um cantinho que abre os ajustes.
const luzAjustavel = (e) => e.tipo === "interruptor" && String(e.id).startsWith("light.")
  && (e.attributes?.supported_color_modes || []).some((m) => m !== "onoff");
// Barra que só manda o valor ao soltar (não inunda o Zigbee a cada passo).
function BarraLuz({ valor, min, max, step, rotulo, Icone, etiqueta, trilha, fmt, onSoltar }) {
  const ref = useRef(null), [local, setLocal] = useState(null);
  const soltarRef = useRef(onSoltar); soltarRef.current = onSoltar;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const soltar = () => { soltarRef.current(Number(el.value)); setLocal(null); };
    el.addEventListener("change", soltar);
    return () => el.removeEventListener("change", soltar);
  }, []);
  const v = local ?? valor, pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2">
      {etiqueta ? <span style={{ width: 74, flexShrink: 0, fontSize: 13, fontWeight: 700, color: C.cinza }}>{etiqueta}</span> : <Icone size={20} style={{ color: C.cinza, flexShrink: 0 }} />}
      <input ref={ref} type="range" min={min} max={max} step={step} value={v} aria-label={rotulo} className="ah-vol"
        onInput={(ev) => setLocal(Number(ev.target.value))} onChange={(ev) => setLocal(Number(ev.target.value))}
        style={{ flex: 1, minWidth: 0, "--cor": etiqueta ? LAGO : C.ambar, "--trilha": trilha(pct) }} />
      <span style={{ width: 52, textAlign: "right", fontSize: 14, fontWeight: 800, color: C.terra, fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</span>
    </div>
  );
}
function CtrlLuzAjuste({ e, enviar }) {
  const a = e.attributes || {}, on = e.state === "on";
  const temTemp = (a.supported_color_modes || []).includes("color_temp");
  const kMin = a.min_color_temp_kelvin || 2000, kMax = a.max_color_temp_kelvin || 6500;
  const brilho = on && a.brightness != null ? Math.max(1, Math.round(a.brightness / 2.55)) : 1;
  const kelvin = a.color_temp_kelvin ?? Math.round((kMin + kMax) / 2);
  const cinza = alfa(C.cinzaClaro, 30);
  return (
    <div className="flex flex-col" style={{ gap: 4 }} onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()}>
      <BarraLuz valor={brilho} min={1} max={100} step={1} rotulo="Brilho" Icone={Sun} fmt={(v) => `${v}%`}
        trilha={(pct) => `linear-gradient(to right, ${C.ambar} ${pct}%, ${cinza} ${pct}%)`}
        onSoltar={(v) => enviar("light", "turn_on", e.id, { brightness_pct: v })} />
      {temTemp && <BarraLuz valor={kelvin} min={kMin} max={kMax} step={50} rotulo="Temperatura da luz" Icone={Thermometer}
        fmt={(v) => (v < 3300 ? "Quente" : v < 5000 ? "Neutra" : "Fria")}
        trilha={() => "linear-gradient(to right, #ffa94d, #fff1d6, #cfe4ff)"}
        onSoltar={(v) => enviar("light", "turn_on", e.id, { color_temp_kelvin: v })} />}
    </div>
  );
}

// Flap: cobertura com o comando físico invertido (abrir/fechar trocados no HA).
// Regra: qualquer equipamento cujo nome contenha "flap" segue essa inversão.
const HA_INVERTER = ["flap"];
function ehInvertido(e) {
  const alvo = ((e?.nome || "") + " " + (e?.id || "")).toLowerCase();
  return HA_INVERTER.some((n) => alvo.includes(n));
}
// Estado da persiana como a pessoa vê (desfaz a inversão do flap). O texto vai no topo do cartão.
function estadoPersiana(e) {
  if (!e.disponivel) return { texto: "Indisponível", cor: C.cinzaClaro };
  const troca = { open: "closed", closed: "open", opening: "closing", closing: "opening" }; // flap: HA informa ao contrário
  return haEstado(ehInvertido(e) ? (troca[e.state] || e.state) : e.state, e.attributes);
}
function CtrlPersiana({ e, enviar }) {
  const ind = !e.disponivel;
  const inv = ehInvertido(e);
  return (
    <div>
      <div className="flex gap-2">
        {/* Flap: setas trocadas também (abrir ↓ / fechar ↑), acompanhando os comandos invertidos. */}
        <BotaoAcao icon={inv ? ArrowDownToLine : ArrowUpFromLine} label={rotulo(e, "abrir", "Abrir")} cor={C.pasto} disabled={ind} onClick={() => enviar("cover", inv ? "close_cover" : "open_cover", e.id)} />
        <BotaoAcao icon={X} label={rotulo(e, "parar", "Parar")} cor={C.ambar} disabled={ind} onClick={() => enviar("cover", "stop_cover", e.id)} />
        <BotaoAcao icon={inv ? ArrowUpFromLine : ArrowDownToLine} label={rotulo(e, "fechar", "Fechar")} cor={C.cinza} disabled={ind} onClick={() => enviar("cover", inv ? "open_cover" : "close_cover", e.id)} />
      </div>
    </div>
  );
}
// Ligar o ar sempre no padrão da casa: frio, 22° e vento automático (vale para todos os ares).
const AR_PADRAO = { modo: "cool", temperatura: 22 };
// Comandos atrasados de cada ar (sequência de desligar, vento): um toque novo cancela os anteriores,
// senão "desligar e religar logo" terminava com o ar desligado.
const _arTimers = {}, _arVez = {};
const novoToqueAr = (id) => { (_arTimers[id] || []).forEach(clearTimeout); _arTimers[id] = []; return (_arVez[id] = (_arVez[id] || 0) + 1); };
function ligarAr(e, enviar) {
  const vez = novoToqueAr(e.id);
  const a = e.attributes || {};
  const modo = (a.hvac_modes || []).includes(AR_PADRAO.modo) ? { hvac_mode: AR_PADRAO.modo } : {};
  enviar("climate", "set_temperature", e.id, { temperature: AR_PADRAO.temperatura, ...modo });
  if (!modo.hvac_mode) enviar("climate", "turn_on", e.id);
  const auto = (a.fan_modes || []).find((f) => /^auto/i.test(f));
  // O vento só vai depois que o HA confirmar o ar LIGADO: alguns (Midea) mandam o estado inteiro
  // a cada comando — com o HA ainda achando "desligado", o comando de vento desligava o ar.
  if (auto) {
    const vento = () => { if (_arVez[e.id] === vez) enviar("climate", "set_fan_mode", e.id, { fan_mode: auto }); }; // outro toque depois: não manda
    if (e.quandoLigado) e.quandoLigado(vento); else _arTimers[e.id].push(setTimeout(vento, 1200));
  }
}
// Ares que às vezes não desligam de primeira (Living, K7 da Churrasqueira e Varanda): ao desligar
// pelo app, desliga → 1 s → liga → 1 s → desliga de novo.
const AR_DESLIGA_DUPLO = new Set(["climate.ac_living_ac", "climate.midea_ac_150633095934489", "climate.midea_ac_150633095631273"]);
function desligarAr(e, enviar) {
  novoToqueAr(e.id);
  enviar("climate", "turn_off", e.id);
  if (!AR_DESLIGA_DUPLO.has(e.id)) return;
  _arTimers[e.id].push(setTimeout(() => enviar("climate", "turn_on", e.id), 1000));
  _arTimers[e.id].push(setTimeout(() => enviar("climate", "turn_off", e.id), 2000));
}
function CtrlAr({ e, enviar }) {
  const ind = !e.disponivel; const a = e.attributes || {};
  const ligado = !!e.state && e.state !== "off" && !ind;
  const alvo = a.temperature; const atual = a.current_temperature;
  const passo = a.target_temp_step || 1;
  const min = a.min_temp != null ? a.min_temp : 16, max = a.max_temp != null ? a.max_temp : 30;
  const modos = (a.hvac_modes || []).filter((m) => m !== "off");
  const ventos = a.fan_modes || [];
  const setTemp = (delta) => {
    if (alvo == null) return;
    let v = Math.round((alvo + delta) * 10) / 10;
    v = Math.min(max, Math.max(min, v));
    enviar("climate", "set_temperature", e.id, { temperature: v });
  };
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-sm" style={{ color: ind ? C.cinzaClaro : (ligado ? LAGO : C.cinza), fontWeight: 600 }}>
          {ind ? "Indisponível" : (ligado ? `Ligado · ${AR_MODO_NOME[e.state] || e.state}` : "Desligado")}
          {atual != null && <span style={{ color: C.cinzaClaro }}> · ambiente {Math.round(atual)}°</span>}
        </div>
        <PillToggle on={ligado} cor={visualEquip(e).cor} disabled={ind} onClick={() => (ligado ? desligarAr(e, enviar) : ligarAr(e, enviar))} />
      </div>
      {ligado && (
        <>
          <div className="flex items-center justify-center gap-4 mb-3">
            <RoundBtn onClick={() => setTemp(-passo)} disabled={alvo == null}>−</RoundBtn>
            <div style={{ minWidth: 92, textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.terra, lineHeight: 1 }}>{alvo != null ? `${alvo}°` : "—"}</div>
              <div style={{ fontSize: 11, color: C.cinzaClaro }}>temperatura</div>
            </div>
            <RoundBtn onClick={() => setTemp(passo)} disabled={alvo == null}>+</RoundBtn>
          </div>
          {modos.length > 0 && (
            <div className="mb-2">
              <div style={{ fontSize: 11, color: C.cinzaClaro, marginBottom: 5 }}>Modo</div>
              <div className="flex flex-wrap gap-2">{modos.map((m) => <CtrlChip key={m} ativo={e.state === m} cor={LAGO} onClick={() => enviar("climate", "set_hvac_mode", e.id, { hvac_mode: m })}>{AR_MODO_NOME[m] || m}</CtrlChip>)}</div>
            </div>
          )}
          {ventos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.cinzaClaro, marginBottom: 5 }}>Vento</div>
              <div className="flex flex-wrap gap-2">{ventos.map((f) => <CtrlChip key={f} ativo={a.fan_mode === f} cor={C.pasto} onClick={() => enviar("climate", "set_fan_mode", e.id, { fan_mode: f })}>{AR_VENTO_NOME[f] || f}</CtrlChip>)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// Estado de um aparelho de mídia, usado no topo do cartão (texto + chave) e nos controles.
function estadoMidia(e) {
  const r = midiaRecursos(e), ind = !e.disponivel;
  if (e.receiver) {
    const aceso = !ind && !["off", "standby"].includes(e.state);
    const ligado = aceso && e.attributes?.source !== e.receiver.tv;
    return { r, ind, ligado, texto: ind ? "Indisponível" : ligado ? "Ligado" : aceso ? "Na TV" : "Desligado" };
  }
  // Sem liga/desliga (streamer): considerado sempre "ativo" para mostrar os controles.
  const ligado = r.liga ? (!["off", "idle", "standby"].includes(e.state) && !ind) : !ind;
  const texto = ind ? "Indisponível" : r.liga ? (ligado ? "Ligado" : "Desligado") : haEstado(e.state, e.attributes).texto;
  return { r, ind, ligado, texto };
}

// Barra de volume: arrasta e vê o número mudar; o comando (volume_set) vai uma vez só, ao soltar.
// O alto-falante no começo liga/desliga o mudo: colorido = com som, cinza = mudo.
function BarraVolume({ e, enviar, compacto, onSoltar, semMudo }) {
  const atual = typeof e.attributes?.volume_level === "number" ? Math.round(e.attributes.volume_level * 100) : 0;
  const mudo = e.attributes?.is_volume_muted === true;
  const [local, setLocal] = useState(null); // valor enquanto o dedo está na barra
  const ref = useRef(null), enviarRef = useRef(enviar), onSoltarRef = useRef(onSoltar);
  enviarRef.current = enviar; onSoltarRef.current = onSoltar;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    // "change" do navegador só dispara quando solta a barra (o "input" dispara a cada passo).
    const soltar = () => {
      const v = Number(el.value) / 100;
      if (onSoltarRef.current) onSoltarRef.current(v); else enviarRef.current("media_player", "volume_set", e.id, { volume_level: v });
      setLocal(null);
    };
    el.addEventListener("change", soltar);
    return () => el.removeEventListener("change", soltar);
  }, [e.id]);
  const v = local ?? atual;
  const cor = mudo ? C.cinzaClaro : LAGO;
  const Icone = mudo ? VolumeX : Volume2;
  return (
    <div className="flex items-center gap-2" onPointerDown={(ev) => ev.stopPropagation()}>
      <button onClick={() => !semMudo && enviar("media_player", "volume_mute", e.id, { is_volume_muted: !mudo })} disabled={semMudo} aria-label={mudo ? "Tirar do mudo" : "Deixar no mudo"} aria-pressed={mudo}
        style={{ width: compacto ? 38 : 46, height: compacto ? 38 : 46, borderRadius: compacto ? 12 : 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer",
          background: mudo ? alfa(C.cinzaClaro, 18) : alfa(LAGO, 16), color: cor, transition: "background .2s, color .2s" }}>
        <Icone size={compacto ? 21 : 26} strokeWidth={2.2} />
      </button>
      <input ref={ref} type="range" min="0" max="100" step="1" value={v} aria-label="Volume" className="ah-vol"
        onInput={(ev) => setLocal(Number(ev.target.value))} onChange={(ev) => setLocal(Number(ev.target.value))}
        style={{ flex: 1, minWidth: 0, "--cor": cor, "--trilha": `linear-gradient(to right, ${cor} ${v}%, ${alfa(C.cinzaClaro, 30)} ${v}%)` }} />
      <span style={{ width: compacto ? 40 : 46, textAlign: "right", fontSize: compacto ? 14 : 16, fontWeight: 800, color: mudo ? C.cinzaClaro : local != null ? LAGO : C.terra, fontVariantNumeric: "tabular-nums" }}>{v}%</span>
    </div>
  );
}

// Lista as playlists do Spotify da pessoa (pelo "navegar mídia" do HA) e toca a escolhida no streamer.
function PlaylistsSpotify({ st, enviar, onFechar }) {
  const [lista, setLista] = useState(null), [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // A raiz do Spotify traz a pasta "Playlists"; dela vêm as playlists da conta.
        const raiz = await st.pedirHA({ type: "media_player/browse_media", entity_id: st.spotify });
        const pasta = (raiz?.children || []).find((c) => /playlist/i.test(c.media_content_type || "") || /playlist/i.test(c.title || ""));
        if (!pasta) throw new Error("Não achei as playlists desta conta.");
        const r = await st.pedirHA({ type: "media_player/browse_media", entity_id: st.spotify, media_content_id: pasta.media_content_id, media_content_type: pasta.media_content_type });
        if (vivo) setLista((r?.children || []).filter((c) => c.can_play));
      } catch (e) { if (vivo) setErro(e.message || String(e)); }
    })();
    return () => { vivo = false; };
  }, [st.spotify]); // eslint-disable-line react-hooks/exhaustive-deps
  const tocar = (pl) => {
    // Leva o Spotify para este aparelho e, quando ele confirmar, toca a playlist.
    st.conectarSpotify(st.spotify, st.connect, () => enviar("media_player", "play_media", st.spotify, { media_content_id: pl.media_content_id, media_content_type: pl.media_content_type }));
    onFechar();
  };
  return (
    <Sheet titulo={`Playlists · ${st.nome}`} onFechar={onFechar}>
      {!lista && !erro && <div className="text-center py-10" style={{ color: C.cinza }}>Buscando suas playlists…</div>}
      {erro && <div style={{ background: C.vermelhoClaro, color: C.vermelho, borderRadius: 12, fontSize: 14 }} className="p-3">{erro}</div>}
      {lista && lista.length === 0 && <div className="text-center py-10" style={{ color: C.cinza }}>Nenhuma playlist nesta conta.</div>}
      {lista && lista.map((pl) => (
        <button key={pl.media_content_id} onClick={() => tocar(pl)} className="flex items-center gap-3" style={{ width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, padding: 8, marginBottom: 8, cursor: "pointer" }}>
          {pl.thumbnail
            ? <img src={pl.thumbnail} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ width: 52, height: 52, borderRadius: 10, background: alfa(LAGO, 14), flexShrink: 0 }} />}
          <span className="flex-1 min-w-0 truncate" style={{ fontWeight: 700, fontSize: 15, color: C.terra }}>{pl.title}</span>
          <Play size={18} style={{ color: LAGO, flexShrink: 0 }} />
        </button>
      ))}
    </Sheet>
  );
}

// Controle do streamer (Som Térreo / Audiocast) que está tocando nesta zona. Sem escolha de
// fonte do streamer: fica sempre no Wifi (Bluetooth/USB não alcançam de onde se usa o app).
// Abre o app do Spotify (para escolher a música e o streamer em "Dispositivos").
// Android: intent com volta para o site se o app não estiver instalado. iPhone: esquema spotify:.
function abrirSpotify() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) { window.location.href = "intent://open.spotify.com/#Intent;scheme=https;package=com.spotify.music;S.browser_fallback_url=https%3A%2F%2Fopen.spotify.com%2F;end"; return; }
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    window.location.href = "spotify:";
    setTimeout(() => { if (document.visibilityState === "visible") window.open("https://open.spotify.com/", "_blank"); }, 1500); // sem o app: abre o site
    return;
  }
  window.open("https://open.spotify.com/", "_blank");
}

// Entrada de música do receiver: Bluetooth (celular).
function EntradasReceiver({ e, enviar }) {
  const fonte = e.attributes?.source;
  const opcoes = [["Bluetooth", "Bluetooth"]];
  const escolher = (f) => { if (fonte !== f) enviar("media_player", "select_source", e.id, { source: f }); };
  return (
    <div className="flex gap-2" style={{ marginBottom: 10 }}>
      {opcoes.map(([rot, f]) => {
        const sel = fonte === f;
        return (
          <button key={f} onClick={() => escolher(f)} aria-pressed={sel}
            style={{ flex: 1, borderRadius: 12, padding: "9px 6px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", border: `1px solid ${sel ? LAGO : C.linha}`, background: sel ? LAGO : C.card, color: sel ? "#fff" : C.terra }}>{rot}</button>
        );
      })}
    </div>
  );
}
function PainelStreamer({ s: st, enviar }) {
  const a = st.attributes || {};
  const f = Number(a.supported_features) || 0;
  const tem = (b) => f === 0 || (f & b) !== 0;
  const tocando = st.state === "playing";
  const faixa = [a.media_title, a.media_artist].filter(Boolean).join(" · ");
  // Nada carregado no streamer: o Play não teria o que tocar. Aí ele abre o Spotify.
  const semMusica = !a.media_title && !["playing", "paused"].includes(st.state);
  const [verPlaylists, setVerPlaylists] = useState(false);
  // O Spotify da pessoa está tocando NESTE streamer? (a fonte dele é o nome Connect do streamer)
  const spE = st.spotifyEnt;
  const sp = spE && (st.qualquerFonte || spE.attributes?.source === st.connect) && ["playing", "paused"].includes(spE.state) ? spE.attributes : null;
  const pic = sp?.entity_picture;
  const capa = pic ? (pic.startsWith("http") ? pic : (st.baseUrl || "") + pic) : null;
  // Leva o Spotify da pessoa para este streamer (Spotify Connect) e dá play na última música/playlist.
  const tocarSpotify = () => {
    if (!st.spotify || !st.connect) { abrirSpotify(); return; }
    st.conectarSpotify(st.spotify, st.connect, (v) => { if (v.state !== "playing") enviar("media_player", "media_play", st.spotify); });
  };
  const bt = (on, Ic, rot, grande) => (
    <button onClick={on} disabled={!st.disponivel} aria-label={rot} style={{ width: grande ? 52 : 42, height: grande ? 52 : 42, borderRadius: 999, border: "none", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", cursor: st.disponivel ? "pointer" : "default", opacity: st.disponivel ? 1 : 0.45,
      background: grande ? LAGO : alfa(LAGO, 14), color: grande ? "#fff" : LAGO }}><Ic size={grande ? 24 : 19} /></button>
  );
  return (
    <div style={{ marginTop: 12, borderRadius: 14, padding: "10px 12px", background: alfa(LAGO, 8), border: `1px solid ${alfa(LAGO, 22)}` }}>
      <div className="flex items-center gap-2">
        <Radio size={16} style={{ color: LAGO, flexShrink: 0 }} />
        <span className="flex-1 truncate" style={{ fontWeight: 700, fontSize: 13.5, color: C.terra }}>{st.nome}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: st.disponivel ? (tocando ? LAGO : C.cinza) : C.cinzaClaro }}>
          {st.semSinal ? "Sem sinal do streamer" : !st.disponivel ? "Indisponível" : semMusica ? "Nada tocando" : haEstado(st.state, a).texto}
        </span>
      </div>
      {sp ? (
        // Tocando pelo Spotify da pessoa neste streamer: capa, música, artista e a playlist.
        <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
          {capa ? <img src={capa} alt="" style={{ width: 58, height: 58, borderRadius: 10, objectFit: "cover", flexShrink: 0, boxShadow: "0 6px 16px -8px rgba(0,0,0,.5)" }} />
            : <span style={{ width: 58, height: 58, borderRadius: 10, background: alfa(LAGO, 14), flexShrink: 0 }} />}
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontWeight: 700, fontSize: 14.5, color: C.terra }}>{sp.media_title || "—"}</div>
            {sp.media_artist && <div className="truncate" style={{ fontSize: 12.5, color: C.cinza }}>{sp.media_artist}</div>}
            {sp.media_playlist && <div className="truncate" style={{ fontSize: 12, color: LAGO, fontWeight: 700, marginTop: 2 }}>Playlist: {sp.media_playlist}</div>}
          </div>
        </div>
      ) : faixa && <div className="truncate" style={{ fontSize: 12.5, color: C.cinza, marginTop: 4 }}>{faixa}</div>}
      {st.spotify && !st.semSinal && (
        <div className="flex items-center gap-4" style={{ marginTop: 8 }}>
          {st.pedirHA && (
            <button onClick={() => setVerPlaylists(true)} className="flex items-center gap-1" style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: LAGO, cursor: "pointer" }}>
              Minhas playlists <ChevronRight size={14} />
            </button>
          )}
          <button onClick={abrirSpotify} className="flex items-center gap-1" style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: C.cinza, cursor: "pointer" }}>
            Abrir o Spotify <ChevronRight size={14} />
          </button>
        </div>
      )}
      {verPlaylists && <PlaylistsSpotify st={st} enviar={enviar} onFechar={() => setVerPlaylists(false)} />}
      {!st.semSinal && (
        <div className="flex items-center justify-center gap-3" style={{ marginTop: 10 }}>
          {tem(16) && bt(() => enviar("media_player", "media_previous_track", st.id), SkipBack, "Faixa anterior")}
          {tem(1 | 16384) && bt(() => (semMusica ? tocarSpotify() : enviar("media_player", "media_play_pause", st.id)), tocando ? Pause : Play, semMusica ? "Abrir o Spotify" : tocando ? "Pausar" : "Tocar", true)}
          {tem(32) && bt(() => enviar("media_player", "media_next_track", st.id), SkipForward, "Próxima faixa")}
        </div>
      )}
    </div>
  );
}

// Ajustes de som de cada zona do AAT (abre tocando no ícone do cartão): Agudo e Grave de −7 a +7
// (no aparelho 0–14, 7 = neutro) e Balanço de esquerda a direita (0–20, 10 = centro).
// Entram as zonas do cartão e as que estão tocando junto (sincronizadas).
const TONS_AAT = [
  ["agudos", "Agudo", 14, (v) => (v === 7 ? "0" : v > 7 ? `+${v - 7}` : `−${7 - v}`)],
  ["graves", "Grave", 14, (v) => (v === 7 ? "0" : v > 7 ? `+${v - 7}` : `−${7 - v}`)],
  ["balanco", "Balanço", 20, (v) => (v === 10 ? "Centro" : v < 10 ? `E ${10 - v}` : `D ${v - 10}`)],
];
function PainelTomAAT({ e, enviar }) {
  const ids = e.zonasComodo || [e.id];
  const juntas = (e.zonas || []).filter((z) => !ids.includes(z.id) && z.state === "on" && e.attributes?.source && z.attributes?.source === e.attributes.source).map((z) => z.id);
  const nomeDe = (id) => (e.zonas || []).find((z) => z.id === id)?.nome || id;
  const cinza = alfa(C.cinzaClaro, 30);
  return (
    <div onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...ids, ...juntas].map((zid) => {
        const n = String(zid).split("_").pop();
        return (
          <div key={zid} style={{ background: alfa(LAGO, 8), border: `1px solid ${alfa(LAGO, 22)}`, borderRadius: 14, padding: "8px 12px" }}>
            <div className="truncate" style={{ fontSize: 13.5, fontWeight: 800, color: C.terra, marginBottom: 2 }}>{nomeDe(zid)}</div>
            {TONS_AAT.map(([chave, rot, max, fmt]) => {
              const id = `number.aat_pmr7_zona_${n}_${chave}`, ent = e.tons?.[id];
              if (!ent) return null;
              const meio = max / 2;
              return (
                <BarraLuz key={chave} valor={Number(ent.state) || 0} min={0} max={max} step={1} rotulo={`${rot} · ${nomeDe(zid)}`} etiqueta={rot} fmt={fmt}
                  // trilha cheia do centro até o valor (neutro = sem cor)
                  trilha={(pct) => { const c = (meio / max) * 100, a = Math.min(c, pct), b = Math.max(c, pct);
                    return `linear-gradient(to right, ${cinza} ${a}%, ${LAGO} ${a}%, ${LAGO} ${b}%, ${cinza} ${b}%)`; }}
                  onSoltar={(v) => enviar("number", "set_value", id, { value: v })} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ajustarMesa(e, novaFonte, enviar) {
  const m = e.mesa; if (!m) return;
  const ids = e.zonasComodo || [e.id];
  const outrasNaTv = (e.zonas || []).some((z) => !ids.includes(z.id) && z.state === "on" && z.attributes?.source === m.cfg.fonte);
  const precisa = novaFonte === m.cfg.fonte || outrasNaTv;
  const ligado = m.ents[m.cfg.plug]?.state === "on";
  if (precisa && !ligado) enviar("switch", "turn_on", m.cfg.plug);
  // Desligar a mesa: por enquanto só manual (o automático foi tirado; ver ControleApp).
}
// Canais 1 e 4 e o Main da mesa, dentro do cartão quando a fonte é TV. Enquanto a mesa liga
// (uns 20–40 s depois do plug), mostra "Ligando a mesa…".
function PainelMesa({ e, enviar }) {
  const { cfg, ents } = e.mesa;
  const plug = ents[cfg.plug];
  const disp = (id) => ents[id] && !["unavailable", "unknown"].includes(ents[id].state);
  const pronta = plug?.state === "on" && cfg.canais.every((c) => disp(c.fader));
  const cinza = alfa(C.cinzaClaro, 30);
  return (
    <div style={{ marginTop: 10, borderRadius: 14, padding: "8px 12px", background: alfa(LAGO, 8), border: `1px solid ${alfa(LAGO, 22)}` }}>
      <div className="flex items-center gap-2" style={{ marginBottom: pronta ? 2 : 0 }}>
        <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 800, color: C.terra }}>Mesa de som</span>
        {!pronta && (
          <span className={plug?.state === "on" ? "ah-pisca" : ""} style={{ fontSize: 12.5, fontWeight: 700, color: C.cinza }}>
            {!plug ? "Sem sinal do plug" : plug.state === "on" ? "Ligando a mesa…" : "Mesa desligada"}
          </span>
        )}
        {!pronta && plug && plug.state !== "on" && <button onClick={() => enviar("switch", "turn_on", cfg.plug)} style={{ background: LAGO, color: "#fff", border: "none", borderRadius: 10, padding: "5px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Ligar</button>}
      </div>
      {pronta && cfg.canais.map((c) => {
        const ativo = ents[c.on]?.state === "on";
        const nivel = Math.round((Number(ents[c.fader]?.state) || 0) * 10);
        return (
          <div key={c.fader} className="flex items-center gap-2">
            <button onClick={() => enviar("switch", ativo ? "turn_off" : "turn_on", c.on)} aria-pressed={!ativo} aria-label={ativo ? `Mutar ${c.nome}` : `Tirar ${c.nome} do mudo`}
              style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: ativo ? alfa(LAGO, 16) : alfa(C.cinzaClaro, 18), color: ativo ? LAGO : C.cinzaClaro }}>
              {ativo ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <div className="flex-1 min-w-0">
              <BarraLuz valor={nivel} min={0} max={10} step={1} rotulo={c.nome} etiqueta={c.nome} fmt={(v) => `${v * 10}%`}
                trilha={(pct) => `linear-gradient(to right, ${ativo ? LAGO : C.cinzaClaro} ${pct}%, ${cinza} ${pct}%)`}
                onSoltar={(v) => enviar("number", "set_value", c.fader, { value: v / 10 })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Escolher outras zonas do amplificador para tocar a mesma fonte desta zona.
// Marcar = liga a zona e põe na mesma fonte; desmarcar uma que tocava junto = desliga.
function SincronizarZonas({ e, zonas, enviar, onFechar }) {
  const fonte = e.attributes?.source;
  const juntas = zonas.filter((z) => z.id !== e.id && z.state === "on" && z.attributes?.source === fonte).map((z) => z.id);
  const [marcadas, setMarcadas] = useState(() => new Set(juntas));
  const alternar = (id) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const salvar = () => {
    zonas.forEach((z) => {
      if (z.id === e.id) return;
      const estava = juntas.includes(z.id), fica = marcadas.has(z.id);
      if (fica && !estava) {
        if (z.state !== "on") enviar("media_player", "turn_on", z.id);
        setTimeout(() => enviar("media_player", "select_source", z.id, { source: fonte }), z.state !== "on" ? 900 : 0);
      } else if (!fica && estava) enviar("media_player", "turn_off", z.id);
    });
    onFechar();
  };
  return (
    <Sheet titulo="Sincronizar ambientes" onFechar={onFechar}>
      <div style={{ fontSize: 13.5, color: C.cinza }} className="mb-3">Tocar <b style={{ color: C.terra }}>{nomeFonte(e, fonte)}</b> também em:</div>
      {zonas.filter((z) => z.id !== e.id).map((z) => {
        const on = marcadas.has(z.id);
        return (
          <button key={z.id} onClick={() => alternar(z.id)} disabled={!z.disponivel} className="flex items-center gap-3"
            style={{ width: "100%", textAlign: "left", background: on ? alfa(LAGO, 10) : C.card, border: `1px solid ${on ? alfa(LAGO, 45) : C.linha}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", opacity: z.disponivel ? 1 : 0.5 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${on ? LAGO : C.cinzaClaro}`, background: on ? LAGO : "transparent" }}>
              {on && <Check size={15} color="#fff" strokeWidth={3} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate" style={{ fontWeight: 700, fontSize: 15, color: C.terra }}>{z.nome}</span>
              <span className="block truncate" style={{ fontSize: 12, color: C.cinza }}>{z.state === "on" ? `Ligado · ${nomeFonte(z, z.attributes?.source) || "sem fonte"}` : z.disponivel ? "Desligado" : "Indisponível"}</span>
            </span>
          </button>
        );
      })}
      <button onClick={salvar} style={{ width: "100%", marginTop: 6, background: LAGO, color: "#fff", borderRadius: 14, padding: 14, fontWeight: 800, fontSize: 16 }}>Salvar</button>
    </Sheet>
  );
}

function CtrlTv({ e, enviar }) {
  const { r, ligado } = estadoMidia(e);
  const a = e.attributes || {};
  const mudo = a.is_volume_muted === true;
  const [sincronizar, setSincronizar] = useState(false);
  const chaveTrava = "volTravado:" + e.id;
  const [travado, setTravado] = useState(() => { try { return localStorage.getItem(chaveTrava) === "1"; } catch { return false; } });
  const alternarTrava = () => { const n = !travado; setTravado(n); try { localStorage.setItem(chaveTrava, n ? "1" : "0"); } catch { /* ok */ } };
  if (!ligado) return null; // o estado e a chave liga/desliga ficam no topo do cartão
  // Outras zonas do amplificador ligadas na mesma fonte = tocando junto com esta.
  const juntas = (e.zonas || []).filter((z) => z.id !== e.id && z.state === "on" && a.source && z.attributes?.source === a.source);
  // Trava ligada: o volume escolhido vai para esta zona e para todas as que tocam junto.
  const volumeEmTodas = (v) => [e, ...juntas].forEach((z) => enviar("media_player", "volume_set", z.id, { volume_level: v }));
  // Volume do streamer desta fonte: é o mesmo volume que o Spotify mostra para o aparelho.
  const sm = e.streamer;
  const volStreamer = sm && !sm.semSinal && sm.disponivel && typeof sm.attributes?.volume_level === "number" && (
    <div style={{ marginBottom: 10 }}>
      <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: C.terra, marginBottom: 2 }}>Volume do Spotify <span style={{ color: C.cinzaClaro, fontWeight: 600 }}>· {sm.nome}</span></div>
      <BarraVolume e={sm} enviar={enviar} compacto />
    </div>
  );
  return (
    // Segurar aqui dentro não "pega" o cartão para arrastar (só pelo título).
    <div onPointerDown={(ev) => ev.stopPropagation()}>
      {(!r.volSet || r.play) && !e.receiver && (
        <div className="flex gap-2" style={{ marginBottom: 2 }}>
          {!r.volSet && <BotaoAcao label="Vol −" cor={C.cinza} onClick={() => enviar("media_player", "volume_down", e.id)} />}
          {!r.volSet && <BotaoAcao label="Vol +" cor={C.pasto} onClick={() => enviar("media_player", "volume_up", e.id)} />}
          {!r.volSet && <BotaoAcao label={mudo ? "Som" : "Mudo"} cor={C.ambar} onClick={() => enviar("media_player", "volume_mute", e.id, { is_volume_muted: !mudo })} />}
          {r.play && <BotaoAcao label="Play/Pausa" cor={LAGO} onClick={() => enviar("media_player", "media_play_pause", e.id)} />}
        </div>
      )}
      {r.fonte && !e.receiver && (
        // Fonte em lista: mostra a escolhida; tocando, abre as opções do celular.
        <div className="flex items-center gap-3" style={{ marginTop: (!r.volSet || r.play) ? 12 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.cinza, flexShrink: 0 }}>Fonte</span>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <select value={a.source || ""} onChange={(ev) => { const f = ev.target.value; if (!f) return; (e.zonasComodo || [e.id]).forEach((id) => enviar("media_player", "select_source", id, { source: f })); ajustarMesa(e, f, enviar); }} aria-label="Fonte"
              style={{ width: "100%", appearance: "none", WebkitAppearance: "none", background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12, padding: "11px 40px 11px 14px", fontSize: 15, fontWeight: 700, color: C.terra, cursor: "pointer", fontFamily: "inherit" }}>
              {!a.source && <option value="">Escolha a fonte</option>}
              {r.fontes.map((f) => <option key={f} value={f}>{nomeFonte(e, f)}</option>)}
            </select>
            <ChevronDown size={18} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.cinza, pointerEvents: "none" }} />
          </div>
        </div>
      )}
      {e.mesa && a.source === e.mesa.cfg.fonte && <PainelMesa e={e} enviar={enviar} />}
      {e.streamer && <PainelStreamer s={e.streamer} enviar={enviar} />}
      {/* Volume deste ambiente: embaixo, logo acima de "Sincronizar ambientes". */}
      {r.volSet && !((e.zonas || []).length > 1 && a.source) && <div style={{ marginTop: 12 }}>{e.receiver && <EntradasReceiver e={e} enviar={enviar} />}{volStreamer}<BarraVolume e={e} enviar={enviar} compacto
        onSoltar={e.receiver ? (v) => enviar("media_player", "volume_set", e.id, { volume_level: Math.min(TV_VOL_MAX, v) }) : undefined} /></div>}
      {(e.zonas || []).length > 1 && a.source && (
        <div style={{ marginTop: 12 }}>
          <div style={{ borderTop: `1px solid ${C.linha}`, paddingTop: 10 }}>
            {/* 1º: volume do Spotify (nunca entra na trava). */}
            {volStreamer}
            {juntas.length > 0 && (
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <span className="flex-1" style={{ fontSize: 12, fontWeight: 700, color: C.cinza }}>Volume das zonas</span>
                {/* Cadeado: travado = mexer numa zona coloca todas as zonas do cartão no mesmo volume. */}
                <button onClick={alternarTrava} aria-pressed={travado} className="flex items-center gap-1"
                  style={{ border: `1px solid ${travado ? LAGO : C.linha}`, background: travado ? LAGO : "transparent", color: travado ? "#fff" : C.cinza, borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {travado ? <Lock size={13} /> : <LockOpen size={13} />} {travado ? "Travados" : "Travar"}
                </button>
              </div>
            )}
            {/* Sempre na ordem das zonas do amplificador (zona 1, 2, 3...), com a zona deste cartão no seu lugar. */}
            {e.zonas.filter((z) => z.id === e.id ? r.volSet : juntas.some((j) => j.id === z.id)).map((z) => {
              const esta = z.id === e.id;
              return (
                <div key={z.id} style={{ marginBottom: esta ? 10 : 8 }}>
                  {(juntas.length > 0 || volStreamer) && <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: C.terra, marginBottom: 2 }}>{z.nome}</div>}
                  <BarraVolume e={esta ? e : z} enviar={enviar} compacto onSoltar={travado && juntas.length ? volumeEmTodas : undefined} />
                </div>
              );
            })}
          </div>
          <button onClick={() => setSincronizar(true)} className="flex items-center justify-center gap-2"
            style={{ width: "100%", marginTop: 4, background: "transparent", border: `1px dashed ${alfa(LAGO, 55)}`, color: LAGO, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            <Link2 size={17} /> Sincronizar ambientes
          </button>
        </div>
      )}
      {sincronizar && <SincronizarZonas e={e} zonas={e.zonas} enviar={enviar} onFechar={() => setSincronizar(false)} />}
    </div>
  );
}
function CtrlAlexa({ e, enviar }) {
  const [verPlaylists, setVerPlaylists] = useState(false);
  if (!e.spotify || !e.connect) return null;
  const a = e.attributes || {};
  const ativo = ["playing", "paused"].includes(e.state) && !e.soArmado;
  const pic = a.entity_picture, capa = pic ? (pic.startsWith("http") ? pic : (e.baseUrl || "") + pic) : null;
  const m = { tocando: e.state === "playing" };
  const sp = (serv) => () => enviar("media_player", serv, e.spotify);
  return (
    <div onPointerDown={(ev) => ev.stopPropagation()}>
      {ativo && (
        <div className="flex items-center gap-3">
          {capa ? <img src={capa} alt="" style={{ width: 58, height: 58, borderRadius: 10, objectFit: "cover", flexShrink: 0, boxShadow: "0 6px 16px -8px rgba(0,0,0,.5)" }} />
            : <span style={{ width: 58, height: 58, borderRadius: 10, background: alfa(LAGO, 14), flexShrink: 0 }} />}
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontWeight: 700, fontSize: 14.5, color: C.terra }}>{a.media_title || "—"}</div>
            {a.media_artist && <div className="truncate" style={{ fontSize: 12.5, color: C.cinza }}>{a.media_artist}</div>}
            {a.media_playlist && <div className="truncate" style={{ fontSize: 12, color: LAGO, fontWeight: 700, marginTop: 2 }}>Playlist: {a.media_playlist}</div>}
          </div>
        </div>
      )}
      {ativo && (
        <div className="flex items-center justify-center gap-3" style={{ marginTop: 10 }}>
          <BotaoMini Ic={SkipBack} rot="Música anterior" onClick={sp("media_previous_track")} />
          <BotaoMini Ic={m.tocando ? Pause : Play} rot={m.tocando ? "Pausar" : "Tocar"} onClick={sp("media_play_pause")} cheio />
          <BotaoMini Ic={SkipForward} rot="Próxima música" onClick={sp("media_next_track")} />
        </div>
      )}
      {ativo && typeof a.volume_level === "number" && (
        <div style={{ marginTop: 10 }}><BarraVolume e={{ id: e.spotify, attributes: a }} enviar={enviar} compacto semMudo /></div>
      )}
      {(ativo || e.soArmado) && e.pelaCasa && <div style={{ fontSize: 12, color: C.cinzaClaro, marginTop: 6 }}>Tocando pelo Spotify da casa</div>}
      {(ativo || e.soArmado) && e.multi && (
        <div style={{ marginTop: ativo ? 10 : 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {e.chaves.map((c, i) => {
            const fn = () => { const atuais = e.chaves.map((x, j) => (x.on ? j : -1)).filter((j) => j >= 0); escolherAlexas(e, c.on ? atuais.filter((j) => j !== i) : [...atuais, i], enviar); };
            return (
              <div key={c.rotulo} className="flex items-center gap-2" style={{ minWidth: 0, background: c.on ? alfa(LAGO, 10) : "transparent", border: `1px solid ${c.on ? alfa(LAGO, 40) : C.linha}`, borderRadius: 12, padding: "8px 10px", opacity: c.disponivel ? 1 : 0.5 }}>
                <span className="flex-1 truncate" style={{ fontSize: 13.5, fontWeight: 700, color: C.terra }}>{c.rotulo}</span>
                <PillToggle pequeno on={c.on} cor={LAGO} disabled={!c.disponivel} onClick={fn} />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-4" style={{ marginTop: ativo ? 8 : 0 }}>
        {e.pedirHA && (
          <button onClick={() => setVerPlaylists(true)} className="flex items-center gap-1" style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: LAGO, cursor: "pointer" }}>
            Minhas playlists <ChevronRight size={14} />
          </button>
        )}
        <button onClick={abrirSpotify} className="flex items-center gap-1" style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: C.cinza, cursor: "pointer" }}>
          Abrir o Spotify <ChevronRight size={14} />
        </button>
      </div>
      {verPlaylists && <PlaylistsSpotify st={{ spotify: e.spotify, connect: e.aquiFonte ? e.fonteSp : e.connect, nome: e.nome, pedirHA: e.pedirHA, conectarSpotify: e.conectarSpotify }} enviar={enviar} onFechar={() => setVerPlaylists(false)} />}
    </div>
  );
}

function CtrlIrrigacao({ e, enviar }) {
  const ind = !e.disponivel; const ativo = e.state === "on";
  return (
    <div>
      <div className="text-sm mb-2" style={{ color: ind ? C.cinzaClaro : (ativo ? LAGO : C.cinza), fontWeight: 700 }}>{ind ? "Indisponível" : (ativo ? "Irrigando…" : "Parada")}</div>
      <div className="flex gap-2">
        <BotaoAcao label="Iniciar" cor={C.pasto} disabled={ind} onClick={() => enviar("homeassistant", "turn_on", e.id)} />
        <BotaoAcao label="Parar" cor={C.cinza} disabled={ind} onClick={() => enviar("homeassistant", "turn_off", e.id)} />
      </div>
    </div>
  );
}
// Fechadura: destrancar pede confirmação; depois do toque mostra "Destrancando…" até o HA confirmar
// (ou 15 s sem resposta), como o popup da Porta Entrada. Nunca supõe que destrancou.
function CtrlFechadura({ e, enviar }) {
  const st = e.state, ind = !e.disponivel, trancado = st === "locked";
  const [cmd, setCmd] = useState(null); // { alvo: "locked" | "unlocked", st0 }
  useEffect(() => { if (cmd && st !== cmd.st0 && !["locking", "unlocking"].includes(st)) setCmd(null); }, [st, cmd]);
  useEffect(() => { if (!cmd) return; const t = setTimeout(() => setCmd(null), 15000); return () => clearTimeout(t); }, [cmd]);
  const movendo = !!cmd || st === "locking" || st === "unlocking";
  const texto = ind ? "Indisponível" : cmd ? (cmd.alvo === "unlocked" ? "Destrancando…" : "Trancando…")
    : st === "unlocking" ? "Destrancando…" : st === "locking" ? "Trancando…"
      : trancado ? "Trancado" : st === "unlocked" ? "Destrancado" : st === "jammed" ? "Travou — tente de novo" : haEstado(st).texto;
  const acionar = async () => {
    const destrancar = trancado;
    if (destrancar && !(await Dialog.confirm({ titulo: "Destrancar", mensagem: `Destrancar ${e.nome}?`, okLabel: "Destrancar", perigo: true }))) return;
    enviar("lock", destrancar ? "unlock" : "lock", e.id);
    setCmd({ alvo: destrancar ? "unlocked" : "locked", st0: st });
  };
  return (
    <div className="flex items-center gap-3">
      <div className={movendo ? "flex-1 text-sm ah-pisca" : "flex-1 text-sm"} style={{ color: ind ? C.cinzaClaro : (trancado ? C.pasto : C.ambar), fontWeight: 700 }}>{texto}</div>
      <BotaoAcao icon={trancado ? LockOpen : Lock} label={trancado ? "Destrancar" : "Trancar"} cor={trancado ? C.ambar : C.pasto} disabled={ind || movendo} onClick={acionar} />
    </div>
  );
}
function CtrlSensor({ e }) {
  const st = haEstado(e.state, e.attributes);
  return <div className="text-right"><span style={{ color: e.disponivel ? st.cor : C.cinzaClaro, fontWeight: 700, fontSize: 15 }}>{e.disponivel ? st.texto : "Indisponível"}</span></div>;
}
function EquipControle({ e, enviar, cardClicavel }) {
  if (e.tipo === "persiana") return <CtrlPersiana e={e} enviar={enviar} />;
  if (e.tipo === "ar") return <CtrlAr e={e} enviar={enviar} />;
  if (e.tipo === "tv" && e.controleTv) return estadoMidia(e).ligado ? <BotaoAcao icon={IconeControleRemoto} label="Controle remoto" cor={LAGO} onClick={e.abrirControle} /> : null;
  if (e.tipo === "tv") return <CtrlTv e={e} enviar={enviar} />;
  if (e.tipo === "irrigacao") return <CtrlIrrigacao e={e} enviar={enviar} />;
  if (e.tipo === "fechadura") return <CtrlFechadura e={e} enviar={enviar} />;
  if (e.tipo === "sensor") return <CtrlSensor e={e} />;
  if (e.tipo === "alexa") return <CtrlAlexa e={e} enviar={enviar} />;
  if (e.tipo === "botao") return <BotaoAcao icon={acaoBotao(e).Icon} label="Apertar" cor={C.lago} disabled={!e.disponivel} onClick={() => enviar("input_button", "press", e.id)} />;
  return <CtrlInterruptor e={e} enviar={enviar} cardClicavel={cardClicavel} />;
}
// Controle compacto do ar (quando o card está encolhido): liga/desliga + temperatura.
function CtrlArCompacto({ e, enviar }) {
  const ind = !e.disponivel; const a = e.attributes || {};
  const ligado = !!e.state && e.state !== "off" && !ind;
  const alvo = a.temperature;
  const min = a.min_temp != null ? a.min_temp : 16, max = a.max_temp != null ? a.max_temp : 30;
  const passo = a.target_temp_step || 1;
  const setTemp = (ev, delta) => { ev.stopPropagation(); if (alvo == null) return; let v = Math.round((alvo + delta * passo) * 10) / 10; v = Math.min(max, Math.max(min, v)); enviar("climate", "set_temperature", e.id, { temperature: v }); };
  const mini = { width: 26, height: 26, borderRadius: 8, border: `1px solid ${C.linha}`, background: C.card, color: C.terra, fontWeight: 700, fontSize: 15, lineHeight: "1", flexShrink: 0 };
  return (
    <div className="flex items-center" style={{ gap: 6 }}>
      {ligado && alvo != null ? (
        <div className="flex items-center" style={{ gap: 2 }}>
          <button onClick={(ev) => setTemp(ev, -1)} aria-label="Diminuir temperatura" style={mini}>−</button>
          <span style={{ fontWeight: 800, fontSize: 14, minWidth: 28, textAlign: "center", color: C.terra, fontVariantNumeric: "tabular-nums" }}>{Math.round(alvo)}°</span>
          <button onClick={(ev) => setTemp(ev, 1)} aria-label="Aumentar temperatura" style={mini}>+</button>
        </div>
      ) : (
        <div className="flex-1 text-sm" style={{ color: ind ? C.cinzaClaro : C.cinza, fontWeight: 600 }}>{ind ? "Indisponível" : "Desligado"}</div>
      )}
      <span style={{ marginLeft: "auto" }}><PillToggle pequeno on={ligado} cor={visualEquip(e).cor} disabled={ind} onClick={(ev) => { ev.stopPropagation(); if (ligado) desligarAr(e, enviar); else ligarAr(e, enviar); }} /></span>
    </div>
  );
}
// Controle compacto de persiana/flap (encolhido): dois botões ↑ abrir / ↓ fechar.
function CtrlPersianaCompacto({ e, enviar }) {
  const ind = !e.disponivel; const inv = ehInvertido(e);
  const st = estadoPersiana(e);
  const abrir = (ev) => { ev.stopPropagation(); enviar("cover", inv ? "close_cover" : "open_cover", e.id); };
  const fechar = (ev) => { ev.stopPropagation(); enviar("cover", inv ? "open_cover" : "close_cover", e.id); };
  const bt = { width: 34, height: 30, borderRadius: 9, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: ind ? "default" : "pointer", opacity: ind ? 0.5 : 1 };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-xs truncate" style={{ color: ind ? C.cinzaClaro : st.cor, fontWeight: 600 }}>{ind ? "Indisponível" : st.texto}</div>
      <button onClick={abrir} disabled={ind} title={rotulo(e, "abrir", "Abrir")} style={{ ...bt, background: C.pasto }}>{inv ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}</button>
      <button onClick={fechar} disabled={ind} title={rotulo(e, "fechar", "Fechar")} style={{ ...bt, background: alfa(C.cinza, 20), color: C.terra }}>{inv ? <ArrowUpFromLine size={16} /> : <ArrowDownToLine size={16} />}</button>
    </div>
  );
}
// Cartão "Persianas": fechado mostra o resumo; aberto mostra todas (e abrir/fechar todas).
function CartaoGrupoPersianas({ e, enviar, aberto, onAlternar, editando }) {
  const [exp, setExp] = useState(() => new Set());
  const alternarMembro = (id) => setExp((s0) => { const n = new Set(s0); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const v = visualPorTipo(e);
  const abertas = e.membros.filter((m) => visualPorTipo(m).ativo).length;
  const vezRef = useRef(0); // um toque novo interrompe o "uma por vez" que ainda está mandando
  // acao: "abrir" | "parar" | "fechar". Com a Persiana 0, um comando só move todas juntas e o app
  // já mostra as de 1 a 11 abrindo/fechando. Sem ela, manda uma por vez.
  const acionar = async (acao) => {
    const svc = (m) => (acao === "parar" ? "stop_cover" : (acao === "abrir") !== ehInvertido(m) ? "open_cover" : "close_cover");
    if (e.mestre) {
      enviar("cover", svc(e.mestre), e.mestre.id);
      if (acao !== "parar") e.preverEstados?.(e.membros.map((m) => [m.id, svc(m) === "open_cover" ? "opening" : "closing", svc(m) === "open_cover" ? "open" : "closed"]));
      return;
    }
    const vez = ++vezRef.current;
    const lista = e.membros.filter((m) => m.disponivel);
    const pausa = acao === "parar" ? 150 : 400; // parar precisa chegar rápido em todas
    for (let i = 0; i < lista.length; i++) {
      if (vez !== vezRef.current) return; // tocou em outro botão: este para de mandar
      enviar("cover", svc(lista[i]), lista[i].id);
      if (i < lista.length - 1) await new Promise((r) => setTimeout(r, pausa));
    }
  };
  return (
    <div style={{ background: v.ativo ? `color-mix(in srgb, ${v.cor} 10%, ${C.card})` : C.bg, border: `1px solid ${v.ativo ? alfa(v.cor, 38) : "transparent"}`,
      borderRadius: 16, padding: 12, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, transition: "background .25s, border-color .25s" }}>
      <div className="flex items-center" onClick={editando ? undefined : onAlternar} role="button" style={{ gap: 8, cursor: editando ? "default" : "pointer" }}>
        <IconeEquip v={v} disponivel={e.disponivel} />
        <div className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 650, color: C.terra }}>{e.nome} <span style={{ color: C.cinzaClaro, fontWeight: 600 }}>({e.membros.length})</span></div>
        <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: abertas ? C.ambarTexto : C.cinza }}>{abertas ? `${abertas} ${abertas === 1 ? "aberta" : "abertas"}` : "Todas fechadas"}</span>
        <ChevronDown size={16} style={{ color: C.cinzaClaro, flexShrink: 0, transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />
      </div>
      {/* Botões sempre à vista (cartão aberto ou fechado). */}
      <div className="flex gap-2" onPointerDown={(ev) => ev.stopPropagation()}>
        <BotaoAcao icon={ArrowUpFromLine} label={e.mestre ? "Abrir" : "Abrir todas"} cor={C.pasto} disabled={!e.disponivel} onClick={() => acionar("abrir")} />
        <BotaoAcao icon={X} label={e.mestre ? "Parar" : "Parar todas"} cor={C.ambar} disabled={e.mestre ? !e.mestre.disponivel : !e.disponivel} onClick={() => acionar("parar")} />
        <BotaoAcao icon={ArrowDownToLine} label={e.mestre ? "Fechar" : "Fechar todas"} cor={C.cinza} disabled={!e.disponivel} onClick={() => acionar("fechar")} />
      </div>
      {aberto && (
        <div onPointerDown={(ev) => ev.stopPropagation()}>
          <GradeEquip itens={e.membros} enviar={enviar} expandidos={exp} toggleExpand={alternarMembro} podeArrastar={false} />
        </div>
      )}
    </div>
  );
}

// Cartão de grupo de luzes: resumo + chave (alguma acesa → apaga todas; todas apagadas →
// acende todas, uma por vez). Tocar no título abre as luzes de dentro.
// Cartão de botões (ex.: Coifa): cada toque aperta o botão no HA. Não há como saber se está
// ligado (o comando vai por infravermelho), então não mostra estado.
// A coifa não informa nada (o comando vai por infravermelho): o app começa considerando tudo
// desligado e acompanha os toques — "Luz" inverte; "Velocidade +/−" sobe/desce de 0 (motor
// parado) até COIFA_VEL_MAX. ponytail: guardado só neste aparelho; toques pela Alexa ou por
// outro celular não entram — para valer para todos, precisaria de ajudantes no HA.
const COIFA_VEL_MAX = 3; // quantas velocidades a coifa tem (ajuste se for diferente)
function proximoBotao(st, ordem) {
  if (ordem === 0) return { ...st, luz: !st.luz };
  if (ordem === 1) return { ...st, vel: Math.max(0, st.vel - 1) };
  if (ordem === 2) return { ...st, vel: Math.min(COIFA_VEL_MAX, st.vel + 1) };
  return st;
}
function CartaoGrupoBotoes({ e, enviar }) {
  const chave = "botoesEstado:" + e.dbId;
  const [st, setSt] = useState(() => { try { return { luz: false, vel: 0, ...JSON.parse(localStorage.getItem(chave) || "{}") }; } catch { return { luz: false, vel: 0 }; } });
  const apertar = (m) => {
    enviar("input_button", "press", m.id);
    const n = proximoBotao(st, acaoBotao(m).ordem); setSt(n);
    try { localStorage.setItem(chave, JSON.stringify(n)); } catch { /* ok */ }
  };
  // Aceso: Luz quando a luz está ligada; Velocidade −/+ quando o motor está ligado.
  const aceso = (m) => { const o = acaoBotao(m).ordem; return o === 0 ? st.luz : o === 1 || o === 2 ? st.vel > 0 : false; };
  const algo = e.membros.some(aceso);
  const texto = [st.luz && "Luz acesa", st.vel > 0 && `Velocidade ${st.vel}`].filter(Boolean).join(" · ") || "Desligada";
  const v = { ...visualEquip(e), ativo: algo, cor: C.ambar, luz: true };
  return (
    <div style={{ background: algo ? `color-mix(in srgb, ${C.ambar} 10%, ${C.card})` : C.bg, border: `1px solid ${algo ? alfa(C.ambar, 38) : "transparent"}`,
      borderRadius: 16, padding: 12, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, transition: "background .25s, border-color .25s" }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <IconeEquip v={v} disponivel={e.disponivel} />
        <div className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 650, color: C.terra }}>{e.nome}</div>
        <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: algo ? C.ambarTexto : C.cinza }}>{texto}</span>
      </div>
      <div className="flex gap-2" onPointerDown={(ev) => ev.stopPropagation()}>
        {e.membros.map((m) => { const a = acaoBotao(m); return (
          <BotaoAcao key={m.id} icon={a.Icon} label={a.label} cor={aceso(m) ? C.ambar : C.cinza} disabled={!m.disponivel} onClick={() => apertar(m)} />
        ); })}
      </div>
    </div>
  );
}

function CartaoGrupoLuzes({ e, enviar, aberto, onAlternar, editando }) {
  const [exp, setExp] = useState(() => new Set());
  const alternarMembro = (id) => setExp((s0) => { const n = new Set(s0); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const v = visualPorTipo(e);
  const acesas = e.membros.filter(estaLigado).length;
  const soLuzes = e.membros.every((m) => m.tipo === "interruptor");
  const alternarTodas = async () => {
    const ligar = acesas === 0;
    const lista = e.membros.filter((m) => m.disponivel && estaLigado(m) !== ligar);
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].tipo === "ar") (ligar ? ligarAr : desligarAr)(lista[i], enviar);
      else enviar("homeassistant", ligar ? "turn_on" : "turn_off", lista[i].id);
      if (i < lista.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
  };
  return (
    // Mesmo formato dos outros cartões: título em cima; resumo e chave embaixo. Cabe pequeno.
    <div style={{ ...fundoCartao(e, v, v.ativo), borderRadius: 16, padding: 12, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, transition: "background .25s, border-color .25s" }}>
      <div className="flex items-center" onClick={editando ? undefined : onAlternar} role="button" style={{ gap: 8, cursor: editando ? "default" : "pointer" }}>
        <IconeEquip v={v} disponivel={e.disponivel} />
        <div className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 650, color: C.terra, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "break-word" }}>
          {e.nome} <span style={{ color: C.cinzaClaro, fontWeight: 600 }}>({e.membros.length})</span>
        </div>
        <ChevronDown size={16} style={{ color: C.cinzaClaro, flexShrink: 0, transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 text-sm" style={{ fontWeight: 600, color: acesas ? C.terra : C.cinza }}>{soLuzes ? (acesas ? `${acesas} ${acesas === 1 ? "ligada" : "ligadas"}` : "Desligadas") : (acesas ? `${acesas} ${acesas === 1 ? "ligado" : "ligados"}` : "Desligados")}</div>
        <span onPointerDown={(ev) => ev.stopPropagation()} style={{ flexShrink: 0, display: "flex" }}>
          <PillToggle on={acesas > 0} cor={C.ambar} disabled={!e.disponivel} onClick={alternarTodas} />
        </span>
      </div>
      {aberto && (
        <div onPointerDown={(ev) => ev.stopPropagation()}>
          <GradeEquip itens={e.membros} enviar={enviar} expandidos={exp} toggleExpand={alternarMembro} podeArrastar={false} />
        </div>
      )}
    </div>
  );
}

// Cartão de som/TV que outra pessoa ligou: a chave pergunta se quer dividir. Quem dividiu e
// desliga só sai (o aparelho continua para quem ligou). Quem ligou: liga/desliga de verdade.
function alternarUso(e, ligar, agir) {
  if (!e.uso) { agir(); return; }
  if (e.alheio) { e.uso.dividir(); return; }
  if (!ligar && e.ehParticipante) { e.uso.sair(); return; }
  agir();
  if (ligar) e.uso.registrar(); else e.uso.encerrar();
}
function DividirSheet({ e, temSpotify, onDividir, onMeuSpotify, onFechar }) {
  const tv = !!e.controleTv;
  const quem = e.usoDe || "Outra pessoa";
  const bt = (txt, fn, cheio) => (
    <button onClick={fn} style={{ width: "100%", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15.5, marginBottom: 8, background: cheio ? C.pasto : C.card, color: cheio ? "#fff" : C.terra, border: cheio ? "none" : `1px solid ${C.linha}` }}>{txt}</button>
  );
  return (
    <Sheet titulo={tv ? "Dividir a TV?" : "Dividir o som?"} onFechar={onFechar}>
      <div className="text-center" style={{ color: C.cinza, fontSize: 14.5, marginBottom: 14 }}>{e.usoDe ? `${quem} está usando ${tv ? "a TV" : "o som"} de ${e.nome}.` : `${tv ? "A TV" : "O som"} de ${e.nome} foi ligad${tv ? "a" : "o"} fora do app (controle remoto ou voz).`}</div>
      {bt(tv ? "Sim, dividir a TV" : "Só dividir o som", onDividir, true)}
      {!tv && temSpotify && bt("Mudar para o meu Spotify", onMeuSpotify)}
      <button onClick={onFechar} style={{ width: "100%", color: C.cinza, padding: 12, fontWeight: 600 }}>Cancelar</button>
    </Sheet>
  );
}
// Cor do cartão por tipo: desligado = bem clarinho (só se destaca do fundo do cômodo); ligado = vivo.
// Tipos com cor própria (ex.: ar = azul) ganham um toque da cor também desligados.
const AZUL_AR = "#3b7dd8";
const COR_TIPO = { ar: AZUL_AR };
function fundoCartao(e, v, ativo) {
  const cor = COR_TIPO[e.tipo];
  if (ativo) return { background: `color-mix(in srgb, ${v.cor} ${cor ? 22 : 10}%, ${C.card})`, border: `1px solid ${alfa(v.cor, cor ? 60 : 38)}` };
  return { background: cor ? `color-mix(in srgb, ${cor} 13%, var(--c-cartaoOff, ${C.card}))` : `var(--c-cartaoOff, ${C.card})`, border: `1px solid ${cor ? alfa(cor, 18) : "transparent"}` };
}
function EquipCard({ e, enviar, expandido, onExpandir, editando }) {
  const [tomAberto, setTomAberto] = useState(false); // ajustes de som (zonas do AAT)
  if (e.tipo === "grupoBotoes") return <CartaoGrupoBotoes e={e} enviar={enviar} />;
  if (e.tipo === "grupoLuzes") return <CartaoGrupoLuzes e={e} enviar={enviar} aberto={expandido} onAlternar={onExpandir} editando={editando} />;
  if (e.tipo === "grupoPersianas") return <CartaoGrupoPersianas e={e} enviar={enviar} aberto={expandido} onAlternar={onExpandir} editando={editando} />;
  const v = visualEquip(e);
  const ativo = v.ativo && e.disponivel;
  const compactavel = CTRL_COMPACTAVEL.includes(e.tipo);
  const grande = e.tamanho === "g"; // ocupa 2 colunas e mostra o controle completo
  const compacto = compactavel && !expandido && !grande;
  // Luz/tomada: tocar no quadro liga/desliga. Ar/persiana encolhidos: tocar amplia.
  const cardClick = editando ? undefined
    : e.tipo === "interruptor" && e.disponivel ? () => enviar("homeassistant", "toggle", e.id)
      : compacto ? onExpandir : undefined;
  return (
    // Ligado = o quadro "acende" na cor do aparelho; desligado = fundo rebaixado e ícone apagado.
    <div onClick={cardClick} role={cardClick ? "button" : undefined}
      style={{ ...fundoCartao(e, v, ativo),
        borderRadius: 16, height: "100%", padding: 12, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10,
        cursor: cardClick ? "pointer" : "default", transition: "background .25s, border-color .25s" }}>
      <div className="flex items-center" onClick={!editando && compactavel && expandido ? (ev) => { ev.stopPropagation(); onExpandir(); } : undefined} style={{ gap: 8, cursor: compactavel && !editando ? "pointer" : "default" }}>
        {ehZonaAAT(e.id) && e.tons && !editando && !e.alheio
          ? <button onClick={(ev) => { ev.stopPropagation(); setTomAberto((x) => !x); }} onPointerDown={(ev) => ev.stopPropagation()} aria-label={tomAberto ? "Fechar ajustes de som" : "Ajustes de som (agudo, grave e balanço)"} aria-expanded={tomAberto}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexShrink: 0, borderRadius: 12, outline: tomAberto ? `2px solid ${LAGO}` : "none", outlineOffset: 2 }}><IconeEquip v={v} disponivel={e.disponivel} /></button>
          : <IconeEquip v={v} disponivel={e.disponivel} />}
        <div className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 650, color: C.terra, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "break-word" }}>{e.nome}</div>
        {e.tipo === "alexa" && (() => {
          const tocando = e.state === "playing", ligada = ["playing", "paused"].includes(e.state);
          // Sem o Spotify da pessoa no HA: a chave abre o Spotify do celular dela para escolher a Alexa.
          const txt = e.alheio ? (e.usoDe ? `Com ${e.usoDe}` : "Ligado fora do app") : !e.spotify ? "Pelo seu Spotify" : !e.connect ? "Alexa não encontrada" : tocando ? "Tocando" : e.soArmado ? "Escolha onde tocar" : ligada ? "Pausado" : "Desligado";
          return (<>
            <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: ligada ? LAGO : C.cinza }}>{txt}</span>
            {!e.spotify && <span onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} style={{ flexShrink: 0, display: "flex" }}>
              <PillToggle on={false} cor={LAGO} onClick={abrirSpotify} />
            </span>}
            {e.spotify && e.connect && <span onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} style={{ flexShrink: 0, display: "flex" }}>
              <PillToggle on={ligada && !e.alheio} cor={LAGO} onClick={() => alternarUso(e, !ligada, () => ligarAlexa(e, !ligada, enviar))} />
            </span>}
          </>);
        })()}
        {e.tipo === "tv" && (() => {
          const m = estadoMidia(e);
          return (<>
            <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: m.ind ? C.cinzaClaro : m.ligado ? LAGO : C.cinza }}>{e.alheio ? (e.usoDe ? `Com ${e.usoDe}` : "Ligado fora do app") : m.texto}</span>
            {m.r.liga && <span onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} style={{ flexShrink: 0, display: "flex" }}>
              <PillToggle on={m.ligado && !e.alheio} cor={LAGO} disabled={m.ind} onClick={() => alternarUso(e, !m.ligado, () => { acionarZonas(e, !m.ligado, enviar); if (!m.ligado) e.abrirControle?.(); })} />
            </span>}
          </>);
        })()}
        {e.tipo === "persiana" && !compacto && (() => { const st = estadoPersiana(e); return <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: st.cor }}>{st.texto}</span>; })()}
        {luzAjustavel(e) && !editando && (
          <button onClick={(ev) => { ev.stopPropagation(); onExpandir(); }} onPointerDown={(ev) => ev.stopPropagation()} aria-label={expandido ? "Fechar ajustes da luz" : "Ajustar brilho e cor"} aria-expanded={expandido}
            style={{ flexShrink: 0, width: 30, height: 30, margin: "-6px -6px 0 0", alignSelf: "flex-start", display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 10, background: "transparent", color: C.cinza, cursor: "pointer" }}>
            <ChevronDown size={18} style={{ transform: expandido ? "rotate(180deg)" : "none", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />
          </button>
        )}
        {compactavel && !grande && !editando && <ChevronDown size={16} style={{ color: C.cinzaClaro, flexShrink: 0, transform: expandido ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />}
      </div>
      {/* Ajustes de som logo abaixo do título (abre/fecha pelo ícone). */}
      {tomAberto && ehZonaAAT(e.id) && <PainelTomAAT e={e} enviar={enviar} />}
      {compacto
        ? (e.tipo === "ar" ? <CtrlArCompacto e={e} enviar={enviar} /> : <CtrlPersianaCompacto e={e} enviar={enviar} />)
        : e.alheio ? null : <EquipControle e={e} enviar={enviar} cardClicavel={e.tipo === "interruptor" && !!cardClick} />}
      {luzAjustavel(e) && expandido && <CtrlLuzAjuste e={e} enviar={enviar} />}
    </div>
  );
}

/* ---- Modo GERENCIAR (só gestor) ---- */
// Busca de aparelho novo: só os equipamentos da lista do painel LAB (src/catalogoLab.json),
// agrupados pelo cômodo sugerido — o grupo do cômodo que está sendo montado vem primeiro.
// Cada item já traz o nome e o tipo de controle da lista.
function SeletorAparelho({ ents, areas, usados, comodo, onEscolher, onFechar }) {
  const [busca, setBusca] = useState("");
  const [todos, setTodos] = useState(false); // também os aparelhos do HA que não estão na lista
  const q = norm(busca);
  const aqui = norm(comodo || "");
  const naLista = new Set(CATALOGO_LAB.map((x) => x.id));
  const outros = todos ? Object.entries(ents)
    .filter(([id]) => HA_ESCOLHIVEIS.includes(id.split(".")[0]) && !naLista.has(id))
    .map(([id, v]) => ({ id, nome: v.attributes?.friendly_name || id, tipo: tipoSugerido(id), grupo: "Fora da lista", ambiente: `Outros do Home Assistant${areas?.[id] ? " · " + areas[id] : ""}` })) : [];
  const itens = [...CATALOGO_LAB, ...outros]
    .filter((x) => !usados.has(x.id))
    // Busca por palavras, em qualquer ordem ("persiana churrasqueira" acha "Persiana · Churrasqueira"),
    // e também pelo identificador do HA como está escrito ("int_subsolo" acha switch.int_subsolo_l1).
    .filter((x) => { if (!q) return true; const alvo = norm(`${x.nome} ${x.id} ${x.id.replace(/[._]/g, " ")} ${x.ambiente} ${x.grupo}`); return q.split(/\s+/).filter(Boolean).every((w) => alvo.includes(w)); });
  const grupos = {};
  itens.forEach((x) => { (grupos[x.ambiente || ""] ||= []).push(x); });
  const fora = (n) => n.startsWith("Outros do Home Assistant");
  const nomes = Object.keys(grupos).sort((a, b) =>
    (norm(b) === aqui) - (norm(a) === aqui) || fora(a) - fora(b) || (a === "") - (b === "") || a.localeCompare(b, "pt-BR"));
  const restam = CATALOGO_LAB.filter((x) => !usados.has(x.id)).length;
  return (
    <div style={{ border: `1px dashed ${LAGO}66`, borderRadius: 12, background: C.lagoClaro, padding: 10, marginTop: 8 }}>
      <div className="flex items-center gap-2 mb-2">
        <Search size={16} style={{ color: C.cinza }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome ou cômodo…" style={{ ...inpControle, background: C.card }} autoFocus />
        <button onClick={onFechar} aria-label="Fechar" style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: 8 }}><X size={16} /></button>
      </div>
      <div className="flex items-center gap-2 mb-2" style={{ background: todos ? C.card : "transparent", border: `1px solid ${todos ? alfa(LAGO, 40) : C.linha}`, borderRadius: 10, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color: LAGO_ESC }}>
        <Search size={13} /> <span className="flex-1">{todos ? "Mostrando também os outros aparelhos do Home Assistant" : "Mostrar outros aparelhos do Home Assistant"}</span>
        <Toggle on={todos} onToggle={() => setTodos((v) => !v)} />
      </div>
      {todos && Object.keys(ents).length === 0 && <div style={{ color: C.cinza, fontSize: 12.5 }} className="pb-2 text-center">Os outros aparelhos só aparecem com o Controle conectado ao Home Assistant.</div>}
      {restam === 0 && <div style={{ color: C.cinza, fontSize: 13 }} className="py-2 text-center">Todos os aparelhos da lista já foram adicionados.</div>}
      {restam > 0 && itens.length === 0 && <div style={{ color: C.cinza, fontSize: 13 }} className="py-2 text-center">Nada encontrado com “{busca}”.</div>}
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {nomes.map((nomeG) => (
          <div key={nomeG || "_"} className="mb-2">
            <div className="flex items-center gap-2" style={{ position: "sticky", top: 0, zIndex: 1, background: C.lagoClaro, padding: "4px 2px", fontSize: 12.5, fontWeight: 800, color: LAGO_ESC }}>
              <MapPin size={12} /><span className="flex-1 truncate">{nomeG || "Sem cômodo definido"}</span>
              <span style={{ fontWeight: 700, color: C.cinza }}>{grupos[nomeG].length}</span>
            </div>
            {grupos[nomeG].map((x) => {
              const live = ents[x.id];
              const ind = live && ["unavailable", "unknown"].includes(live.state);
              return (
                <button key={x.id} onClick={() => onEscolher(x)} style={{ width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: "8px 11px", marginBottom: 6, cursor: "pointer" }}>
                  <div className="flex items-center gap-2">
                    <Plus size={15} style={{ color: C.pasto, flexShrink: 0 }} />
                    <div className="min-w-0" style={{ flex: 1 }}>
                      <div className="flex items-center gap-2">
                        <span className="truncate" style={{ fontWeight: 600, fontSize: 14, color: C.terra, flex: 1 }}>{x.nome}</span>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: C.cinza, border: `1px solid ${C.linha}`, borderRadius: 999, padding: "1px 8px" }}>{x.grupo}</span>
                      </div>
                      <div className="truncate" style={{ fontSize: 11, color: C.cinzaClaro }}>{CTRL_TIPO_NOME[x.tipo] || x.tipo}{ind ? " · sem estado no HA" : ""} · {x.id}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
function AmbienteGerenciar({ amb, pavimentos, itens, ents, areas, usados, onRenomearAmb, onExcluirAmb, onMoverAmb, onVisitanteAmb, onAddEquip, onTipoEquip, onNomeEquip, onDelEquip, onRotulo }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(amb.nome);
  const [abrindoSel, setAbrindoSel] = useState(false);
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.linha}`, borderRadius: 12, padding: 11, marginBottom: 10 }}>
      <div className="flex items-center gap-2">
        {editando ? (
          <>
            <input value={nome} onChange={(e) => setNome(e.target.value)} style={inpControle} autoFocus />
            <button onClick={() => { if (nome.trim()) onRenomearAmb(amb.id, nome.trim()); setEditando(false); }} style={{ background: C.pasto, color: "#fff", borderRadius: 10, padding: 9 }}><Check size={16} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={{ color: C.cinza, fontSize: 13, flexShrink: 0 }}>{aberto ? "▾" : "▸"}</span>
              <span className="font-bold truncate" style={{ fontSize: 15, color: C.terra }}>{amb.nome}</span>
              <span style={{ fontSize: 11, color: C.cinza, border: `1px solid ${C.linha}`, borderRadius: 999, padding: "1px 8px", flexShrink: 0 }}>{itens.length}</span>
            </button>
            {pavimentos.length > 0 && (
              <select value={amb.pavimento_id || ""} onChange={(e) => onMoverAmb(amb.id, e.target.value || null)} title="Mudar de pavimento" style={{ border: `1px solid ${C.linha}`, borderRadius: 9, padding: "6px 8px", fontSize: 12, background: C.card, color: C.cinza }}>
                {pavimentos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            )}
            <button onClick={() => { setNome(amb.nome); setEditando(true); }} title="Renomear" style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 9, padding: 8 }}><Pencil size={14} style={{ color: C.cinza }} /></button>
            <button onClick={() => { if (window.confirm(`Excluir o cômodo "${amb.nome}"?`)) onExcluirAmb(amb.id); }} title="Excluir cômodo" style={{ background: C.vermelhoClaro, border: `1px solid ${alfa(C.vermelho, 27)}`, borderRadius: 9, padding: 8 }}><Trash2 size={14} style={{ color: C.vermelho }} /></button>
          </>
        )}
      </div>
      {!editando && (
        <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12.5, color: C.cinza }}>
          <Clock size={13} style={{ flexShrink: 0 }} /><span className="flex-1">Visitantes podem usar</span>
          <Toggle on={amb.visitante !== false} onToggle={() => onVisitanteAmb(amb.id, amb.visitante === false)} />
        </div>
      )}

      {aberto && (<div className="mt-3">
        {itens.length === 0 && <div style={{ color: C.cinzaClaro, fontSize: 12.5 }} className="mb-2">Nenhum aparelho ainda neste cômodo.</div>}
        {itens.map((q) => {
          const live = ents[q.entity_id];
          const original = live?.attributes?.friendly_name || q.entity_id; // nome de referência (vem do HA)
          return (
            <div key={q.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: 10, marginBottom: 7 }}>
              <div className="flex items-start gap-2 mb-2">
                <span style={{ fontSize: 16, lineHeight: "18px" }}>{CTRL_EMOJI[q.tipo] || "●"}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontWeight: 600, fontSize: 13.5, color: C.terra }}>{q.nome || original}</div>
                  <div className="truncate" style={{ fontSize: 10.5, color: C.cinzaClaro }}>{q.entity_id}</div>
                </div>
                <button onClick={() => onDelEquip(q.id)} title="Remover do cômodo" style={{ background: C.vermelhoClaro, borderRadius: 9, padding: 7, flexShrink: 0 }}><Trash2 size={14} style={{ color: C.vermelho }} /></button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: C.cinzaClaro, marginBottom: 3 }}>Nome que aparece no controle</div>
                <input defaultValue={q.nome || ""} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (q.nome || "")) onNomeEquip(q.id, v); }} placeholder={original} style={{ ...inpControle, width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.cinzaClaro, marginBottom: 3 }}>Como controla</div>
                <select value={q.tipo} onChange={(e) => onTipoEquip(q.id, e.target.value)} style={{ ...inpControle, width: "100%" }}>
                  {CTRL_TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              {ROTULOS_POR_TIPO[q.tipo] && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: C.cinzaClaro, marginBottom: 4 }}>Nomes dos botões (aparecem no controle)</div>
                  <div className="flex gap-2">
                    {ROTULOS_POR_TIPO[q.tipo].map(([chave, padrao]) => (
                      <div key={chave} style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: C.cinzaClaro, marginBottom: 2 }}>{padrao}</div>
                        <input defaultValue={(q.rotulos && q.rotulos[chave]) || ""} onBlur={(ev) => { const v = ev.target.value.trim(); if (v !== ((q.rotulos && q.rotulos[chave]) || "")) onRotulo(q.id, chave, v); }} placeholder={padrao} style={{ ...inpControle, width: "100%", boxSizing: "border-box" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {abrindoSel
          ? <SeletorAparelho ents={ents} areas={areas} usados={usados} comodo={amb.nome} onEscolher={(x) => { onAddEquip(amb.id, x.id, { nome: x.nome, tipo: x.tipo }); }} onFechar={() => setAbrindoSel(false)} />
          : <button onClick={() => setAbrindoSel(true)} style={{ marginTop: 2, background: C.pastoClaro, color: C.pastoEsc, border: `1px solid ${alfa(C.pasto, 20)}`, borderRadius: 10, padding: "8px 12px", fontWeight: 700, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Adicionar aparelho</button>}
      </div>)}
    </div>
  );
}
function PavimentoGerenciar({ pav, pavimentos, ambientes, equipamentos, ents, areas, usados, cbs }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(pav.nome);
  const [novoAmb, setNovoAmb] = useState("");
  const [aberto, setAberto] = useState(false);
  const meus = ambientes.filter((a) => a.pavimento_id === pav.id).sort((a, b) => a.ordem - b.ordem);
  const nDisp = equipamentos.filter((q) => meus.some((a) => a.id === q.ambiente_id)).length;
  return (
    <div style={{ border: `1px solid ${C.linha}`, borderRadius: 16, background: C.card, padding: 12, marginBottom: 14 }}>
      <div className="flex items-center gap-2">
        {editando ? (
          <>
            <input value={nome} onChange={(e) => setNome(e.target.value)} style={inpControle} autoFocus />
            <button onClick={() => { if (nome.trim()) cbs.onRenomearPav(pav.id, nome.trim()); setEditando(false); }} style={{ background: C.pasto, color: "#fff", borderRadius: 10, padding: 9 }}><Check size={16} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={{ color: C.cinza, fontSize: 15, flexShrink: 0 }}>{aberto ? "▾" : "▸"}</span>
              <span className="font-bold truncate" style={{ fontSize: 17, color: C.terra }}>🏢 {pav.nome}</span>
              <span style={{ fontSize: 11.5, color: C.cinza, border: `1px solid ${C.linha}`, borderRadius: 999, padding: "1px 9px", flexShrink: 0 }}>{nDisp}</span>
            </button>
            <button onClick={() => { setNome(pav.nome); setEditando(true); }} title="Renomear pavimento" style={{ background: C.bg, border: `1px solid ${C.linha}`, borderRadius: 9, padding: 8 }}><Pencil size={15} style={{ color: C.cinza }} /></button>
            <button onClick={() => { if (window.confirm(`Excluir o pavimento "${pav.nome}"? Os cômodos dele ficam "sem pavimento".`)) cbs.onExcluirPav(pav.id); }} title="Excluir pavimento" style={{ background: C.vermelhoClaro, border: `1px solid ${alfa(C.vermelho, 27)}`, borderRadius: 9, padding: 8 }}><Trash2 size={15} style={{ color: C.vermelho }} /></button>
          </>
        )}
      </div>
      {aberto && (<div className="mt-3">
        {meus.length === 0 && <div style={{ color: C.cinzaClaro, fontSize: 13 }} className="mb-2">Nenhum cômodo neste pavimento ainda.</div>}
        {meus.map((a) => (
          <AmbienteGerenciar key={a.id} amb={a} pavimentos={pavimentos} ents={ents} areas={areas} usados={usados}
            itens={equipamentos.filter((q) => q.ambiente_id === a.id).sort((x, y) => x.ordem - y.ordem)}
            onRenomearAmb={cbs.onRenomearAmb} onExcluirAmb={cbs.onExcluirAmb} onMoverAmb={cbs.onMoverAmb} onVisitanteAmb={cbs.onVisitanteAmb}
            onAddEquip={cbs.onAddEquip} onTipoEquip={cbs.onTipoEquip} onNomeEquip={cbs.onNomeEquip} onDelEquip={cbs.onDelEquip} onRotulo={cbs.onRotulo} />
        ))}
        <div className="flex gap-2 mt-1">
          <input value={novoAmb} onChange={(e) => setNovoAmb(e.target.value)} placeholder="Novo cômodo (ex.: Sala TV)" style={inpControle} />
          <button onClick={() => { if (novoAmb.trim()) { cbs.onCriarAmb(pav.id, novoAmb.trim()); setNovoAmb(""); } }} style={{ background: C.pasto, color: "#fff", borderRadius: 10, padding: "0 16px", fontWeight: 700 }}>Criar</button>
        </div>
      </div>)}
    </div>
  );
}
// Liga cada pessoa do app ao Spotify dela que está no Home Assistant (quando o nome não bate
// sozinho, ex.: "calinoandrade", "Priscila Neri"). Fica gravado no perfil (perfis.spotify_entity).
function SpotifyPessoas({ ents }) {
  const [pessoas, setPessoas] = useState(null), [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false); // começa recolhido; toca no título para configurar
  const contas = Object.keys(ents).filter((id) => id.startsWith("media_player.spotify_"))
    .map((id) => ({ id, nome: String(ents[id]?.attributes?.friendly_name || id).replace(/^Spotify\s*/i, "") }));
  const carregar = () => supabase.from("perfis").select("*").eq("ativo", true).order("nome").then(({ data, error }) => {
    if (error) { setErro(error.message); return; }
    setPessoas((data || []).filter((x) => x.papel !== "visitante"));
  });
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const salvar = async (id, valor) => {
    const { error } = await supabase.from("perfis").update({ spotify_entity: valor || null }).eq("id", id);
    if (error) { setErro(/spotify_entity/.test(error.message) ? "Falta rodar o SQL spotify-pessoa.sql no Supabase." : error.message); return; }
    setErro(""); carregar();
  };
  return (
    <div className="mb-4" style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14, padding: 12 }}>
      <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex items-center gap-2" style={{ width: "100%", textAlign: "left" }}>
        <Music size={16} style={{ color: C.pasto }} /><span className="flex-1 font-bold" style={{ fontSize: 15 }}>Spotify de cada pessoa</span>
        <ChevronDown size={18} style={{ color: C.cinza, transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />
      </button>
      {aberto && erro && <div style={{ color: C.vermelho, fontSize: 13, margin: "8px 0" }}>{erro}</div>}
      {!aberto ? null : !pessoas ? <div style={{ color: C.cinza, fontSize: 13, marginTop: 8 }}>Carregando…</div> : pessoas.map((x) => {
        const auto = spotifyDaPessoa(ents, x.nome);
        return (
          <div key={x.id} className="flex items-center gap-2" style={{ borderTop: `1px solid ${C.linha}`, padding: "8px 0" }}>
            <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, fontWeight: 600 }}>{x.nome}</span>
            <select value={x.spotify_entity || ""} onChange={(e) => salvar(x.id, e.target.value)}
              style={{ flexShrink: 0, maxWidth: "55%", border: `1px solid ${C.linha}`, borderRadius: 9, padding: "6px 8px", fontSize: 13, background: C.card, color: C.terra }}>
              <option value="">{auto ? `Automático (${contas.find((c) => c.id === auto)?.nome || auto})` : "Sem Spotify"}</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}
function GerenciarView({ pavimentos, ambientes, equipamentos, ents, areas, cbs }) {
  const [novoPav, setNovoPav] = useState("");
  const usados = new Set(equipamentos.map((q) => q.entity_id));
  const orfaos = ambientes.filter((a) => !a.pavimento_id || !pavimentos.some((p) => p.id === a.pavimento_id));
  return (
    <div>
      <div className="mb-3" style={{ background: C.lagoClaro, border: `1px solid ${LAGO}33`, borderRadius: 12, padding: "10px 12px", fontSize: 12.5, color: LAGO_ESC }}>
        Organize a casa: dentro de cada pavimento crie os cômodos e escolha quais aparelhos aparecem. Só você (gestor) vê esta tela.
      </div>
      <div className="flex gap-2 mb-4">
        <input value={novoPav} onChange={(e) => setNovoPav(e.target.value)} placeholder="Novo pavimento (ex.: Térreo)" style={inpControle} />
        <button onClick={() => { if (novoPav.trim()) { cbs.onCriarPav(novoPav.trim()); setNovoPav(""); } }} style={{ background: LAGO, color: "#fff", borderRadius: 10, padding: "0 16px", fontWeight: 700 }}>Criar</button>
      </div>
      {pavimentos.length === 0 && orfaos.length === 0 && <div className="text-center py-10" style={{ color: C.cinza }}>Nenhum pavimento ainda. Crie o primeiro acima. 🏢</div>}
      {pavimentos.map((pav) => (
        <PavimentoGerenciar key={pav.id} pav={pav} pavimentos={pavimentos} ambientes={ambientes} equipamentos={equipamentos} ents={ents} areas={areas} usados={usados} cbs={cbs} />
      ))}
      {orfaos.length > 0 && (
        <div style={{ border: `1px dashed ${C.linha}`, borderRadius: 16, padding: 12, marginBottom: 14 }}>
          <div className="font-bold mb-3" style={{ fontSize: 15, color: C.cinza }}>Sem pavimento</div>
          {orfaos.map((a) => (
            <AmbienteGerenciar key={a.id} amb={a} pavimentos={pavimentos} ents={ents} areas={areas} usados={usados}
              itens={equipamentos.filter((q) => q.ambiente_id === a.id).sort((x, y) => x.ordem - y.ordem)}
              onRenomearAmb={cbs.onRenomearAmb} onExcluirAmb={cbs.onExcluirAmb} onMoverAmb={cbs.onMoverAmb} onVisitanteAmb={cbs.onVisitanteAmb}
              onAddEquip={cbs.onAddEquip} onTipoEquip={cbs.onTipoEquip} onNomeEquip={cbs.onNomeEquip} onDelEquip={cbs.onDelEquip} onRotulo={cbs.onRotulo} />
          ))}
        </div>
      )}
    </div>
  );
}

// Grade de aparelhos de um cômodo, com "segurar para arrastar" (igual ao app Vitá):
// segura 3s → o card flutua seguindo o dedo, os outros tremem e abrem vaga; solta e salva.
function GradeEquip({ itens, enviar, expandidos, toggleExpand, podeArrastar, onReordenar, editando, setEditando, onTamanho, onSegurar }) {
  const [ordem, setOrdem] = useState(() => itens.map((e) => e.dbId));
  const [arrastando, setArrastando] = useState(null);
  const [pos, setPos] = useState(null);
  const pressTimer = useRef(null), press = useRef(null), longPressed = useRef(false);
  const pega = useRef(null), itemRefs = useRef({}), arrastou = useRef(false), gradeRef = useRef(null);
  const ESPERA_MS = 500, TOL = 10; // igual ao Vitá: casa com a vibração do toque longo

  // Re-sincroniza com o banco (tempo real) quando não está arrastando.
  useEffect(() => { if (arrastando == null) setOrdem((o) => { const n = itens.map((e) => e.dbId); return n.join() === o.join() ? o : n; }); }, [itens, arrastando]);
  useEffect(() => () => clearTimeout(pressTimer.current), []); // não "pega" card depois de sair da tela
  // Enquanto arrasta, barra a rolagem da tela na unha.
  useEffect(() => {
    const el = gradeRef.current; if (!el || arrastando == null) return;
    const barrar = (ev) => ev.preventDefault();
    el.addEventListener("touchmove", barrar, { passive: false });
    return () => el.removeEventListener("touchmove", barrar);
  }, [arrastando]);

  // Arrastando perto da borda de baixo (ou logo abaixo do cabeçalho), a tela rola sozinha — assim
  // dá para levar um cartão até o fim de um cômodo comprido.
  const ultimoPonto = useRef(null), reordenarRef = useRef(null);
  useEffect(() => {
    if (arrastando == null) return;
    const passo = () => {
      const p = ultimoPonto.current;
      if (p) {
        const borda = 90, alto = window.innerHeight;
        const topoLivre = document.querySelector("header")?.getBoundingClientRect().bottom || 0;
        const v = p.y > alto - borda ? Math.min(18, (p.y - (alto - borda)) / 4) : p.y < topoLivre + borda ? -Math.min(18, (topoLivre + borda - p.y) / 4) : 0;
        if (v) { window.scrollBy(0, v); reordenarRef.current?.(p.x, p.y); }
      }
    };
    const iv = setInterval(passo, 16);
    return () => clearInterval(iv);
  }, [arrastando]);

  const byId = Object.fromEntries(itens.map((e) => [e.dbId, e]));
  const ordenados = ordem.map((id) => byId[id]).filter(Boolean);
  const largoDe = (e) => e.tamanho === "g" || (CTRL_LARGO.includes(e.tipo) && (!CTRL_COMPACTAVEL.includes(e.tipo) || expandidos.has(e.dbId)))
    || (luzAjustavel(e) && expandidos.has(e.dbId));

  function pegar() {
    const p = press.current; if (!p || arrastando != null) return;
    press.current = null; clearTimeout(pressTimer.current);
    longPressed.current = true;
    const r = p.el.getBoundingClientRect();
    pega.current = { offX: p.x - r.left, offY: p.y - r.top, w: r.width, h: r.height };
    try { p.el.setPointerCapture?.(p.pid); } catch { /* ok */ }
    arrastou.current = false; setPos({ x: p.x, y: p.y }); setArrastando(p.id); setEditando?.(true);
  }
  function aoPressionar(e, id) {
    if (!podeArrastar && !onSegurar) return;
    longPressed.current = false;
    press.current = { id, pid: e.pointerId, el: e.currentTarget, x: e.clientX, y: e.clientY };
    clearTimeout(pressTimer.current);
    // Painel pessoal: segurar abre as opções do aparelho (em vez de arrastar).
    pressTimer.current = setTimeout(onSegurar ? () => { const it = itens.find((x) => x.dbId === id); press.current = null; longPressed.current = true; if (it) onSegurar(it); } : pegar, ESPERA_MS);
  }
  function aoMover(e) {
    if (arrastando == null) {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TOL) { clearTimeout(pressTimer.current); press.current = null; }
      return;
    }
    arrastou.current = true; ultimoPonto.current = { x: e.clientX, y: e.clientY }; setPos({ x: e.clientX, y: e.clientY }); reordenar(e.clientX, e.clientY);
  }
  reordenarRef.current = reordenar;
  function aoSoltar() {
    clearTimeout(pressTimer.current); press.current = null; ultimoPonto.current = null;
    if (arrastando != null) {
      const ids = ordem.slice();
      setArrastando(null); setPos(null); pega.current = null;
      onReordenar?.(ids);
      setTimeout(() => { arrastou.current = false; longPressed.current = false; }, 0);
    }
  }
  function reordenar(x, y) {
    const outros = ordem.filter((id) => id !== arrastando);
    let alvo = 0;
    for (const id of outros) {
      const el = itemRefs.current[id]; if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y > r.bottom || (y > r.top && x > r.left + r.width / 2)) alvo++;
    }
    // Dedo no fim da grade (ou abaixo dela): vai para o último lugar.
    const g = gradeRef.current?.getBoundingClientRect();
    if (g && y > g.bottom - 24) alvo = outros.length;
    const nova = outros.slice(); nova.splice(alvo, 0, arrastando);
    if (nova.join() !== ordem.join()) setOrdem(nova);
  }

  return (
    <div ref={gradeRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, touchAction: arrastando != null ? "none" : "auto" }}>
      {ordenados.map((e) => {
        const largo = largoDe(e); const naMao = arrastando === e.dbId;
        return (
          <React.Fragment key={e.dbId}>
            {naMao && <div style={{ gridColumn: largo ? "1 / -1" : "auto", height: pega.current?.h || 90, borderRadius: 16, border: `2px dashed ${C.cinzaClaro}`, background: "#00000008" }} />}
            <div
              ref={(el) => { itemRefs.current[e.dbId] = el; }}
              className={editando && !naMao ? "ah-jiggle" : ""}
              onPointerDown={(ev) => aoPressionar(ev, e.dbId)}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              onContextMenu={(ev) => { ev.preventDefault(); if (!onSegurar) pegar(); }}
              onClickCapture={(ev) => { if (longPressed.current || arrastou.current) { ev.stopPropagation(); ev.preventDefault(); } }}
              style={{
                userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
                ...(naMao && pega.current && pos
                  ? { position: "fixed", left: pos.x - pega.current.offX, top: pos.y - pega.current.offY, width: pega.current.w, height: pega.current.h, zIndex: 999, transform: "scale(1.04)", boxShadow: "0 22px 44px -16px rgba(0,0,0,0.5)", minWidth: 0 }
                  : { gridColumn: largo ? "1 / -1" : "auto", minWidth: 0, position: "relative" }),
              }}
            >
              {editando && !naMao && (
                <button onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); onTamanho?.(e.dbId, e.tamanho === "g" ? "p" : "g"); }} title={e.tamanho === "g" ? "Deixar pequeno" : "Deixar grande"} style={{ position: "absolute", top: -7, right: -7, zIndex: 6, width: 30, height: 30, borderRadius: 999, background: LAGO, color: "#fff", border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1 }}>{e.tamanho === "g" ? "⤡" : "⤢"}</button>
              )}
              <div style={{ pointerEvents: editando ? "none" : "auto", height: "100%" }}>
                <EquipCard e={e} enviar={enviar} expandido={expandidos.has(e.dbId)} onExpandir={() => toggleExpand(e.dbId)} editando={editando} />
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ---- Painel pessoal do Controle ----
   Quem tem a chave "Pode montar o próprio painel" (e o gestor) cria painéis com nome, guardados SÓ
   neste celular. No painel pessoal, segurar um nível, cômodo ou aparelho abre as opções: ocultar
   (mostrando ou não o que tem dentro) e mudar o aparelho de cômodo. O "Padrão" é o que o gestor
   monta para todos: não dá para apagar, e voltar para ele desfaz tudo na hora. */
function PaineisSheet({ paineis, ativo, ocultos, onEscolher, onCriar, onRenomear, onExcluir, onMostrar, onFechar }) {
  const linha = (id, nome, apagavel) => {
    const sel = ativo === id;
    return (
      <div key={id} className="flex items-center gap-2" style={{ background: sel ? C.pastoClaro : C.card, border: `1px solid ${sel ? C.pasto : C.linha}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
        <button onClick={() => onEscolher(id)} className="flex items-center gap-2 flex-1 min-w-0" style={{ textAlign: "left" }}>
          {sel ? <CheckCircle2 size={18} style={{ color: C.pasto, flexShrink: 0 }} /> : <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${C.cinzaClaro}`, flexShrink: 0 }} />}
          <span className="truncate" style={{ fontWeight: 700, color: C.terra }}>{nome}</span>
          {!apagavel && <span style={{ fontSize: 11.5, color: C.cinzaClaro, fontWeight: 600, flexShrink: 0 }}>· de todos</span>}
        </button>
        {apagavel && <button onClick={() => onRenomear(id)} title="Renomear" style={{ color: C.cinza, padding: 4 }}><Pencil size={16} /></button>}
        {apagavel && <button onClick={() => onExcluir(id)} title="Excluir" style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>}
      </div>
    );
  };
  return (
    <Sheet titulo="Dashboard" onFechar={onFechar}>
      {linha("padrao", "Padrão", false)}
      {paineis.map((x) => linha(x.id, x.nome, true))}
      <button onClick={onCriar} className="flex items-center justify-center gap-2" style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 13, fontWeight: 700, marginTop: 4 }}><Plus size={18} /> Novo painel</button>
      {ativo !== "padrao" && ocultos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.cinza, textTransform: "uppercase", marginBottom: 6 }}>Escondido neste painel</div>
          {ocultos.map((o) => (
            <div key={o.chave} className="flex items-center gap-2" style={{ borderTop: `1px solid ${C.linha}`, padding: "8px 0" }}>
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14, color: C.terra }}>{o.rotulo}</span>
              <button onClick={() => onMostrar(o)} style={{ flexShrink: 0, background: C.pastoClaro, color: C.pastoEsc, borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700 }}>{o.desfazer || "Mostrar"}</button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
function MenuPainelSheet({ alvo, comodos, onAcao, onFechar }) {
  const [mover, setMover] = useState(false);
  const bt = (txt, Ic, fn, perigo) => (
    <button onClick={fn} className="flex items-center gap-3" style={{ width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, fontWeight: 700, color: perigo ? C.vermelho : C.terra }}>
      <Ic size={18} style={{ flexShrink: 0, color: perigo ? C.vermelho : C.cinza }} /> {txt}
    </button>
  );
  return (
    <Sheet titulo={alvo.nome} onFechar={onFechar}>
      {alvo.tipo === "pav" && (<>
        {bt("Esconder o nível e mostrar os cômodos", EyeOff, () => onAcao("expor"))}
        {bt("Esconder o nível e tudo o que tem nele", EyeOff, () => onAcao("tudo"), true)}
      </>)}
      {alvo.tipo === "amb" && (<>
        {bt("Esconder o cômodo e mostrar os aparelhos", EyeOff, () => onAcao("expor"))}
        {bt("Esconder o cômodo e os aparelhos", EyeOff, () => onAcao("tudo"), true)}
      </>)}
      {alvo.tipo === "eq" && !mover && (<>
        {bt("Mudar de cômodo", ArrowLeftRight, () => setMover(true))}
        {bt("Esconder este aparelho", EyeOff, () => onAcao("ocultar"), true)}
      </>)}
      {alvo.tipo === "eq" && mover && comodos.map((c) => (
        <button key={c.id} onClick={() => onAcao("mover", c.id)} disabled={c.id === alvo.ambId} className="flex items-center gap-2"
          style={{ width: "100%", textAlign: "left", background: c.id === alvo.ambId ? C.pastoClaro : C.card, border: `1px solid ${C.linha}`, borderRadius: 12, padding: "11px 14px", marginBottom: 6 }}>
          <span className="flex-1 truncate" style={{ fontWeight: 700, color: C.terra }}>{c.nome}</span>
          <span style={{ fontSize: 12, color: C.cinzaClaro, flexShrink: 0 }}>{c.id === alvo.ambId ? "aqui agora" : c.pavNome}</span>
        </button>
      ))}
    </Sheet>
  );
}

function ControleApp({ eu, onVoltar, onSair, onEquipe, onSobre }) {
  const [status, setStatus] = useState("carregando"); // carregando | ok | erro
  const [erro, setErro] = useState("");
  // Cards ampliados (ar/persiana). Começa vazio → ao abrir/recarregar o app, todos encolhidos.
  const [expandidos, setExpandidos] = useState(() => new Set());
  const toggleExpand = (id) => setExpandidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [editando, setEditando] = useState(false);
  const [ents, setEnts] = useState({});
  const [otim, setOtim] = useState({}); // entity_id -> { patch, base (assinatura antes do toque), ate }
  const [areas, setAreas] = useState(null); // entity_id -> nome da área no Home Assistant
  const [tentativa, setTentativa] = useState(0);
  const [aviso, setAviso] = useState(null);
  // Erro some sozinho depois de 6 s (os avisos comuns já somem em 2 s).
  useEffect(() => { if (!aviso?.erro) return; const t = setTimeout(() => setAviso((a) => (a === aviso ? null : a)), 6000); return () => clearTimeout(t); }, [aviso]);
  const [avisoBateria, setAvisoBateria] = useState(null); // % da bateria da porta, quando baixa
  const [pavimentos, setPavimentos] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [sessoes, setSessoes] = useState({}); // id do cartão de som/TV -> { dono, dono_nome, participantes }
  const [usoAtivo, setUsoAtivo] = useState(false); // a tabela controle_uso existe (SQL rodado)
  const [dividir, setDividir] = useState(null); // cartão em que a pessoa tocou para dividir
  const [modo, setModo] = useState("usar"); // usar | gerenciar
  const [menuAberto, setMenuAberto] = useState(false);
  const [portaoAberto, setPortaoAberto] = useState(false);
  const [portaAberta, setPortaAberta] = useState(false); // popup da Porta Entrada
  const [tvAberta, setTvAberta] = useState(null); // TV com o controle remoto aberto
  const [alarmeAberto, setAlarmeAberto] = useState(false);
  const cabRef = useRef(null), [topoPortao, setTopoPortao] = useState(null);
  const gruposRef = useRef({}); // id do cartão de grupo -> ids reais dos aparelhos dentro dele
  const [tema, setTema] = useState(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  // O que está aberto: pavimentos abertos + UM cômodo por vez. Começa tudo fechado e
  // volta a fechar depois de 8h sem uso (guardado no aparelho para valer entre aberturas).
  const [abertos, setAbertos] = useState(() => {
    try {
      const uso = Number(localStorage.getItem("controleUso")) || 0;
      const s = JSON.parse(localStorage.getItem("controleAbertos") || "null");
      if (s && Date.now() - uso < ABERTOS_TTL) return { pavs: s.pavs || [], amb: s.amb || null };
    } catch { /* sem storage */ }
    return { pavs: [], amb: null };
  });
  const usoRef = useRef(Date.now());
  const wsRef = useRef(null);
  const pedidosRef = useRef({}); // id -> resolve (pedidos que esperam resposta do HA)
  const comandosRef = useRef({}); // id do comando -> entity_id (para desfazer a previsão se o HA recusar)
  const baseUrlRef = useRef(""); // endereço do HA (para as capas: /api/media_player_proxy/...)
  const idRef = useRef(1);
  // Família (administrador com controle) fala direto com o Home Assistant: rápido e ao vivo.
  // Os demais (colaborador, criança, visitante) passam pelo intermediário "controle-proxy",
  // que guarda o token no servidor e só libera os aparelhos cadastrados.
  const [usarProxy, setUsarProxy] = useState(() => !(eu?.papel === "admin" && (eu?.podeControle || eu?.podeGerirControle)));
  const proxyRefresh = useRef(null);
  const souGestor = eu?.podeGerirControle === true;
  const pavAberto = (id) => abertos.pavs.includes(id);
  // Painéis pessoais (deste celular, desta pessoa).
  const podePessoal = eu?.podePersonalizar === true || eu?.podeGerirControle === true;
  const chavePaineis = "paineis:" + (eu?.id || "");
  const [paineis, setPaineisSt] = useState(() => { try { return JSON.parse(localStorage.getItem(chavePaineis) || "null") || { ativo: "padrao", lista: [] }; } catch { return { ativo: "padrao", lista: [] }; } });
  const setPaineis = (fn) => setPaineisSt((p0) => { const n = fn(p0); try { localStorage.setItem(chavePaineis, JSON.stringify(n)); } catch { /* ok */ } return n; });
  const painel = podePessoal ? paineis.lista.find((x) => x.id === paineis.ativo) || null : null;
  const cfgP = painel?.cfg || {};
  const mudarCfg = (fn) => setPaineis((p0) => ({ ...p0, lista: p0.lista.map((x) => (x.id === p0.ativo ? { ...x, cfg: fn({ ocultoPav: {}, ocultoAmb: {}, ocultoEq: {}, mover: {}, ...(x.cfg || {}) }) } : x)) }));
  const [paineisAberto, setPaineisAberto] = useState(false);
  const [menuPainel, setMenuPainel] = useState(null); // { tipo: "pav"|"amb"|"eq", id, nome, ambId?, dbIds? }
  // No Padrão o gestor continua arrastando para todos; no painel pessoal (ou quem não é gestor), segurar abre as opções.
  const usarPessoal = podePessoal && (!!painel || eu?.podeGerirControle !== true);
  const criarPainel = async () => {
    const nome = await Dialog.prompt({ titulo: "Novo painel", mensagem: "Dê um nome ao seu painel (fica só neste celular).", valor: "Meu painel", okLabel: "Criar" });
    if (!nome || !nome.trim()) return false;
    const id = "p" + Date.now();
    setPaineis((p0) => ({ ativo: id, lista: [...p0.lista, { id, nome: nome.trim(), cfg: {} }] }));
    return true;
  };
  const segurarPainel = async (alvo) => {
    try { navigator.vibrate?.(15); } catch { /* ok */ }
    if (!painel && !(await criarPainel())) return;
    setMenuPainel(alvo);
  };
  const acaoPainel = (acao, extra) => {
    const a = menuPainel; setMenuPainel(null); if (!a) return;
    mudarCfg((c) => {
      if (a.tipo === "pav") return { ...c, ocultoPav: { ...c.ocultoPav, [a.id]: acao } };
      if (a.tipo === "amb") return { ...c, ocultoAmb: { ...c.ocultoAmb, [a.id]: acao } };
      const ids = a.dbIds;
      if (acao === "ocultar") return { ...c, ocultoEq: { ...c.ocultoEq, ...Object.fromEntries(ids.map((i) => [i, true])) } };
      const mover = { ...c.mover };
      ids.forEach((i) => { const orig = equipamentos.find((q) => q.id === i)?.ambiente_id; if (extra === orig) delete mover[i]; else mover[i] = extra; });
      return { ...c, mover };
    });
  };
  // Toque longo nos títulos (nível/cômodo) no modo pessoal.
  const menuPress = useRef(null), menuLongo = useRef(false);
  const pressMenu = (ev, alvo) => {
    menuLongo.current = false;
    const x = ev.clientX, y = ev.clientY;
    const t = setTimeout(() => { menuLongo.current = true; menuPress.current = null; segurarPainel(alvo); }, 500);
    menuPress.current = { t, x, y };
  };
  const moverMenu = (ev) => { const m = menuPress.current; if (m && Math.hypot(ev.clientX - m.x, ev.clientY - m.y) > 10) { clearTimeout(m.t); menuPress.current = null; } };
  const soltarMenu = () => { const m = menuPress.current; if (m) clearTimeout(m.t); menuPress.current = null; setTimeout(() => { menuLongo.current = false; }, 0); };
  // Fechar o pavimento fecha também o cômodo aberto dentro dele.
  // Um pavimento aberto por vez: abrir um recolhe os outros (e o cômodo que estava aberto neles).
  const alternarPav = (id, comodoIds) => setAbertos((a) => a.pavs.includes(id)
    ? { pavs: a.pavs.filter((x) => x !== id), amb: comodoIds.includes(a.amb) ? null : a.amb }
    : { pavs: [id], amb: comodoIds.includes(a.amb) ? a.amb : null });
  // Abrir um cômodo fecha o anterior e deixa aberto só o pavimento dele.
  const alternarAmb = (id, pavId) => setAbertos((a) => {
    if (a.amb === id) return { ...a, amb: null };
    rolarPara.current = id;
    return { pavs: [pavId], amb: id };
  });
  // Ao abrir um cômodo, a tela rola até o título dele ficar logo abaixo do cabeçalho verde (fixo).
  const rolarPara = useRef(null);
  useEffect(() => {
    const id = rolarPara.current; rolarPara.current = null;
    if (!id || abertos.amb !== id) return;
    // Espera o cômodo anterior fechar (as posições mudam) antes de medir.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector(`[data-comodo="${id}"]`); if (!el) return;
      const topoCab = cabRef.current ? cabRef.current.getBoundingClientRect().bottom : 0;
      window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - topoCab - 8), behavior: "smooth" });
    }));
  }, [abertos.amb]);

  useEffect(() => { try { localStorage.setItem("controleAbertos", JSON.stringify(abertos)); } catch { /* ok */ } }, [abertos]);
  // Marca o uso (toque na tela) e fecha tudo se passar 8h parado — aberto na tela ou não.
  useEffect(() => {
    const gravar = () => { try { localStorage.setItem("controleUso", String(usoRef.current)); } catch { /* ok */ } };
    let ultimaGravacao = 0;
    const usou = () => { usoRef.current = Date.now(); if (usoRef.current - ultimaGravacao > 60000) { ultimaGravacao = usoRef.current; gravar(); } };
    const conferir = () => { if (Date.now() - usoRef.current >= ABERTOS_TTL) { setAbertos({ pavs: [], amb: null }); usoRef.current = Date.now(); gravar(); } };
    const aoMudarVisib = () => { if (document.visibilityState === "hidden") gravar(); else conferir(); };
    gravar();
    document.addEventListener("pointerdown", usou, true);
    document.addEventListener("visibilitychange", aoMudarVisib);
    const t = setInterval(conferir, 5 * 60000);
    return () => { document.removeEventListener("pointerdown", usou, true); document.removeEventListener("visibilitychange", aoMudarVisib); clearInterval(t); gravar(); };
  }, []);

  // ---- Carrega pavimentos/ambientes/equipamentos do Supabase (+ tempo real) ----
  const carregarConfig = useCallback(async () => {
    const [p, a, e] = await Promise.all([
      supabase.from("pavimentos").select("*").order("ordem"),
      supabase.from("ambientes").select("*").order("ordem"),
      supabase.from("controle_equipamentos").select("*").order("ordem"),
    ]);
    // Quem está usando cada som/TV (tabela controle_uso; sem ela, tudo segue como antes).
    const u = await supabase.from("controle_uso").select("*");
    if (!u.error) { setSessoes(Object.fromEntries((u.data || []).map((r) => [r.chave, r]))); setUsoAtivo(true); }
    if (!p.error) setPavimentos(p.data || []);
    if (!a.error) setAmbientes(a.data || []);
    if (!e.error) setEquipamentos(e.data || []);
  }, []);

  useEffect(() => {
    carregarConfig();
    const canal = supabase.channel("controle-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "pavimentos" }, carregarConfig)
      .on("postgres_changes", { event: "*", schema: "public", table: "ambientes" }, carregarConfig)
      .on("postgres_changes", { event: "*", schema: "public", table: "controle_equipamentos" }, carregarConfig)
      .on("postgres_changes", { event: "*", schema: "public", table: "controle_uso" }, carregarConfig)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregarConfig]);

  // ---- Conexão ao vivo com o Home Assistant (WebSocket) ----
  useEffect(() => {
    let ativo = true, conectou = false, ws;
    setStatus((s) => (s === "ok" ? "ok" : "carregando")); setErro(""); // reconexão mantém a tela
    if (usarProxy) {
      // Modo intermediário: pergunta os estados a cada 3 s (só com o app na tela).
      let timer = null, renovou = false;
      const buscar = async () => {
        const { data, error } = await supabase.functions.invoke(PROXY_FN, { body: { acao: "estados" } });
        if (!ativo) return;
        if (error) {
          const st = error?.context?.status;
          if (st === 404) { setUsarProxy(false); return; } // intermediário ainda não publicado: conexão direta
          // Login vencido: renova uma vez e tenta de novo antes de mostrar erro.
          if (st === 401 && !renovou) {
            renovou = true;
            const { error: eR } = await supabase.auth.refreshSession();
            if (!ativo) return;
            if (!eR) return buscar();
            console.warn("controle-proxy: não renovou a sessão", eR);
            setErro("O acesso deste aparelho foi encerrado. Saia e entre de novo (visitante: leia o QR Code de novo)."); setStatus("erro"); return;
          }
          let msg = ""; try { msg = (await error.context.json())?.error || ""; } catch { /* sem corpo */ }
          setErro(msg || "Não consegui falar com o controle da casa."); setStatus("erro"); return;
        }
        renovou = false;
        const map = {};
        (data?.estados || []).forEach((s) => { if (acompanhar(s.entity_id, s.attributes)) map[s.entity_id] = { state: s.state, attributes: s.attributes || {} }; });
        setEnts(map); setStatus("ok"); setErro("");
      };
      const ciclo = async () => { if (!ativo) return; if (document.visibilityState === "visible") await buscar(); if (ativo) timer = setTimeout(ciclo, 3000); };
      proxyRefresh.current = buscar;
      ciclo();
      return () => { ativo = false; clearTimeout(timer); proxyRefresh.current = null; };
    }
    const pend = {}; // id da requisição -> tipo (para saber qual resposta é qual)
    const reg = { areas: null, devices: null, entities: null };
    // Monta o mapa entity_id -> nome da área (ambiente do HA), via os "registries".
    const montarAreas = () => {
      if (!reg.areas || !reg.entities) return;
      const areaNome = {}; reg.areas.forEach((a) => { areaNome[a.area_id] = a.name; });
      const devArea = {}; (reg.devices || []).forEach((d) => { if (d.area_id) devArea[d.id] = d.area_id; });
      const map = {};
      reg.entities.forEach((en) => { const aid = en.area_id || (en.device_id ? devArea[en.device_id] : null); if (aid && areaNome[aid]) map[en.entity_id] = areaNome[aid]; });
      if (ativo) setAreas(map);
    };
    (async () => {
      const { data, error } = await supabase.from("ha_config").select("base_url, token").eq("id", "default").maybeSingle();
      if (!ativo) return;
      if (error) { setErro("Não consegui ler a configuração: " + error.message); setStatus("erro"); return; }
      if (!data?.base_url || !data?.token) { setErro("Falta o endereço ou o token do Home Assistant no Supabase."); setStatus("erro"); return; }
      const wsUrl = data.base_url.replace(/^http/, "ws").replace(/\/+$/, "") + "/api/websocket";
      baseUrlRef.current = data.base_url.replace(/\/+$/, "");
      try { ws = new WebSocket(wsUrl); } catch (e) { setErro("Não consegui abrir a conexão: " + (e?.message || e)); setStatus("erro"); return; }
      wsRef.current = ws;
      const send = (o) => { const id = idRef.current++; const tipo = o.tipo; delete o.tipo; if (tipo) pend[id] = tipo; ws.send(JSON.stringify({ id, ...o })); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === "auth_required") return ws.send(JSON.stringify({ type: "auth", access_token: data.token }));
        if (m.type === "auth_invalid") { setErro("O token foi recusado pelo Home Assistant. Gere um novo e atualize no Supabase."); setStatus("erro"); try { ws.close(); } catch { /* ok */ } return; }
        if (m.type === "auth_ok") {
          conectou = true;
          send({ tipo: "states", type: "get_states" });
          send({ tipo: "areas", type: "config/area_registry/list" });
          send({ tipo: "devices", type: "config/device_registry/list" });
          send({ tipo: "entities", type: "config/entity_registry/list" });
          send({ type: "subscribe_events", event_type: "state_changed" });
          return;
        }
        if (m.type === "result") {
          if (pedidosRef.current[m.id]) { const resp = pedidosRef.current[m.id]; delete pedidosRef.current[m.id]; resp(m); return; }
          const tipo = pend[m.id]; delete pend[m.id];
          const alvoCmd = comandosRef.current[m.id]; delete comandosRef.current[m.id];
          if (m.success === false) {
            if (tipo === "states") { setErro("Falha ao ler estados: " + (m.error?.message || "")); setStatus("erro"); }
            else if (ativo && !["areas", "devices", "entities"].includes(tipo)) {
              // Comando recusado: o cartão volta na hora ao estado real (sem a previsão do toque).
              if (alvoCmd) setOtim((o) => { const n = { ...o }; delete n[alvoCmd]; return n; });
              setAviso({ erro: true, texto: "Não consegui executar: " + (m.error?.message || "erro do Home Assistant") });
            }
            return;
          }
          if (tipo === "states") {
            const map = {};
            (m.result || []).forEach((s) => { if (acompanhar(s.entity_id, s.attributes)) map[s.entity_id] = { state: s.state, attributes: s.attributes || {} }; });
            if (ativo) { setEnts(map); setStatus("ok"); }
            return;
          }
          if (tipo === "areas") { reg.areas = m.result || []; montarAreas(); return; }
          if (tipo === "devices") { reg.devices = m.result || []; montarAreas(); return; }
          if (tipo === "entities") { reg.entities = m.result || []; montarAreas(); return; }
          return;
        }
        if (m.type === "event" && m.event?.event_type === "state_changed") {
          const d = m.event.data;
          const dom = d?.entity_id ? d.entity_id.split(".")[0] : "";
          if (d?.entity_id && d.new_state && acompanhar(d.entity_id, d.new_state.attributes)) setEnts((p) => ({ ...p, [d.entity_id]: { state: d.new_state.state, attributes: d.new_state.attributes || {} } }));
        }
      };
      ws.onerror = () => { if (ativo && !conectou) { setErro("Não consegui conectar. Confira se a Nabu Casa está ligada e o token está certo."); setStatus("erro"); } };
      // Caiu (celular dormiu, trocou de rede...): reconecta sozinho.
      ws.onclose = () => { if (ativo && conectou) setTimeout(() => { if (ativo) setTentativa((t) => t + 1); }, 1500); };
    })();
    return () => { ativo = false; try { ws && ws.close(); } catch { /* ok */ } };
  }, [tentativa, usarProxy]);

  // Ao voltar para o app: atualiza na hora (intermediário) ou reconecta se a conexão caiu (direto).
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (usarProxy) proxyRefresh.current?.();
      else if (!wsRef.current || wsRef.current.readyState > 1) setTentativa((t) => t + 1);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [usarProxy]);

  // ---- Segurar e arrastar PAVIMENTOS para mudar a ordem (só gestor) ----
  // Segura ~0,5 s (até vibrar) no título do pavimento → ele flutua seguindo o dedo; os outros
  // abrem vaga. Enquanto arrasta, todos ficam recolhidos (só os títulos) para caber na tela.
  const [arrPav, setArrPav] = useState(null); // { id, ordem, y, offY, left, w, h }
  const pavPress = useRef(null), pavTimer = useRef(null), pavLongo = useRef(false), pavRefs = useRef({});
  const pegarPav = () => {
    const p = pavPress.current; if (!p || arrPav) return;
    pavPress.current = null; clearTimeout(pavTimer.current); pavLongo.current = true;
    const r = p.el.getBoundingClientRect(); // título
    const cx = pavRefs.current[p.id]?.getBoundingClientRect() || r; // caixa do pavimento
    try { p.el.setPointerCapture?.(p.pid); } catch { /* ok */ }
    setArrPav({ id: p.id, ordem: pavimentos.map((x) => x.id), y: p.y, offY: p.y - cx.top, left: cx.left, w: cx.width, h: r.height + 14 });
  };
  const aoPressionarPav = (e, id) => {
    if (!souGestor || id === "__sem__" || arrPav) return;
    pavLongo.current = false;
    pavPress.current = { id, pid: e.pointerId, el: e.currentTarget, x: e.clientX, y: e.clientY };
    clearTimeout(pavTimer.current); pavTimer.current = setTimeout(pegarPav, 500);
  };
  const aoMoverPav = (e) => {
    if (!arrPav) {
      const p = pavPress.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { clearTimeout(pavTimer.current); pavPress.current = null; } // era rolagem
      return;
    }
    const y = e.clientY;
    setArrPav((a) => {
      if (!a) return a;
      const outros = a.ordem.filter((id) => id !== a.id);
      let alvo = 0;
      for (const id of outros) { const el = pavRefs.current[id]; if (el) { const r = el.getBoundingClientRect(); if (y > r.top + r.height / 2) alvo++; } }
      const nova = outros.slice(); nova.splice(alvo, 0, a.id);
      return { ...a, y, ordem: nova.join() === a.ordem.join() ? a.ordem : nova };
    });
  };
  const aoSoltarPav = async () => {
    clearTimeout(pavTimer.current); pavPress.current = null;
    const a = arrPav; if (!a) return;
    setArrPav(null);
    setTimeout(() => { pavLongo.current = false; }, 0);
    if (a.ordem.join() === pavimentos.map((x) => x.id).join()) return;
    setPavimentos((lista) => a.ordem.map((id, i) => ({ ...lista.find((x) => x.id === id), ordem: i })).filter((x) => x.id)); // já mostra na nova ordem
    const res = await Promise.all(a.ordem.map((id, i) => supabase.from("pavimentos").update({ ordem: i }).eq("id", id)));
    if (res.some((r) => r.error)) setAviso({ erro: true, texto: "Não consegui salvar a nova ordem dos pavimentos." });
    carregarConfig();
  };
  useEffect(() => () => clearTimeout(pavTimer.current), []);
  // Enquanto arrasta, a tela não rola junto com o dedo.
  useEffect(() => {
    if (!arrPav) return;
    const barrar = (ev) => ev.preventDefault();
    document.addEventListener("touchmove", barrar, { passive: false });
    return () => document.removeEventListener("touchmove", barrar);
  }, [!!arrPav]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Segurar e arrastar CÔMODOS dentro do pavimento (só gestor) ----
  // Mesmo jeito dos pavimentos: segura ~0,5 s no título do cômodo, ele flutua e os outros abrem vaga.
  // Enquanto arrasta, os cômodos ficam recolhidos (só os títulos).
  const [arrAmb, setArrAmb] = useState(null); // { id, pavId, ordem, y, offY, left, w, h }
  const ambPress = useRef(null), ambTimer = useRef(null), ambLongo = useRef(false), ambRefs = useRef({});
  const pegarAmb = () => {
    const p = ambPress.current; if (!p || arrAmb) return;
    ambPress.current = null; clearTimeout(ambTimer.current); ambLongo.current = true;
    const r = ambRefs.current[p.id]?.getBoundingClientRect() || p.el.getBoundingClientRect(); // caixa do cômodo
    try { p.el.setPointerCapture?.(p.pid); } catch { /* ok */ }
    setArrAmb({ id: p.id, pavId: p.pavId, ordem: p.ordem, y: p.y, offY: p.y - r.top, left: r.left, w: r.width, h: r.height });
  };
  const aoPressionarAmb = (e, id, pavId, ordem) => {
    if (!souGestor || arrAmb || arrPav) return;
    e.stopPropagation(); // não deixa o pavimento "pegar" junto
    ambLongo.current = false;
    ambPress.current = { id, pavId, ordem, pid: e.pointerId, el: e.currentTarget, x: e.clientX, y: e.clientY };
    clearTimeout(ambTimer.current); ambTimer.current = setTimeout(pegarAmb, 500);
  };
  const aoMoverAmb = (e) => {
    if (!arrAmb) {
      const p = ambPress.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { clearTimeout(ambTimer.current); ambPress.current = null; } // era rolagem
      return;
    }
    const y = e.clientY;
    setArrAmb((a) => {
      if (!a) return a;
      const outros = a.ordem.filter((id) => id !== a.id);
      let alvo = 0;
      for (const id of outros) { const el = ambRefs.current[id]; if (el) { const r = el.getBoundingClientRect(); if (y > r.top + r.height / 2) alvo++; } }
      const nova = outros.slice(); nova.splice(alvo, 0, a.id);
      return { ...a, y, ordem: nova.join() === a.ordem.join() ? a.ordem : nova };
    });
  };
  const aoSoltarAmb = async () => {
    clearTimeout(ambTimer.current); ambPress.current = null;
    const a = arrAmb; if (!a) return;
    setArrAmb(null);
    setTimeout(() => { ambLongo.current = false; }, 0);
    const antes = ambientes.filter((x) => x.pavimento_id === (a.pavId === "__sem__" ? null : a.pavId)).sort((x, y) => x.ordem - y.ordem).map((x) => x.id);
    if (a.ordem.join() === antes.join()) return;
    setAmbientes((lista) => lista.map((x) => (a.ordem.includes(x.id) ? { ...x, ordem: a.ordem.indexOf(x.id) } : x))); // já mostra na nova ordem
    const res = await Promise.all(a.ordem.map((id, i) => supabase.from("ambientes").update({ ordem: i }).eq("id", id)));
    if (res.some((r) => r.error)) setAviso({ erro: true, texto: "Não consegui salvar a nova ordem dos cômodos." });
    carregarConfig();
  };
  useEffect(() => () => clearTimeout(ambTimer.current), []);
  useEffect(() => {
    if (!arrAmb) return;
    const barrar = (ev) => ev.preventDefault();
    document.addEventListener("touchmove", barrar, { passive: false });
    return () => document.removeEventListener("touchmove", barrar);
  }, [!!arrAmb]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Desligar tudo de um pavimento/cômodo: um aparelho por vez, 600 ms entre cada ----
  const desligarTudo = async (itens, nivel) => {
    const alvo = achatar(itens).filter((e) => ehDesligavel(e) && estaLigado(e) && !e.alheio); // som/TV de outra pessoa fica
    if (!alvo.length) return;
    const ok = await Dialog.confirm({ titulo: "Desligar tudo", mensagem: `Tem certeza que quer desligar tudo em ${nivel}? (${alvo.length} ${alvo.length === 1 ? "aparelho ligado" : "aparelhos ligados"})`, okLabel: "Desligar tudo", perigo: true });
    if (!ok) return;
    for (let i = 0; i < alvo.length; i++) {
      if (alvo[i].tipo === "alexa") ligarAlexa(alvo[i], false, enviar);
      else if (alvo[i].zonasComodo || alvo[i].receiver) acionarZonas(alvo[i], false, enviar);
      else if (alvo[i].tipo === "ar") desligarAr(alvo[i], enviar);
      else { const [dom, serv] = servicoDesligar(alvo[i]); enviar(dom, serv, alvo[i].id); }
      if (i < alvo.length - 1) await new Promise((r) => setTimeout(r, 600));
    }
  };

  // Estado mostrado = real + o que o toque prevê, enquanto o HA não informar mudança.
  const entsVis = React.useMemo(() => {
    const ids = Object.keys(otim); if (!ids.length) return ents;
    const agora = Date.now(); const out = { ...ents };
    ids.forEach((id) => {
      const o = otim[id], v = ents[id];
      if (!v || agora > o.ate || assinatura(v) !== o.base) return;
      out[id] = { ...v, ...(o.patch.state != null ? { state: o.patch.state } : {}), attributes: { ...v.attributes, ...(o.patch.attributes || {}) } };
    });
    return out;
  }, [ents, otim]);
  // Limpa previsões vencidas ou já confirmadas/substituídas pelo HA.
  useEffect(() => {
    const ids = Object.keys(otim); if (!ids.length) return;
    const agora = Date.now();
    const vivos = ids.filter((id) => ents[id] && agora <= otim[id].ate && assinatura(ents[id]) === otim[id].base);
    if (vivos.length !== ids.length) { setOtim((o) => Object.fromEntries(Object.entries(o).filter(([id]) => vivos.includes(id)))); return; }
    const prox = Math.min(...vivos.map((id) => otim[id].ate)) - agora;
    const t = setTimeout(() => setOtim((o) => ({ ...o })), Math.max(50, prox + 10));
    return () => clearTimeout(t);
  }, [ents, otim]);
  const preverToque = (service, entityId, data) => {
    const v = entsVis[entityId]; const patch = previsto(service, v, data || {});
    if (!patch || !ents[entityId]) return;
    // Encadeia toques rápidos (ex.: Vol + várias vezes) sobre a última previsão.
    const atual = otim[entityId];
    const base = atual && assinatura(ents[entityId]) === atual.base ? atual.base : assinatura(ents[entityId]);
    const junto = atual && base === atual.base
      ? { state: patch.state ?? atual.patch.state, attributes: { ...(atual.patch.attributes || {}), ...(patch.attributes || {}) } }
      : patch;
    setOtim((o) => ({ ...o, [entityId]: { patch: junto, base, ate: Date.now() + OTIMISTA_MS } }));
  };

  // As persianas 1–11 nem sempre avisam o HA quando a Persiana 0 move todas: o app mostra
  // "abrindo/fechando" e, depois de ~25 s, "aberta/fechada", e guarda isso por até 10 min
  // (ou até o HA informar outro estado para aquela persiana).
  const preverEstados = (lista) => {
    const agora = Date.now();
    setOtim((o) => {
      const n = { ...o };
      lista.forEach(([id, mov]) => { if (ents[id]) n[id] = { patch: { state: mov }, base: assinatura(ents[id]), ate: agora + 25000 }; });
      return n;
    });
    setTimeout(() => setOtim((o) => {
      const n = { ...o };
      lista.forEach(([id, , fim]) => { if (ents[id] && n[id] && n[id].patch.state !== fim) n[id] = { patch: { state: fim }, base: n[id].base, ate: Date.now() + 10 * 60000 }; });
      return n;
    }), 25000);
  };

  // ---- Envia um comando ao Home Assistant ----
  const enviar = (domain, service, entityId, serviceData) => {
    preverToque(service, entityId, serviceData);
    if (usarProxy) {
      setAviso({ texto: "Comando enviado…" });
      supabase.functions.invoke(PROXY_FN, { body: { acao: "servico", domain, service, entity_id: entityId, data: serviceData || {} } }).then(async ({ error }) => {
        if (error) {
          setOtim((o) => { const n = { ...o }; delete n[entityId]; return n; }); // não deu: volta a mostrar o estado real
          let msg = ""; try { msg = (await error.context.json())?.error || ""; } catch { /* sem corpo */ } setAviso({ erro: true, texto: "Não consegui executar: " + (msg || error.message) }); return;
        }
        setTimeout(() => proxyRefresh.current?.(), 400);  // mostra o novo estado logo
        setTimeout(() => proxyRefresh.current?.(), 1800); // e de novo (persiana e ar demoram)
      });
      setTimeout(() => setAviso((a) => (a && !a.erro ? null : a)), 2000);
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      setOtim((o) => { const n = { ...o }; delete n[entityId]; return n; }); // não foi: mostra o estado real
      setAviso({ erro: true, texto: "A conexão com a casa caiu. Reconectando… toque de novo em alguns segundos." });
      if (!ws || ws.readyState > 1) setTentativa((t) => t + 1);
      return;
    }
    const idCmd = idRef.current++;
    comandosRef.current[idCmd] = entityId;
    ws.send(JSON.stringify({ id: idCmd, type: "call_service", domain, service, target: { entity_id: entityId }, service_data: serviceData || {} }));
    setAviso({ texto: "Comando enviado…" });
    setTimeout(() => setAviso((a) => (a && !a.erro ? null : a)), 2000);
  };

  // ---- Grava configuração (só gestor; o banco também exige a permissão) ----
  const salvar = async (p, okTxt) => {
    const { error } = await p;
    if (error) { setAviso({ erro: true, texto: "Não consegui salvar: " + error.message }); return; }
    await carregarConfig();
    if (okTxt) { setAviso({ texto: okTxt }); setTimeout(() => setAviso((a) => (a && !a.erro ? null : a)), 2200); }
  };
  const cbs = {
    onCriarPav: (nome) => salvar(supabase.from("pavimentos").insert({ nome, ordem: pavimentos.length }), "Pavimento criado"),
    onRenomearPav: (id, nome) => salvar(supabase.from("pavimentos").update({ nome }).eq("id", id)),
    onExcluirPav: (id) => salvar(supabase.from("pavimentos").delete().eq("id", id), "Pavimento excluído"),
    onCriarAmb: (pavimentoId, nome) => salvar(supabase.from("ambientes").insert({ nome, pavimento_id: pavimentoId, ordem: ambientes.filter((a) => a.pavimento_id === pavimentoId).length }), "Cômodo criado"),
    onRenomearAmb: (id, nome) => salvar(supabase.from("ambientes").update({ nome }).eq("id", id)),
    onExcluirAmb: (id) => salvar(supabase.from("ambientes").delete().eq("id", id), "Cômodo excluído"),
    onMoverAmb: (id, pavimentoId) => salvar(supabase.from("ambientes").update({ pavimento_id: pavimentoId }).eq("id", id)),
    onVisitanteAmb: (id, liberar) => salvar(supabase.from("ambientes").update({ visitante: liberar }).eq("id", id), liberar ? "Liberado para visitantes" : "Escondido dos visitantes"),
    onAddEquip: (ambienteId, entityId, sug) => salvar(supabase.from("controle_equipamentos").insert({ ambiente_id: ambienteId, entity_id: entityId, tipo: sug?.tipo || tipoSugerido(entityId), nome: sug?.nome || null, ordem: equipamentos.filter((q) => q.ambiente_id === ambienteId).length }), "Aparelho adicionado"),
    onTipoEquip: (id, tipo) => salvar(supabase.from("controle_equipamentos").update({ tipo }).eq("id", id)),
    onNomeEquip: (id, nome) => salvar(supabase.from("controle_equipamentos").update({ nome: nome || null }).eq("id", id)),
    onDelEquip: (id) => salvar(supabase.from("controle_equipamentos").delete().eq("id", id)),
    onReordenar: async (idsTela0) => {
      const expandir = (lista) => lista.flatMap((id) => gruposRef.current[id] || [id]);
      const idsTela = expandir(idsTela0);
      // O som ligado aparece em 1º só enquanto toca: ao salvar, ele volta para a posição que tinha.
      const prim = expandir(idsTela0.slice(0, 1));
      const somOn = prim.some((id) => { const q = equipamentos.find((x) => x.id === id); return q && ehZonaAAT(q.entity_id) && entsVis[q.entity_id]?.state === "on"; });
      const ids = somOn ? (() => {
        const resto = expandir(idsTela0.slice(1));
        const antes = equipamentos.filter((x) => resto.includes(x.id) || prim.includes(x.id)).sort((x, y) => x.ordem - y.ordem).map((x) => x.id);
        const pos = Math.min(antes.findIndex((id) => prim.includes(id)), resto.length); resto.splice(pos, 0, ...prim); return resto;
      })() : idsTela;
      try { await Promise.all(ids.map((id, i) => supabase.from("controle_equipamentos").update({ ordem: i }).eq("id", id))); }
      catch { setAviso({ erro: true, texto: "Não consegui salvar a nova ordem." }); }
      await carregarConfig();
    },
    // Cartão de grupo (id inventado): grava o tamanho nos aparelhos de dentro.
    onTamanho: (id, tam) => salvar(supabase.from("controle_equipamentos").update({ tamanho: tam === "g" ? "g" : "p" }).in("id", gruposRef.current[id] || [id])),
    onRotulo: (id, chave, valor) => {
      const q = equipamentos.find((x) => x.id === id);
      const rot = { ...(q?.rotulos || {}) };
      if (valor && valor.trim()) rot[chave] = valor.trim(); else delete rot[chave];
      return salvar(supabase.from("controle_equipamentos").update({ rotulos: rot }).eq("id", id));
    },
  };

  // ---- Monta a lista para o modo "usar" (pavimento -> cômodo -> aparelhos) ----
  const meuSpotify = spotifyDaPessoa(entsVis, eu?.nome, eu?.spotifyEntity);
  // Alexa desligada pela chave: a música fica pausada e o cartão desligado até ligar de novo
  // (ou até a música voltar a tocar por outro caminho).
  const [alexaOff, setAlexaOff] = useState(() => { try { return JSON.parse(localStorage.getItem("alexaDesligada") || "[]"); } catch { return []; } });
  const marcarAlexa = (id, off) => setAlexaOff((l) => {
    const n = off ? [...new Set([...l, id])] : l.filter((x) => x !== id);
    try { localStorage.setItem("alexaDesligada", JSON.stringify(n)); } catch { /* ok */ }
    return n;
  });
  const [alexaArmada, setAlexaArmada] = useState([]); // cartões ligados esperando escolher Quarto/Banheiro
  const spState = meuSpotify ? entsVis[meuSpotify]?.state : null;
  useEffect(() => { if (spState === "playing" && alexaOff.length) { setAlexaOff([]); try { localStorage.setItem("alexaDesligada", "[]"); } catch { /* ok */ } } }, [spState]); // eslint-disable-line react-hooks/exhaustive-deps
  // Com o Spotify parado, o HA só aceita "escolher o aparelho"; tocar/play_media só depois que o
  // Spotify conecta nele. Então: escolhe o aparelho, espera o estado mostrar a conexão e segue.
  // Estado real do HA (sem a previsão do toque): para esperar o ar ligar de verdade.
  const entsReaisRef = useRef(ents); entsReaisRef.current = ents;
  const quandoLigado = (id, fn) => {
    const t0 = Date.now();
    const ver = () => { const st = entsReaisRef.current[id]?.state; if (st && !["off", "unavailable", "unknown"].includes(st)) { fn(); return; } if (Date.now() - t0 < 25000) setTimeout(ver, 1000); };
    setTimeout(ver, 1500);
  };
  const entsRef = useRef(entsVis);
  entsRef.current = entsVis;
  const bat = entsVis[BATERIA_PORTA.sensor]?.state;
  const nivelPorta = bat != null && bat !== "" && !isNaN(Number(bat)) ? Number(bat) : null; // "unknown"/"unavailable" = sem leitura
  const tarefaPilhas = useRef(false);
  useEffect(() => {
    if (nivelPorta == null) return;
    const chave = "bateriaPortaAvisoDia";
    if (nivelPorta > BATERIA_PORTA.recupera) { try { localStorage.removeItem(chave); } catch { /* ok */ } return; }
    if (nivelPorta > BATERIA_PORTA.limite) return;
    let dia = null; try { dia = localStorage.getItem(chave); } catch { /* ok */ }
    if (dia !== hojeISO()) { setAvisoBateria(nivelPorta); try { localStorage.setItem(chave, hojeISO()); } catch { /* ok */ } }
    if (tarefaPilhas.current) return;
    tarefaPilhas.current = true;
    (async () => {
      const { data: abertas } = await supabase.from("tarefas").select("id").eq("titulo", BATERIA_PORTA.titulo).neq("status", "concluida").limit(1);
      if (!abertas || abertas.length) return; // já existe (ou não deu para conferir)
      const { data: pessoas } = await supabase.from("perfis").select("id, nome").eq("ativo", true);
      const resp = (pessoas || []).find((x) => norm(x.nome).startsWith(BATERIA_PORTA.responsavel));
      await supabase.from("tarefas").insert({
        titulo: BATERIA_PORTA.titulo, descricao: `A bateria da fechadura da Porta da Frente está em ${nivelPorta}%. Comprar 4 pilhas AA e trocar.`,
        responsavel_id: resp?.id || null, criado_por_id: eu?.id || null, tipo: "unica", data: hojeISO(), status: "pendente",
        intervalo_semanas: 1, dias: [], imagens: [], eh_compra: false, dar_entrada: true,
      });
    })();
  }, [nivelPorta]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mesa XR18: o app NÃO mexe mais nela sozinho (reconectar a integração e desligar depois de
  // 30 min foram tirados: estavam derrubando a conexão da mesa). Só liga o plug ao escolher a TV.
  const conectarSpotify = (spId, connect, depois) => {
    if (!spId || !connect) return;
    enviar("media_player", "select_source", spId, { source: connect });
    setAviso({ texto: "Conectando o Spotify…" });
    const t0 = Date.now();
    const checar = () => {
      const v = entsRef.current[spId];
      const f = Number(v?.attributes?.supported_features) || 0;
      const pronto = v && v.attributes?.source === connect && (["playing", "paused"].includes(v.state) || (f & (1 | 512 | 16384)) !== 0);
      if (pronto) { setAviso(null); depois(v); return; }
      if (Date.now() - t0 > 25000) { setAviso(null); abrirSpotify(); return; } // não conectou: abre o Spotify para escolher o aparelho
      setTimeout(checar, 700);
    };
    setTimeout(checar, 700);
  };
  // Tira o Spotify do grupo de Alexas e deixa só numa. O multiambiente da Alexa "segura" a música no
  // grupo (e às vezes a puxa de volta segundos depois), então: pausa → passa por um degrau fora do
  // grupo (streamer do Térreo) → vai para a Alexa → toca. Depois vigia por 40 s; se o grupo voltar,
  // refaz uma vez. Enquanto isso a chave do cartão fica desligada (não pisca).
  const [saindoGrupo, setSaindoGrupo] = useState(null); // destino escolhido, enquanto sai do grupo
  const sairDoGrupo = (spId, membro, grupo) => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const fonte = () => entsRef.current[spId]?.attributes?.source;
    const passo = async () => {
      enviar("media_player", "media_pause", spId); await espera(1500);
      const degrau = (entsRef.current[spId]?.attributes?.source_list || []).find((x) => norm(x) === "som terreo");
      if (degrau) { enviar("media_player", "select_source", spId, { source: degrau }); await espera(1500); }
      enviar("media_player", "select_source", spId, { source: membro }); await espera(2500);
      if (entsRef.current[spId]?.state !== "playing") enviar("media_player", "media_play", spId); // escolheu onde tocar: toca
    };
    setSaindoGrupo(membro);
    setAviso({ texto: "Mudando onde a música toca…" });
    (async () => {
      await passo();
      setAviso(null);
      let refez = false;
      for (let i = 0; i < 8; i++) {
        await espera(5000);
        if (fonte() !== grupo) continue;
        if (refez) { setAviso({ erro: true, texto: "A Alexa voltou para o grupo sozinha. Escolha a Alexa no app do Spotify." }); break; }
        refez = true; await passo();
      }
      setSaindoGrupo(null);
    })();
  };
  // As 6 zonas do amplificador AAT (nome = cômodo, como estão no HA), para "Sincronizar ambientes".
  const nZona = (id) => Number(String(id).split("_").pop()) || 0;
  const tonsAAT = Object.fromEntries(Object.entries(entsVis).filter(([id]) => ehTomAAT(id)));
  // Zonas que estão com outra pessoa (cartão do cômodo com dono que não sou eu): desligar o meu
  // som não desliga essas, mesmo tocando a mesma fonte (no Térreo todas ligam no Som Térreo).
  const zonasDeOutros = new Set();
  [...new Set(equipamentos.filter((q) => ehZonaAAT(q.entity_id)).map((q) => q.ambiente_id))].forEach((amb) => {
    const linhas = equipamentos.filter((q) => q.ambiente_id === amb && ehZonaAAT(q.entity_id));
    const ses = linhas.map((q) => sessoes[q.id]).find(Boolean); // cômodo com 2 zonas: a sessão fica na 1ª
    if (ses && !(ses.participantes || []).includes(eu?.id)) linhas.forEach((q) => zonasDeOutros.add(q.entity_id));
  });
  const zonasAAT = Object.keys(entsVis).filter(ehZonaAAT).sort((x, y) => nZona(x) - nZona(y)).map((id) => {
    const v = entsVis[id], st = v?.state;
    return { id, tipo: "tv", nome: v?.attributes?.friendly_name || id, state: st, attributes: v?.attributes || {}, disponivel: st != null && !["unavailable", "unknown"].includes(st), deOutro: zonasDeOutros.has(id) };
  });
  // Pergunta algo ao HA e espera a resposta (só na conexão direta da família).
  const pedirHA = (msg) => new Promise((resolve, reject) => {
    const ws = wsRef.current;
    if (usarProxy || !ws || ws.readyState !== 1) { reject(new Error("Sem conexão direta com a casa.")); return; }
    const id = idRef.current++;
    pedidosRef.current[id] = (m) => (m.success === false ? reject(new Error(m.error?.message || "erro do Home Assistant")) : resolve(m.result));
    ws.send(JSON.stringify({ id, ...msg }));
    setTimeout(() => { if (pedidosRef.current[id]) { delete pedidosRef.current[id]; reject(new Error("O Home Assistant demorou para responder.")); } }, 12000);
  });
  const mkEquip = (row) => {
    if (row.tipo === "alexa") {
      // Qual Spotify comanda este cartão: o da pessoa, se enxerga as Echos dele; senão o da casa.
      const cfgA0 = ALEXA_CARTOES[row.entity_id];
      const nomesCartao = [...(cfgA0?.alexas || []).flatMap(([, n]) => n), ...(cfgA0?.grupos || []).flatMap(([n]) => n), ...(ALEXAS[row.entity_id] || [row.nome])];
      const enxerga = (id) => { const lista = (entsVis[id]?.attributes?.source_list || []).map(norm); return nomesCartao.filter((n) => lista.includes(norm(n))).length; };
      const spId = meuSpotify && (!entsVis[SPOTIFY_CASA] || enxerga(meuSpotify) >= enxerga(SPOTIFY_CASA)) ? meuSpotify : (entsVis[SPOTIFY_CASA] ? SPOTIFY_CASA : meuSpotify);
      const sp = spId ? entsVis[spId] : null;
      const cfgA = ALEXA_CARTOES[row.entity_id];
      const alexas = (cfgA?.alexas || [["Aqui", ALEXAS[row.entity_id] || [row.nome]]]).map(([rotulo, nomes]) => ({ rotulo, connect: acharConnect(sp, nomes) }));
      const grupos = (cfgA?.grupos || []).map(([nomes, membros]) => ({ connect: acharConnect(sp, nomes), membros })).filter((x) => x.connect);
      // Cada conta do Spotify enxerga Alexas diferentes: vale a 1ª que aparecer (ou um grupo).
      const connect = alexas.find((x) => x.connect)?.connect || grupos[0]?.connect || null;
      // Saindo do grupo, vale o destino escolhido (o Spotify demora a informar).
      const fonte = saindoGrupo || sp?.attributes?.source;
      const tocandoSp = !!sp && ["playing", "paused"].includes(sp.state);
      const iSo = alexas.findIndex((x) => x.connect && x.connect === fonte);
      const ativos = iSo >= 0 ? [iSo] : (grupos.find((x) => x.connect === fonte)?.membros || []);
      const aquiFonte = ativos.length > 0;
      const aqui = tocandoSp && aquiFonte && !(sp.state === "paused" && alexaOff.includes(row.entity_id));
      const armado = alexaArmada.includes(row.entity_id) && !alexaOff.includes(row.entity_id);
      const tocandoAqui = aqui && (sp.state === "playing" || !!saindoGrupo);
      return { dbId: row.id, id: row.entity_id, tipo: "alexa", nome: row.nome || "Alexa", rotulos: row.rotulos || {}, tamanho: "g",
        state: aqui ? sp.state : armado ? "paused" : "idle", attributes: aqui ? sp.attributes : {}, disponivel: true, soArmado: !aqui && armado,
        spotify: spId, pelaCasa: !!spId && spId !== meuSpotify, connect, alexas, grupos, multi: alexas.length > 1, fonteSp: sp?.attributes?.source, tocandoSp, aquiFonte, conectarSpotify, sairDoGrupo,
        chaves: alexas.map((x, i) => ({ rotulo: x.rotulo, disponivel: !!x.connect, on: tocandoAqui && ativos.includes(i) })),
        avisar: (texto) => setAviso({ erro: true, texto }),
        armar: (on) => setAlexaArmada((l) => (on ? [...new Set([...l, row.entity_id])] : l.filter((x) => x !== row.entity_id))),
        marcarDesligada: (off) => marcarAlexa(row.entity_id, off),
        pedirHA: usarProxy ? null : pedirHA, baseUrl: baseUrlRef.current };
    }
    const tvc = TV_CONTROLE[row.entity_id];
    const live = entsVis[tvc ? tvc.tv : row.entity_id];
    const state = live?.state;
    return {
      // Visitante: fechadura e portão aparecem só para ver (o intermediário também barra).
      dbId: row.id, id: tvc ? tvc.tv : row.entity_id,
      tipo: eu?.papel === "visitante" && (row.tipo === "fechadura" || row.entity_id === PORTAO_ID) ? "sensor" : row.tipo,
      ...(tvc ? { controleTv: tvc, abrirControle: () => { topoDoCabecalho(); setTvAberta(tvc); } } : {}),
      ...(RECEIVERS_SOM[row.entity_id] ? { receiver: RECEIVERS_SOM[row.entity_id], spotify: meuSpotify, conectarSpotify, tvNaSala: tvLigada(entsVis[RECEIVERS_SOM[row.entity_id].tvId]) } : {}),
      nome: row.nome || live?.attributes?.friendly_name || row.entity_id,
      state, attributes: live?.attributes || {}, rotulos: row.rotulos || {}, tamanho: row.tamanho === "g" ? "g" : "p",
      disponivel: row.tipo === "botao" ? state != null && state !== "unavailable" : state != null && !["unavailable", "unknown", "none", ""].includes(state),
      streamer: ehZonaAAT(row.entity_id) ? vincularStreamer(live) : RECEIVERS_SOM[row.entity_id] ? streamerSpotify(RECEIVERS_SOM[row.entity_id]) : null,
      zonas: ehZonaAAT(row.entity_id) ? zonasAAT : null,
      ...(row.tipo === "ar" ? { quandoLigado: (fn) => quandoLigado(row.entity_id, fn) } : {}),
      tons: ehZonaAAT(row.entity_id) ? tonsAAT : null,
      mesa: ehZonaAAT(row.entity_id) ? { cfg: MESA_TV, ents: Object.fromEntries(MESA_IDS.map((id) => [id, entsVis[id]])) } : null,
    };
  };
  // Receiver com HEOS/Bluetooth: a música que aparece e os botões vêm do Spotify da pessoa
  // (o Spotify comanda o aparelho em que estiver tocando, inclusive o celular no Bluetooth).
  function streamerSpotify(cfg) {
    if (!meuSpotify) return null;
    const v = entsVis[meuSpotify];
    return { id: meuSpotify, tipo: "tv", nome: "Spotify", state: v?.state, attributes: v?.attributes || {},
      disponivel: !!v && !["unavailable", "unknown"].includes(v.state), semSinal: !v,
      spotify: meuSpotify, connect: cfg.connect, spotifyEnt: v, conectarSpotify, pedirHA: usarProxy ? null : pedirHA, baseUrl: baseUrlRef.current,
      qualquerFonte: true };
  }
  function vincularStreamer(zona) {
    const fonte = zona?.attributes?.source, sid = STREAMER_DA_FONTE[fonte];
    if (!sid) return null;
    const v = entsVis[sid], st = v?.state;
    return { id: sid, tipo: "tv", nome: FONTE_NOME_AAT[fonte] || sid, state: st, attributes: v?.attributes || {},
      disponivel: st != null && !["unavailable", "unknown", "none", ""].includes(st), semSinal: !v,
      spotify: meuSpotify, connect: STREAMER_CONNECT[sid], spotifyEnt: meuSpotify ? entsVis[meuSpotify] : null, conectarSpotify,
      pedirHA: usarProxy ? null : pedirHA, baseUrl: baseUrlRef.current };
  }
  // Cartões de grupo (persianas): recebem a previsão e anotam os aparelhos de dentro, para o
  // arrasto mover o grupo inteiro.
  const comGrupos = (itens) => itens.map((x) => {
    if (x.dbIdsZonas) { gruposRef.current[x.dbId] = x.dbIdsZonas; return x; }
    if (x.tipo === "grupoLuzes" || x.tipo === "grupoBotoes") { gruposRef.current[x.dbId] = x.membros.map((m) => m.dbId); return x; }
    if (x.tipo !== "grupoPersianas") return x;
    gruposRef.current[x.dbId] = [...(x.mestre ? [x.mestre.dbId] : []), ...x.membros.map((m) => m.dbId)];
    return { ...x, preverEstados };
  });
  // ---- Som/TV: quem ligou "é dono"; os outros veem aceso, mas recolhido, até aceitarem dividir ----
  const meId = eu?.id;
  const primeiroNome = String(eu?.nome || "").split(" ")[0];
  const gravarUso = (chave, dados) => supabase.from("controle_uso").upsert({ chave, ...dados }).then(() => carregarConfig());
  const registrarUso = (chave) => {
    if (!meId) return;
    const linha = { dono: meId, dono_nome: primeiroNome, participantes: [meId], desde: new Date().toISOString() };
    setSessoes((s0) => ({ ...s0, [chave]: { chave, ...linha } })); // já mostra como meu (sem piscar)
    gravarUso(chave, linha);
  };
  const encerrarUso = (chave) => sessoes[chave] && supabase.from("controle_uso").delete().eq("chave", chave).then(() => carregarConfig());
  const sairUso = (chave) => { const ses = sessoes[chave]; if (ses) gravarUso(chave, { ...ses, participantes: (ses.participantes || []).filter((x) => x !== meId) }); };
  const entrarUso = (chave, virarDono) => {
    const ses = sessoes[chave]; if (!meId) return;
    if (!ses) { registrarUso(chave); return; } // ligado por fora do app: quem aceitar passa a ser o dono
    const part = [...new Set([...(ses.participantes || []), meId])];
    gravarUso(chave, virarDono ? { ...ses, dono: meId, dono_nome: primeiroNome, participantes: part } : { ...ses, participantes: part });
  };
  const midiaLigada = (x) => (x.tipo === "alexa" ? ["playing", "paused"].includes(x.state) && !x.soArmado : estadoMidia(x).ligado);
  const marcarUso = (itens) => itens.map((x) => {
    if (!["tv", "alexa"].includes(x.tipo) || (x.tipo === "tv" && !midiaRecursos(x).liga)) return x;
    const ses = sessoes[x.dbId];
    const dentro = !!ses && (ses.participantes || []).includes(meId);
    // Sem dono no app (ligado pelo controle remoto, voz…): conta como ligado, mas fica recolhido.
    return { ...x, alheio: usoAtivo && midiaLigada(x) && !dentro, usoDe: ses?.dono_nome || null, ehParticipante: dentro && ses.dono !== meId,
      uso: { registrar: () => registrarUso(x.dbId), encerrar: () => encerrarUso(x.dbId), sair: () => sairUso(x.dbId), dividir: () => setDividir(x) } };
  });
  const semPav = { id: "__sem__", nome: "Outros", ordem: 99999 };
  // Painel pessoal: aparelhos mudados de cômodo e escondidos.
  const equipamentosVis = painel
    ? equipamentos.map((q) => (cfgP.mover?.[q.id] ? { ...q, ambiente_id: cfgP.mover[q.id] } : q)).filter((q) => !cfgP.ocultoEq?.[q.id])
    : equipamentos;
  const listaPavBase = [...pavimentos, semPav].map((p) => ({
    id: p.id, nome: p.nome, ordem: p.ordem,
    // Visitante só vê os cômodos liberados para ele (o banco e o intermediário também barram).
    comodos: ambientes.filter((a) => (a.pavimento_id || "__sem__") === p.id && (eu?.papel !== "visitante" || a.visitante !== false)).sort((a, b) => a.ordem - b.ordem).map((a) => ({
      id: a.id, nome: a.nome,
      itens: marcarUso(comGrupos(somPrimeiro(comFontePadrao(agruparBotoes(agruparLuzes(agruparPersianas(juntarZonasDoComodo(equipamentosVis.filter((q) => q.ambiente_id === a.id).sort((x, y) => x.ordem - y.ordem).map(mkEquip)), a.id), a.id), a.id), p.nome)))),
    })).filter((c) => c.itens.length > 0),
  })).filter((p) => p.comodos.length > 0).sort((a, b) => a.ordem - b.ordem);
  // Painel pessoal: cômodo escondido "mostrando os aparelhos" põe os aparelhos soltos no nível;
  // nível escondido "mostrando os cômodos" tira a caixa do nível.
  const listaPav = listaPavBase.flatMap((p) => {
    if (!painel) return [{ ...p, soltos: [] }];
    const oP = cfgP.ocultoPav?.[p.id];
    if (oP === "tudo") return [];
    const soltos = [], comodos = [];
    p.comodos.forEach((c) => { const oA = cfgP.ocultoAmb?.[c.id]; if (!oA) comodos.push(c); else if (oA === "expor") soltos.push(...c.itens); });
    if (!comodos.length && !soltos.length) return [];
    return [{ ...p, comodos, soltos, semCaixa: oP === "expor" }];
  });
  const ambientePorEq = Object.fromEntries(equipamentosVis.map((q) => [q.id, q.ambiente_id]));
  const midiasNaTela = listaPavBase.flatMap((p) => p.comodos.flatMap((c) => c.itens)).filter((x) => x.uso);
  // Só limpa quando o aparelho desligou de verdade: TV/som do HA (estado igual para todos). Alexa
  // depende do Spotify de quem olha — só o dono limpa, e "esperando escolher onde tocar" não conta.
  const usoParaLimpar = status === "ok" ? Object.keys(sessoes).filter((k) => {
    const x = midiasNaTela.find((y) => y.dbId === k); if (!x) return false;
    if (x.tipo === "alexa") return sessoes[k]?.dono === meId && !x.soArmado && !midiaLigada(x);
    return !midiaLigada(x);
  }) : [];
  const chaveLimpar = usoParaLimpar.join();
  useEffect(() => {
    if (!chaveLimpar) return;
    const t = setTimeout(() => { chaveLimpar.split(",").forEach((k) => supabase.from("controle_uso").delete().eq("chave", k)); carregarConfig(); }, 20000); // espera: o aparelho pode estar ligando
    return () => clearTimeout(t);
  }, [chaveLimpar]); // eslint-disable-line react-hooks/exhaustive-deps
  // O que está escondido neste painel (para mostrar de novo).
  const ocultosPainel = !painel ? [] : [
    ...Object.entries(cfgP.ocultoPav || {}).map(([id]) => ({ chave: "p" + id, tipo: "pav", id, rotulo: `Nível ${pavimentos.find((x) => x.id === id)?.nome || ""}` })),
    ...Object.entries(cfgP.ocultoAmb || {}).map(([id]) => ({ chave: "a" + id, tipo: "amb", id, rotulo: `Cômodo ${ambientes.find((x) => x.id === id)?.nome || ""}` })),
    ...Object.keys(cfgP.ocultoEq || {}).map((id) => { const q = equipamentos.find((x) => x.id === id); return { chave: "e" + id, tipo: "eq", id, rotulo: q?.nome || entsVis[q?.entity_id]?.attributes?.friendly_name || q?.entity_id || "Aparelho" }; }),
    ...Object.entries(cfgP.mover || {}).map(([id, amb]) => { const q = equipamentos.find((x) => x.id === id); return { chave: "m" + id, tipo: "mov", id, desfazer: "Desfazer", rotulo: `${q?.nome || entsVis[q?.entity_id]?.attributes?.friendly_name || "Aparelho"} → ${ambientes.find((x) => x.id === amb)?.nome || ""}` }; }),
  ];
  const mostrarOculto = (o) => mudarCfg((c) => {
    const tira = (obj) => { const n = { ...obj }; delete n[o.id]; return n; };
    return o.tipo === "pav" ? { ...c, ocultoPav: tira(c.ocultoPav) } : o.tipo === "amb" ? { ...c, ocultoAmb: tira(c.ocultoAmb) } : o.tipo === "eq" ? { ...c, ocultoEq: tira(c.ocultoEq) } : { ...c, mover: tira(c.mover) };
  });

  // Câmeras dos popups (portão, porta): foto ao vivo pelo camera_proxy do HA (só conexão direta).
  const camerasDe = (lista) => lista.map((c) => {
    const tk = entsVis[c.id]?.attributes?.access_token;
    const aviso = usarProxy ? "Câmera disponível só para a família (conexão direta com a casa)." : !entsVis[c.id] ? "Câmera não encontrada no Home Assistant." : null;
    return { ...c, aviso, url: !usarProxy && tk ? `${baseUrlRef.current}/api/camera_proxy/${c.id}?token=${tk}${c.largura ? `&width=${c.largura}` : ""}` : null };
  });
  const topoDoCabecalho = () => setTopoPortao(Math.max(0, Math.round(cabRef.current?.getBoundingClientRect().bottom || 0)) + 6);
  return (
    // overflowX "clip" (e não "hidden"): "hidden" impediria o cabeçalho de ficar fixo no alto.
    <div style={{ background: C.tela, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: C.terra, overflowX: "clip", width: "100%" }}>
      <div className="mx-auto" style={{ maxWidth: 460, width: "100%", boxSizing: "border-box", minHeight: "100vh", paddingBottom: 30 }}>
        <style>{"@keyframes ah-jig{0%{transform:rotate(-0.7deg)}50%{transform:rotate(0.7deg)}100%{transform:rotate(-0.7deg)}}.ah-jiggle{animation:ah-jig .28s infinite ease-in-out}@keyframes ah-pisca{50%{opacity:.2}}.ah-pisca{animation:ah-pisca .8s infinite}"}</style>
        <DialogHost />
        {portaoAberto && <PortaoModal ent={entsVis[PORTAO_ID]} enviar={enviar} onFechar={() => setPortaoAberto(false)} topo={topoPortao}
          cameras={camerasDe(PORTAO_CAMERAS)} />}
        {alarmeAberto && <AlarmeModal ents={entsVis} enviar={enviar} souAdmin={eu?.papel === "admin"} onFechar={() => setAlarmeAberto(false)} />}
        {/* Alarme disparado: faixa vermelha no alto, com o lugar que disparou; toca para abrir. */}
        {ALARMES.map((cfg) => { const al = lerAlarme(cfg, entsVis); if (al.estado !== "triggered") return null; return (
          <button key={cfg.painel} onClick={() => setAlarmeAberto(true)} className="ah-pisca"
            style={{ position: "fixed", left: 8, right: 8, top: 8, zIndex: 80, background: "#b34a3a", color: "#fff", borderRadius: 14, padding: "12px 14px", fontWeight: 800, fontSize: 15, textAlign: "left", boxShadow: "0 10px 30px #0006" }}>
            🚨 ALARME DISPARADO · {cfg.nome}{al.disparadas.length ? ` · ${al.disparadas.map((z) => z.nome).join(", ")}` : al.memoria.length ? ` · zona ${al.memoria.join(", ")}` : ""}
          </button>
        ); })}
        {tvAberta && <TvControleModal cfg={tvAberta} ent={entsVis[tvAberta.tv]} entSom={entsVis[tvAberta.som]} enviar={enviar} onFechar={() => setTvAberta(null)} topo={topoPortao} />}
        {dividir && (
          <DividirSheet e={dividir} temSpotify={!!meuSpotify} onFechar={() => setDividir(null)}
            onDividir={() => { const x = dividir; setDividir(null); entrarUso(x.dbId, false); if (x.controleTv) x.abrirControle?.(); }}
            onMeuSpotify={() => {
              const x = dividir; setDividir(null); entrarUso(x.dbId, true);
              const destino = x.tipo === "alexa" ? (x.fonteSp || x.connect) : x.streamer?.connect || x.receiver?.connect;
              if (meuSpotify && destino) conectarSpotify(meuSpotify, destino, (v) => { if (v.state !== "playing") enviar("media_player", "media_play", meuSpotify); });
              else abrirSpotify();
            }} />
        )}
        {avisoBateria != null && (
          <Sheet titulo="Trocar a bateria da fechadura" onFechar={() => setAvisoBateria(null)}>
            <div className="text-center" style={{ padding: "4px 0 10px" }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: alfa(C.ambar, 16), color: C.ambar, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Lock size={30} /></div>
              <div className="font-bold" style={{ fontSize: 18, marginTop: 10 }}>Porta da Frente: {avisoBateria}% de bateria</div>
              <div style={{ color: C.cinza, fontSize: 14.5, marginTop: 6 }}>Troque as 4 pilhas AA da fechadura. A Ana Carolina já tem uma tarefa para comprar as pilhas.</div>
            </div>
            <button onClick={() => setAvisoBateria(null)} style={{ width: "100%", background: C.pasto, color: "#fff", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 16 }}>Entendi</button>
          </Sheet>
        )}
        {portaAberta && <PortaModal ent={entsVis[PORTA_ID]} enviar={enviar} onFechar={() => setPortaAberta(false)} topo={topoPortao} cameras={camerasDe(PORTA_CAMERAS)} />}
        <InstalarPrompt />
        {/* Mesmo verde do cabeçalho do app de tarefas, em versão compacta. */}
        <header ref={cabRef} style={{ background: C.cabecalho, color: "#fff", padding: "10px 12px", borderBottomLeftRadius: 18, borderBottomRightRadius: 18, position: "sticky", top: 0, zIndex: 45 }}>
          <div className="flex items-center gap-2">
            {/* Casinha: volta ao app de Tarefas (quem tem). */}
            {onVoltar
              ? <button onClick={onVoltar} title="Ir para as Tarefas" aria-label="Ir para as Tarefas" style={{ background: "#ffffff22", borderRadius: 10, padding: 6, display: "flex", color: "#fff" }}><Home size={18} /></button>
              : <div style={{ background: "#ffffff22", borderRadius: 10, padding: 6, display: "flex" }}><Home size={18} /></div>}
            <div className="flex-1 min-w-0"><div className="font-bold leading-tight truncate" style={{ fontSize: 16 }}>Controle da Casa</div><div style={{ color: "#ffffffcc", fontSize: 11.5 }} className="leading-tight truncate">{modo === "gerenciar" ? "Organizando ambientes" : "Rancho Abdalla"}</div></div>
            {/* Configurando: o "Pronto" fica à vista para voltar; o resto mora no menu ⋮. */}
            {modo === "gerenciar" && <button onClick={() => setModo("usar")} title="Terminar de configurar" style={{ background: "#ffffff33", borderRadius: 10, padding: "7px 11px", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700 }}><Check size={16} /> Pronto</button>}
            {/* TV ligada: o controle remoto fica a um toque, ao lado do tempo. */}
            {TVS_COM_CONTROLE.filter((t) => tvLigada(entsVis[t.tv]) && !(() => { const q = equipamentos.find((x) => TV_CONTROLE[x.entity_id] === t); const ses = q && sessoes[q.id]; return usoAtivo && !!q && !(ses?.participantes || []).includes(meId); })()).map((t) => (
              <button key={t.tv} onClick={() => { topoDoCabecalho(); setTvAberta(t); }} title={`Controle da ${t.nome}`} aria-label={`Controle remoto da ${t.nome}`}
                style={{ background: "#ffffff22", borderRadius: 10, padding: 6, display: "flex", color: "#fff" }}><IconeControleRemoto size={20} /></button>
            ))}
            <BotaoTempo />
            {/* O menu ⋮ aparece para quem tem a chave "Menu ⋮ do Controle" (tudo) ou "Pode montar o
                próprio painel" (só o Dashboard). */}
            {(eu?.podeMenuControle || podePessoal) && (
              <MenuPontinhos aberto={menuAberto} setAberto={setMenuAberto} itens={[
                // Portão e Porta Entrada sempre em primeiro; depois o Dashboard e o resto.
                ...(!eu?.podeMenuControle ? [] : [
                  { key: "portao", icon: DoorOpen, cor: C.ambar, txt: "Portão", on: () => { topoDoCabecalho(); setPortaoAberto(true); } },
                  { key: "porta", icon: Lock, cor: C.ambar, txt: "Porta Entrada", on: () => { topoDoCabecalho(); setPortaAberta(true); } },
                  { key: "alarme", icon: ShieldCheck, cor: C.vermelho, txt: "Alarme", on: () => setAlarmeAberto(true) },
                ]),
                ...(podePessoal && modo === "usar" ? [{ key: "dash", icon: LayoutGrid, cor: C.lago, txt: `Dashboard · ${painel ? painel.nome : "Padrão"}`, on: () => setPaineisAberto(true) }] : []),
                ...(!eu?.podeMenuControle ? [] : [
                // Mesmos itens do ⋮ das tarefas (com "Tarefas" no lugar de "Controle da casa") + Configuração.
                ...(souGestor && modo === "usar" ? [{ key: "config", icon: Wrench, cor: C.pasto, txt: "Configuração", on: () => setModo("gerenciar") }] : []),
                ...(!estaInstalado() ? [{ key: "inst", icon: ArrowDownToLine, cor: C.pasto, txt: "Instalar app", on: () => _installOpen.fn && _installOpen.fn() }] : []),
                ...(onEquipe ? [{ key: "equipe", icon: Users, cor: C.pasto, txt: "Equipe", on: onEquipe }] : []),
                { key: "tema", icon: tema === "dark" ? Sun : Moon, cor: C.ambar, txt: tema === "dark" ? "Modo claro" : "Modo noturno", on: () => { const n = tema === "dark" ? "light" : "dark"; aplicarTema(n); setTema(n); } },
                ...(onSobre ? [{ key: "sobre", icon: Info, cor: C.lago, txt: "Sobre a propriedade", on: onSobre }] : []),
                ...(onSair ? [{ key: "sair", icon: LogOut, cor: C.vermelho, txt: "Sair", on: async () => { if (await Dialog.confirm({ titulo: "Sair", mensagem: "Deseja sair desta conta?", okLabel: "Sair" })) onSair(); } }] : []),
                ]),
              ]} />
            )}
          </div>
        </header>

        <main className="pt-3" style={{ paddingLeft: 8, paddingRight: 8 }}>
          {status === "carregando" && <div className="text-center py-16" style={{ color: C.cinza }}>Conectando ao Home Assistant…</div>}
          {status === "erro" && (
            <div style={{ background: C.vermelhoClaro, border: `1px solid ${alfa(C.vermelho, 33)}`, borderRadius: 14 }} className="p-4 mt-4">
              <div className="font-bold" style={{ color: C.vermelho }}>Não deu para conectar</div>
              <div style={{ color: C.terra }} className="text-sm mt-1">{erro}</div>
              <button onClick={() => setTentativa((t) => t + 1)} style={{ marginTop: 12, background: LAGO, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700 }}>Tentar de novo</button>
            </div>
          )}

          {modo === "gerenciar" && souGestor && (
            <><SpotifyPessoas ents={ents} /><GerenciarView pavimentos={pavimentos} ambientes={ambientes} equipamentos={equipamentos} ents={ents} areas={areas} cbs={cbs} /></>
          )}

          {modo === "usar" && status === "ok" && listaPav.length === 0 && (
            <div className="text-center py-16" style={{ color: C.cinza }}>
              Nenhum ambiente organizado ainda.
              {souGestor && <div className="mt-3"><button onClick={() => setModo("gerenciar")} style={{ background: C.pasto, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700 }}>Organizar agora</button></div>}
            </div>
          )}
          {modo === "usar" && status === "ok" && souGestor && listaPav.length > 0 && (
            editando ? (
              <div className="flex items-center justify-end mb-3" style={{ position: "sticky", top: 6, zIndex: 20 }}>
                <button onClick={() => setEditando(false)} style={{ background: C.pasto, color: "#fff", borderRadius: 8, padding: "6px 16px", fontWeight: 700, fontSize: 13 }}>Concluir</button>
              </div>
            ) : null
          )}
          {modo === "usar" && status === "ok" && (arrPav
            ? [...arrPav.ordem.map((id) => listaPav.find((x) => x.id === id)).filter(Boolean), ...listaPav.filter((x) => !arrPav.ordem.includes(x.id))]
            : listaPav).map((pav) => {
            const naMao = arrPav?.id === pav.id;
            const abertoP = !arrPav && pavAberto(pav.id);
            const todosP = [...pav.soltos, ...pav.comodos.flatMap((c) => c.itens)];
            const acesoP = contarLigados(todosP).on > 0;
            // Aparelhos soltos (cômodo escondido "mostrando os aparelhos") e cartões de cada cômodo.
            const grade = (itens, ambId) => (
              <GradeEquip itens={itens} enviar={enviar} expandidos={expandidos} toggleExpand={toggleExpand} podeArrastar={souGestor && !painel} onReordenar={cbs.onReordenar} editando={editando} setEditando={setEditando} onTamanho={cbs.onTamanho}
                onSegurar={usarPessoal ? (e) => segurarPainel({ tipo: "eq", id: e.dbId, nome: e.nome, ambId: ambId || ambientePorEq[e.dbId], dbIds: gruposRef.current[e.dbId] || [e.dbId] }) : undefined} />
            );
            const soltosGrade = pav.soltos.length > 0 && <div style={{ padding: "4px 2px 8px" }}>{grade(pav.soltos, null)}</div>;
            const renderComodo = (c) => {
              const naMaoC = arrAmb?.id === c.id;
              const abertoC = !arrAmb && abertos.amb === c.id;
              const acesoC = contarLigados(c.itens).on > 0; // algo ligado: a caixa ganha um tom âmbar
              return (
                // Cômodo com algo ligado: como o nível — fundo normal, borda levemente âmbar e um brilho suave
                // (o ⏻ do título já fica aceso).
                <React.Fragment key={c.id}>
                {naMaoC && <div style={{ height: arrAmb.h, borderRadius: 18, border: `2px dashed ${C.cinzaClaro}`, background: alfa(C.cinzaClaro, 8) }} />}
                <div ref={(el) => { ambRefs.current[c.id] = el; }} data-comodo={c.id}
                  style={{ border: `1px solid ${acesoC ? alfa(C.ambar, 45) : abertoC ? alfa(C.cinzaClaro, 45) : C.linha}`, borderRadius: 18,
                  ...(naMaoC ? { position: "fixed", left: arrAmb.left, top: arrAmb.y - arrAmb.offY, width: arrAmb.w, zIndex: 60, transform: "scale(1.02)" } : {}),
                  background: "var(--c-comodo, #fff)", padding: "6px 12px",
                  boxShadow: naMaoC ? "0 22px 44px -16px rgba(0,0,0,.5)" : acesoC ? `0 0 0 1px ${alfa(C.ambar, 14)}, 0 8px 22px -14px ${alfa(C.ambar, 60)}` : abertoC ? "0 10px 28px -18px rgba(0,0,0,.45)" : C.comodoSombra,
                  transition: "box-shadow .25s, border-color .25s, background .25s" }}>
                  {/* Segurar o título do cômodo: arrasta (gestor no Padrão) ou abre as opções do painel pessoal. */}
                  <div onPointerDown={(ev) => (usarPessoal ? pressMenu(ev, { tipo: "amb", id: c.id, nome: c.nome }) : aoPressionarAmb(ev, c.id, pav.id, pav.comodos.map((x) => x.id)))}
                    onPointerMove={(ev) => { moverMenu(ev); aoMoverAmb(ev); }} onPointerUp={() => { soltarMenu(); aoSoltarAmb(); }} onPointerCancel={() => { soltarMenu(); aoSoltarAmb(); }}
                    onContextMenu={(ev) => { if (souGestor || usarPessoal) ev.preventDefault(); if (souGestor && !usarPessoal) pegarAmb(); }}
                    onClickCapture={(ev) => { if (ambLongo.current || menuLongo.current) { ev.stopPropagation(); ev.preventDefault(); } }}
                    style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: arrAmb ? "none" : "auto" }}>
                    <CabecalhoNivel nome={c.nome} aberto={abertoC} onAlternar={() => alternarAmb(c.id, pav.id)}
                      itens={c.itens} onDesligarTudo={(itens) => desligarTudo(itens, c.nome)} musica={musicaDe(c.itens, enviar)} />
                  </div>
                  {abertoC && (
                    <div style={{ borderTop: `1px solid ${C.linha}`, margin: "6px -12px 0", padding: "12px 12px 6px" }}>
                      {grade(c.itens, c.id)}
                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            };
            const comodosOrd = arrAmb?.pavId === pav.id ? arrAmb.ordem.map((id) => pav.comodos.find((x) => x.id === id)).filter(Boolean) : pav.comodos;
            // Nível escondido "mostrando os cômodos": sem a caixa e o título do nível.
            if (pav.semCaixa) return (
              <div key={pav.id} className="flex flex-col" style={{ gap: 8, marginBottom: 10 }}>{soltosGrade}{comodosOrd.map(renderComodo)}</div>
            );
            return (
            <React.Fragment key={pav.id}>
            {naMao && <div style={{ height: arrPav.h, marginBottom: 10, borderRadius: 22, border: `2px dashed ${C.cinzaClaro}`, background: alfa(C.cinzaClaro, 8) }} />}
            <section ref={(el) => { pavRefs.current[pav.id] = el; }}
              // Caixa do pavimento: fecha toda a área do nível (título + cômodos) com borda e um fundo
              // um tom diferente da página. Com algo ligado, a borda fica âmbar.
              style={{ marginBottom: 10, padding: 6, borderRadius: 22, boxSizing: "border-box",
                border: `1px solid ${acesoP ? alfa(C.ambar, 35) : C.nivelBorda}`,
                background: C.nivel, boxShadow: C.nivelSombra, transition: "border-color .25s",
                ...(naMao ? { position: "fixed", left: arrPav.left, top: arrPav.y - arrPav.offY, width: arrPav.w, zIndex: 60, margin: 0,
                  boxShadow: "0 22px 44px -16px rgba(0,0,0,.5)", transform: "scale(1.02)" } : {}) }}>
              {/* Mesmo recuo à DIREITA do cabeçalho do cômodo (12 de respiro + 1 de borda): os "Desligar tudo" alinham.
                  Aqui o recuo conta a partir da borda interna da caixa do pavimento. */}
              <div style={{ padding: "0 13px 0 3px", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: arrPav ? "none" : "auto" }}
                onPointerDown={(ev) => (usarPessoal ? pressMenu(ev, { tipo: "pav", id: pav.id, nome: pav.nome }) : aoPressionarPav(ev, pav.id))}
                onPointerMove={(ev) => { moverMenu(ev); aoMoverPav(ev); }} onPointerUp={() => { soltarMenu(); aoSoltarPav(); }} onPointerCancel={() => { soltarMenu(); aoSoltarPav(); }}
                onContextMenu={(ev) => { if (usarPessoal) { ev.preventDefault(); return; } if (souGestor && pav.id !== "__sem__") { ev.preventDefault(); pegarPav(); } }}
                onClickCapture={(ev) => { if (pavLongo.current || menuLongo.current) { ev.stopPropagation(); ev.preventDefault(); } }}>
                <CabecalhoNivel nome={pav.nome} grande aberto={abertoP} onAlternar={() => alternarPav(pav.id, pav.comodos.map((c) => c.id))}
                  itens={todosP} onDesligarTudo={(itens) => desligarTudo(itens, pav.nome)}
                  musica={musicaDe(todosP, enviar)}
                  sub={`${pav.comodos.length} ${pav.comodos.length === 1 ? "cômodo" : "cômodos"}`} />
              </div>
              {abertoP && (
                <div className="flex flex-col" style={{ gap: 8, marginTop: 4 }}>
                  {soltosGrade}
                  {comodosOrd.map(renderComodo)}
                </div>
              )}
            </section>
            </React.Fragment>
            );
          })}
          {paineisAberto && (
            <PaineisSheet paineis={paineis.lista} ativo={painel ? painel.id : "padrao"} ocultos={ocultosPainel}
              onEscolher={(id) => setPaineis((p0) => ({ ...p0, ativo: id }))}
              onCriar={() => criarPainel()}
              onRenomear={async (id) => { const atual = paineis.lista.find((x) => x.id === id); const n = await Dialog.prompt({ titulo: "Renomear painel", mensagem: "Novo nome:", valor: atual?.nome || "", okLabel: "Salvar" }); if (n && n.trim()) setPaineis((p0) => ({ ...p0, lista: p0.lista.map((x) => (x.id === id ? { ...x, nome: n.trim() } : x)) })); }}
              onExcluir={async (id) => { const atual = paineis.lista.find((x) => x.id === id); if (await Dialog.confirm({ titulo: "Excluir painel", mensagem: `Excluir o painel "${atual?.nome}"? O Padrão continua igual.`, okLabel: "Excluir", perigo: true })) setPaineis((p0) => ({ ativo: p0.ativo === id ? "padrao" : p0.ativo, lista: p0.lista.filter((x) => x.id !== id) })); }}
              onMostrar={mostrarOculto} onFechar={() => setPaineisAberto(false)} />
          )}
          {menuPainel && (
            <MenuPainelSheet alvo={menuPainel} onAcao={acaoPainel} onFechar={() => setMenuPainel(null)}
              comodos={listaPavBase.flatMap((p) => p.comodos.map((c) => ({ id: c.id, nome: c.nome, pavNome: p.nome })))} />
          )}

          {/* Aviso flutuando embaixo da tela (antes ficava no fim da página, fora da vista). Tocar fecha. */}
          {aviso && <div role={aviso.erro ? "alert" : "status"} onClick={() => setAviso(null)}
            style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(16px + env(safe-area-inset-bottom))", width: "calc(100% - 24px)", maxWidth: 436, zIndex: 66,
              background: aviso.erro ? C.vermelhoClaro : C.pastoClaro, color: aviso.erro ? C.vermelho : C.pastoEsc, border: `1px solid ${aviso.erro ? alfa(C.vermelho, 33) : alfa(C.pasto, 25)}`,
              borderRadius: 14, fontSize: 14, fontWeight: 600, padding: "12px 14px", boxShadow: "0 8px 22px #0003" }}>{aviso.texto}</div>}
        </main>
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
  // O painel avalia só colaboradores; administradores não entram na conta.
  const colabIds = new Set(users.filter((u) => u.papel === "colaborador").map((u) => u.id));
  let totalTarefas = 0, totalMin = 0;
  tasks.forEach((t) => {
    if (t.ehCompra) return; // compras não entram no painel de trabalho
    const dur = duracaoMin(t);
    // META — contada pelo responsável, pelas ocorrências agendadas no período.
    if (t.responsavelId && colabIds.has(t.responsavelId)) {
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
        if (iso >= inicio && iso <= fim) { const who = t.concluidaPorId || t.responsavelId; if (who && colabIds.has(who)) { const s = ensure(who); s.feitoCount++; s.feitoMin += dur; totalTarefas++; totalMin += dur; } }
      }
    } else {
      Object.entries(t.conclusoes || {}).forEach(([iso, c]) => {
        if (iso >= inicio && iso <= fim) { const who = c.userId || t.responsavelId; if (who && colabIds.has(who)) { const s = ensure(who); s.feitoCount++; s.feitoMin += dur; totalTarefas++; totalMin += dur; } }
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
          <button onClick={() => navegar(-1)} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: 8 }}><ChevronLeft size={18} /></button>
          <div className="font-bold capitalize" style={{ color: C.pastoEsc }}>{label}</div>
          <button onClick={() => navegar(1)} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: 8 }}><ChevronRight size={18} /></button>
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
        <div style={{ position: "absolute", top: 48, left: 0, right: 0, background: C.card, border: `1px solid ${C.linha}`, borderRadius: 12, boxShadow: "0 8px 24px #0002", zIndex: 30, maxHeight: 240, overflowY: "auto" }}>
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
  // Para colaborador, o responsável padrão é a Ana Carolina (se existir); senão, ele mesmo.
  const respPadrao = (eu?.papel === "colaborador" && users.find((u) => u.ativo !== false && norm(u.nome).startsWith("ana carolina"))?.id) || eu?.id;
  const [f, setF] = useState(() => task || { titulo: "", descricao: "", responsavelId: respPadrao, setor: eu?.setor || "", tipo: "unica", freq: "diaria", dias: [], intervaloSemanas: 1, data: hojeISO(), dataInicio: hojeISO(), horaInicio: "", horaFim: "", imagemUrl: null, imagens: [], ehCompra: !!ehCompraInicial, darEntrada: true, compra: { itens: [] } });
  const [salvandoImg, setSalvandoImg] = useState(false);
  // Enquanto salva, o botão trava (toque duplo criava a tarefa/compra duas vezes).
  const [salvando, setSalvando] = useState(false); const salvandoRef = useRef(false);
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

  // Lista padrão: um modelo de compra (tabela compra_padrao). Qualquer um puxa os itens
  // para a compra e edita à vontade; só o administrador troca o modelo.
  const usarListaPadrao = async () => {
    const { data, error } = await supabase.from("compra_padrao").select("produto_id, quantidade");
    if (error) { showToast(/compra_padrao/.test(error.message) ? "A lista padrão ainda não foi ativada no banco." : "Não consegui abrir a lista padrão: " + error.message); return; }
    if (!data.length) { showToast(souAdmin ? "Lista padrão vazia. Monte uma compra e toque em “Salvar como lista padrão”." : "Ainda não existe lista padrão."); return; }
    const ja = new Set(itens.map((i) => i.produtoId));
    const novos = data.filter((r) => !ja.has(r.produto_id) && produtos.some((p) => p.id === r.produto_id)).map((r) => ({ id: uid(), produtoId: r.produto_id, quantidade: Number(r.quantidade) }));
    setItens([...itens, ...novos]);
    showToast(novos.length ? `${novos.length} ${novos.length === 1 ? "item adicionado" : "itens adicionados"} da lista padrão` : "Os itens da lista padrão já estão na compra");
  };
  const salvarListaPadrao = async () => {
    if (!(await Dialog.confirm({ titulo: "Lista padrão", mensagem: `Salvar estes ${itens.length} itens como a lista padrão? A lista anterior será substituída.`, okLabel: "Salvar" }))) return;
    const soma = new Map();
    itens.forEach((i) => soma.set(i.produtoId, (soma.get(i.produtoId) || 0) + (parseFloat(i.quantidade) || 0)));
    const del = await supabase.from("compra_padrao").delete().not("produto_id", "is", null);
    const ins = del.error ? del : await supabase.from("compra_padrao").insert([...soma].filter(([, q]) => q > 0).map(([produto_id, quantidade]) => ({ produto_id, quantidade })));
    showToast(ins.error ? (/compra_padrao/.test(ins.error.message) ? "A lista padrão ainda não foi ativada no banco." : "Não consegui salvar a lista padrão: " + ins.error.message) : "Lista padrão salva ✓");
  };

  const escolherImg = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setSalvandoImg(true);
    try { const urls = []; for (const file of files) urls.push(await uploadFoto(file)); setF((p) => ({ ...p, imagens: [...(p.imagens || []), ...urls] })); }
    catch (err) { console.error("uploadFoto", err); window.alert("Não consegui salvar a foto. Confira a internet e tente de novo.\n\nDetalhe: " + (err?.message || err)); }
    setSalvandoImg(false); e.target.value = "";
  };
  const toggleDia = (d) => set("dias", f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d]);
  const abrirCadastroTexto = (texto) => { setNp((p) => ({ ...p, nome: texto })); setNovoProd(true); };
  const salvarNovoProduto = async () => { if (!np.nome.trim()) return; const criado = await onCadastrarProduto({ nome: np.nome.trim(), categoria: np.categoria, subcategoria: np.categoria === "Combustível" ? np.subcategoria : "", unidade: np.unidade }); if (criado) { setAddProdId(criado.id); setAddKey((k) => k + 1); } setNovoProd(false); setNp({ nome: "", categoria: "Supermercado", subcategoria: "", unidade: "un" }); };

  // O setor da tarefa vem do responsável; só é escolhido à mão quando não dá pra deduzir.
  const respSetor = users.find((u) => u.id === f.responsavelId)?.setor || "";
  const semDiaSelecionado = f.tipo === "recorrente" && f.freq === "semanal" && (f.dias || []).length === 0;
  const podeSalvar = (f.ehCompra ? itens.length > 0 : !!f.titulo.trim()) && !semDiaSelecionado;
  const submit = async () => {
    if (!podeSalvar || salvandoRef.current) return;
    const dados = { ...f, setor: respSetor || f.setor || "" };
    if (f.ehCompra) {
      dados.compra = { itens };
      if (!dados.titulo.trim()) dados.titulo = "Compras";
    }
    salvandoRef.current = true; setSalvando(true);
    try { await onSalvar(dados); } finally { salvandoRef.current = false; setSalvando(false); }
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
          <button onClick={usarListaPadrao} className="flex items-center justify-center gap-2 mb-3" style={{ width: "100%", background: C.card, border: `1.5px dashed ${C.ambar}`, color: C.terra, borderRadius: 10, padding: 11, fontWeight: 700, fontSize: 14 }}><ListTodo size={17} style={{ color: C.ambar }} /> Usar lista padrão</button>
          <div style={lblSt}>Adicionar produto</div>
          <ProdutoAutocomplete key={addKey} produtos={produtos} valorId={addProdId} onSelecionar={setAddProdId} onCadastrarTexto={abrirCadastroTexto} />
          {novoProd && (
            <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2.5 mt-2">
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
              <div key={it.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2 mb-1.5 flex items-center gap-2">
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p ? p.nome : "Produto"}</div>{p && <div style={{ color: C.cinzaClaro, fontSize: 11.5 }}>{p.subcategoria ? p.subcategoria + " · " : ""}{p.categoria}</div>}</div>
                <b style={{ color: C.pastoEsc, whiteSpace: "nowrap" }}>{it.quantidade} {p?.unidade || ""}</b>
                <button onClick={() => removerItem(it.id)} style={{ color: C.vermelho, padding: 4 }}><X size={16} /></button>
              </div>
            ); })}
            {souAdmin && itens.length > 0 && <button onClick={salvarListaPadrao} className="flex items-center gap-1.5 mt-1" style={{ color: C.lago, fontWeight: 600, fontSize: 13, padding: "4px 0" }}><Star size={14} /> Salvar como lista padrão</button>}
          </div>
          <div style={{ borderTop: `1px dashed ${C.cinzaClaro}`, marginTop: 12, paddingTop: 10 }} className="flex items-center gap-3">
            <div className="flex-1">
              <div style={{ fontWeight: 600, fontSize: 14, color: C.terra }}>Dar entrada no estoque ao concluir</div>
              <div style={{ color: C.cinza, fontSize: 12 }}>{f.darEntrada !== false ? "Os itens entram no estoque quando a compra for concluída." : "Compra só de registro — não mexe no estoque."}</div>
            </div>
            <Toggle on={f.darEntrada !== false} onToggle={() => set("darEntrada", !(f.darEntrada !== false))} />
          </div>
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

      <Campo label={f.ehCompra ? "Fotos (opcional) — lista, receita, foto do produto…" : "Fotos de referência (opcional)"}>
        {(f.imagens || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {f.imagens.map((url, i) => (
              <div key={i} style={{ position: "relative", width: 84, height: 84 }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: `1px solid ${C.linha}` }} />
                <button onClick={() => setF((p) => ({ ...p, imagens: p.imagens.filter((_, k) => k !== i) }))} style={{ position: "absolute", top: -6, right: -6, background: "#000c", color: "#fff", borderRadius: 999, padding: 4, display: "flex" }}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {salvandoImg ? (
          <div style={{ width: "100%", border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 16, color: C.cinza, textAlign: "center", fontWeight: 600 }}>Enviando…</div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => camRef.current?.click()} style={{ flex: 1, border: `1px dashed ${C.cinzaClaro}`, borderRadius: 12, padding: 14, color: C.cinza, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600 }}><Camera size={18} /> Tirar foto</button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, border: `1px dashed ${C.cinzaClaro}`, borderRadius: 14, padding: 14, color: C.cinza, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontWeight: 600 }}><Images size={18} /> Da galeria</button>
          </div>
        )}
        {(f.imagens || []).length > 0 && <div style={{ color: C.cinzaClaro, fontSize: 11.5 }} className="mt-1.5">Você pode adicionar mais fotos.</div>}
        <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={escolherImg} style={{ display: "none" }} />
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={escolherImg} style={{ display: "none" }} />
      </Campo>

      {semDiaSelecionado && <div style={{ color: C.vermelho, fontSize: 13 }} className="mb-2">Escolha pelo menos um dia da semana.</div>}
      <button disabled={!podeSalvar || salvando} onClick={submit} style={{ width: "100%", background: podeSalvar && !salvando ? C.pasto : C.cinzaClaro, color: "#fff", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, marginTop: 4 }}>{salvando ? "Salvando…" : task ? "Salvar alterações" : "Criar tarefa"}</button>
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
          <div key={it.id} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10 }} className="p-2 mb-1.5 flex items-center gap-2">
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
function DetalheTarefaModal({ t, users, produtos, podeEditar, onFechar, onEditar }) {
  const [zoomUrl, setZoomUrl] = useState(null);
  const iso = hojeISO();
  const feito = isConcluida(t, iso);
  const concluinteId = t.tipo === "unica" ? t.concluidaPorId : (t.conclusoes && t.conclusoes[iso] ? t.conclusoes[iso].userId : null);
  const fotoFeito = t.tipo === "unica" ? t.fotoConclusaoUrl : (t.conclusoes && t.conclusoes[iso] ? t.conclusoes[iso].fotoUrl : null);
  const fotos = t.imagens && t.imagens.length ? t.imagens : (t.imagemUrl ? [t.imagemUrl] : []);
  const itens = t.ehCompra ? itensDaCompra(t) : [];
  const Linha = ({ icon: Ic, label, valor }) => (
    <div className="flex items-start gap-2 py-2.5" style={{ borderTop: `1px solid ${C.bg}` }}>
      <Ic size={16} style={{ color: C.cinzaClaro, marginTop: 2, flexShrink: 0 }} />
      <div className="flex-1"><div style={{ fontSize: 11.5, color: C.cinza }}>{label}</div><div style={{ fontSize: 14.5, color: C.terra, fontWeight: 600 }}>{valor}</div></div>
    </div>
  );
  return (
    <Sheet titulo={t.ehCompra ? "Detalhes da compra" : "Detalhes da tarefa"} onFechar={onFechar}>
      <div className="font-bold text-lg" style={{ color: C.terra }}>{t.titulo}</div>
      {t.descricao && <div style={{ color: C.cinza }} className="text-sm mt-1">{t.descricao}</div>}
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {fotos.map((url, i) => (
            <button key={i} onClick={() => setZoomUrl(url)} style={{ position: "relative", width: fotos.length === 1 ? "100%" : "calc(50% - 4px)", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.linha}` }}>
              <img src={url} alt={"Foto " + (i + 1)} style={{ display: "block", width: "100%", height: fotos.length === 1 ? "auto" : 130, maxHeight: 240, objectFit: "cover" }} />
              <span style={{ position: "absolute", right: 6, bottom: 6, background: "#0009", color: "#fff", borderRadius: 999, padding: 5, display: "inline-flex" }}><Search size={13} /></span>
            </button>
          ))}
        </div>
      )}
      {t.ehCompra && (
        <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="p-3 mt-3">
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.cinza }} className="mb-1.5">Itens da compra{itens.length ? ` (${itens.length})` : ""}</div>
          {itens.length === 0 && <div style={{ color: C.cinzaClaro, fontSize: 13 }}>Sem itens.</div>}
          {itens.map((it, i) => { const pr = (produtos || []).find((x) => x.id === it.produtoId); return (
            <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderTop: i ? `1px solid ${C.bg}` : "none" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: C.ambar, flexShrink: 0 }} />
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: 14 }}>{pr ? pr.nome : "Produto"}{pr?.subcategoria ? " · " + pr.subcategoria : ""}</span>
              <b style={{ color: C.pastoEsc, whiteSpace: "nowrap" }}>{it.quantidade} {pr?.unidade || ""}</b>
            </div>
          ); })}
          <div style={{ color: C.cinza, fontSize: 12 }} className="flex items-center gap-1 mt-2 pt-2" ><Package size={13} style={{ color: C.cinzaClaro }} /> {t.darEntrada === false ? "Só registro — não entra no estoque." : "Ao concluir, os itens entram no estoque."}</div>
        </div>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 14 }} className="px-3 py-0.5 mt-3">
        <Linha icon={User} label="Responsável" valor={nomeUser(users, t.responsavelId)} />
        {!t.ehCompra && <Linha icon={Users} label="Setor" valor={t.setor || "—"} />}
        <Linha icon={t.tipo === "recorrente" ? Repeat : CalendarDays} label="Quando" valor={t.tipo === "recorrente" ? textoRecorrencia(t) : (t.data ? fmtData(t.data) : "—")} />
        {!t.ehCompra && <Linha icon={Clock} label="Horário" valor={(t.horaInicio || t.horaFim) ? `${t.horaInicio || "?"}${t.horaFim ? " – " + t.horaFim : ""}` : "—"} />}
        <Linha icon={Check} label="Situação" valor={feito ? (concluinteId ? "Feito por " + nomeUser(users, concluinteId) : (t.ehCompra ? "Comprada" : "Concluída")) : "Pendente"} />
      </div>
      {fotoFeito && (<>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: C.cinza }} className="mt-3 mb-1">Foto da conclusão</div>
        <button onClick={() => setZoomUrl(fotoFeito)} style={{ display: "block", width: "100%", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.linha}` }}><img src={fotoFeito} alt="Foto da conclusão" style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} /></button>
      </>)}
      {podeEditar && <button onClick={() => { onFechar(); onEditar(t); }} className="flex items-center justify-center gap-2" style={{ width: "100%", marginTop: 16, background: C.pasto, color: "#fff", borderRadius: 12, padding: 13, fontWeight: 700 }}><Pencil size={17} /> Editar {t.ehCompra ? "compra" : "tarefa"}</button>}
      {zoomUrl && (
        <div onClick={() => setZoomUrl(null)} style={{ position: "fixed", inset: 0, background: "#000000e8", zIndex: 96, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={zoomUrl} alt="Foto ampliada" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
          <button onClick={() => setZoomUrl(null)} title="Fechar" style={{ position: "fixed", top: 16, right: 16, background: "#ffffff26", color: "#fff", borderRadius: 999, padding: 10, display: "flex" }}><X size={22} /></button>
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
  const escolher = async (e) => { const file = e.target.files?.[0]; if (!file) return; setSalvando(true); try { const u = await uploadFoto(file); setFoto(u); setUrl(u); } catch (err) { console.error("uploadFoto", err); window.alert("Não consegui salvar a foto. Confira a internet e tente de novo.\n\nDetalhe: " + (err?.message || err)); } setSalvando(false); };
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
const inpSt = { width: "100%", border: `1px solid ${C.linha}`, borderRadius: 10, padding: "11px 12px", fontSize: 15, background: C.card, outline: "none", color: C.terra, boxSizing: "border-box", fontFamily: "inherit" };
const lblSt = { fontSize: 12.5, fontWeight: 600, color: C.cinza, marginBottom: 5 };
function Campo({ label, children }) { return <div className="mb-3"><div style={lblSt}>{label}</div>{children}</div>; }
function Chip({ icon: Ic, texto, cor }) { return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: alfa(cor, 10), color: cor, borderRadius: 999, padding: "3px 9px", fontSize: 12, fontWeight: 600 }}>{Ic && <Ic size={12} />}{texto}</span>; }
function Toggle({ on, onToggle }) { return (<button onClick={onToggle} style={{ width: 46, height: 27, borderRadius: 999, background: on ? C.ambar : C.cinzaClaro, position: "relative" }}><span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: 999, background: C.card }} /></button>); }
function Vazio({ icon: Ic, titulo, texto }) { return (<div className="text-center py-10"><div style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 999, width: 62, height: 62, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Ic size={28} style={{ color: C.cinzaClaro }} /></div><div className="font-bold" style={{ color: C.terra }}>{titulo}</div><div style={{ color: C.cinza }} className="text-sm mt-1 px-6">{texto}</div></div>); }
function DialogHost() {
  const [d, setD] = React.useState(null);
  const [texto, setTexto] = React.useState("");
  React.useEffect(() => { _openDialog = (dd) => { setTexto(dd.valor != null ? String(dd.valor) : ""); setD(dd); }; return () => { _openDialog = null; }; }, []);
  if (!d) return null;
  const fechar = (val) => { const r = d.resolve; setD(null); r(val); };
  return React.createElement("div", { style: { position: "fixed", inset: 0, background: "#0007", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }, onClick: () => fechar(d.tipo === "confirm" ? false : null) },
    React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: C.card, borderRadius: 16, width: "100%", maxWidth: 360, padding: 18, boxShadow: "0 12px 34px #0004" } },
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
// topo (px): o popup começa ali (ex.: logo abaixo do cabeçalho) e ocupa até o fim da tela;
// o conteúdo vira uma coluna que pode esticar (flex: 1) para preencher a altura.
// Enquanto houver popup aberto, a tela de trás não rola (contador: popups um sobre o outro).
let _travasRolagem = 0;
function useTravarRolagem() {
  useEffect(() => {
    const el = document.documentElement;
    if (_travasRolagem++ === 0) { el.style.overflow = "hidden"; document.body.style.overflow = "hidden"; }
    return () => { if (--_travasRolagem === 0) { el.style.overflow = ""; document.body.style.overflow = ""; } };
  }, []);
}
function Sheet({ titulo, onFechar, children, topo }) {
  useTravarRolagem();
  const cheio = topo != null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0006", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, width: "100%", maxWidth: 460, borderTopLeftRadius: 22, borderTopRightRadius: 22,
        ...(cheio ? { height: `calc(100dvh - ${topo}px)`, display: "flex", flexDirection: "column", overflow: "hidden" } : { maxHeight: "92dvh", overflowY: "auto" }) }}>
        <div style={{ position: "sticky", top: 0, background: C.bg, padding: "16px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2, flexShrink: 0 }}><div className="font-bold text-lg">{titulo}</div><button onClick={onFechar} style={{ background: C.card, borderRadius: 999, padding: 7, border: `1px solid ${C.linha}` }}><X size={18} /></button></div>
        <div className="px-4 pb-6" style={cheio ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>{children}</div>
      </div>
    </div>
  );
}
