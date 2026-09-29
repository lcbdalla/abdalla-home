import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ListTodo, CalendarDays, ShoppingCart, Package, Users, Plus, Check,
  Camera, Bell, X, Trash2, Pencil, Info, MapPin, Fuel, Wrench, Wine,
  ShoppingBasket, Repeat, Clock, User, RefreshCw, Star, Smartphone, Tag, Lock, Search, ArrowDownToLine, ArrowUpFromLine, Mail, LogOut, KeyRound, BarChart3, ChevronLeft, ChevronRight, UserPlus, MessageCircle, Copy, Shuffle, CheckCircle2, MoreVertical, Images, Home, Moon, Sun, Power, Layers,
  ChevronDown, Lightbulb, Fan, Snowflake, Tv, Droplets, Blinds, DoorOpen, DoorClosed, LockOpen, Gauge
} from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "./supabaseClient";

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
const mapPerfil = (r) => ({ id: r.id, nome: r.nome, papel: r.papel, telefone: r.telefone || "", setor: r.setor || "", ativo: r.ativo !== false, podeControle: r.pode_controle === true, podeGerirControle: r.pode_gerir_controle === true, podeMenuControle: r.pode_menu_controle === true, expiraEm: r.expira_em ? new Date(r.expira_em).getTime() : null });
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

  // ---------- Telas de porta de entrada ----------
  if (session === undefined || perfil === undefined) return <TelaCarregando />;
  if (!session) return logandoQR ? <TelaCarregando /> : (<><LoginScreen /><InstalarPrompt /><DialogHost /></>);
  if (perfil === "removido") return (<><AcessoRemovido onSair={sair} /><DialogHost /></>);
  if (perfil === "expirado") return (<><AcessoExpirado onSair={sair} /><DialogHost /></>);
  // Criança e visitante: só o Controle da Casa, sem o app de tarefas (nem carregam os dados dele).
  if (souCrianca || souVisitante) {
    return <ControleApp eu={eu} onSair={sair} />;
  }
  if (!carregado) return <TelaCarregando />;

  // App separado de Controle da Casa (mesmo login), aberto por #controle.
  if (rota === "controle") {
    return (eu?.podeControle || eu?.podeGerirControle)
      ? <ControleApp eu={eu} onVoltar={() => { window.location.hash = ""; }} onSair={sair}
          onEquipe={souAdmin ? () => { setAba("equipe"); window.location.hash = ""; } : null}
          onSobre={souAdmin ? () => { setInfoAberto(true); window.location.hash = ""; } : null} />
      : <ControleSemAcesso onVoltar={() => { window.location.hash = ""; }} />;
  }

  const ABAS = [
    { id: "tarefas", nome: "Tarefas", icon: ListTodo },
    { id: "agenda", nome: "Agenda", icon: CalendarDays },
    { id: "compras", nome: "Compras", icon: ShoppingCart },
    { id: "estoque", nome: "Estoque", icon: Package },
    ...(souAdmin ? [{ id: "painel", nome: "Painel", icon: BarChart3 }] : []), // Equipe fica no menu ⋮
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: C.terra }}>
      <div className="mx-auto" style={{ maxWidth: 460, position: "relative", minHeight: "100vh", paddingBottom: 88, background: C.bg }}>

        <header style={{ background: C.cabecalho, color: "#fff", padding: "14px 16px 14px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div style={{ background: "#ffffff22", borderRadius: 12, padding: 7 }}><MapPin size={20} /></div>
              <div><div className="font-bold text-lg leading-tight">Abdalla Home</div><div style={{ color: "#ffffffcc" }} className="text-xs leading-tight">Rancho Abdalla</div></div>
            </div>
            <div className="flex items-center gap-2">
              <MenuPontinhos aberto={menuAberto} setAberto={setMenuAberto} itens={[
                ...(!estaInstalado() ? [{ key: "inst", icon: ArrowDownToLine, cor: C.pasto, txt: "Instalar app", on: () => _installOpen.fn && _installOpen.fn() }] : []),
                ...(souAdmin ? [{ key: "equipe", icon: Users, cor: C.pasto, txt: "Equipe", on: () => setAba("equipe") }] : []),
                { key: "tema", icon: tema === "dark" ? Sun : Moon, cor: C.ambar, txt: tema === "dark" ? "Modo claro" : "Modo noturno", on: alternarTema },
                ...(eu?.podeControle ? [{ key: "controle", icon: Home, cor: C.lago, txt: "Controle da casa", on: () => { window.location.hash = "controle"; } }] : []),
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
        {modal?.tipo === "detalhe" && <DetalheTarefaModal {...{ t: modal.task, users, produtos, podeEditar: podeMexer(modal.task), onFechar: () => setModal(null), onEditar: (t) => setModal({ tipo: "tarefa", task: t }) }} />}
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
            <button onClick={atualizarAgora} style={{ background: C.card, color: C.pastoEsc, borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 14 }}>Atualizar</button>
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
function EquipeView({ users, souAdmin, euId, showToast, onRecarregar }) {
  const [novo, setNovo] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const editar = async (id, campo, valor) => {
    const { error } = await supabase.from("perfis").update({ [campo]: valor }).eq("id", id);
    if (error) { showToast("Erro ao salvar: " + error.message); return; }
    onRecarregar();
  };
  const alternarPapel = async (u) => {
    if (u.papel === "crianca") { showToast("Conta de criança: mude a função pelo campo, se precisar."); return; }
    const { error } = await supabase.from("perfis").update({ papel: u.papel === "admin" ? "colaborador" : "admin" }).eq("id", u.id);
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
                <input key={"n" + u.id + u.nome} defaultValue={u.nome} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.nome) editar(u.id, "nome", v); }} placeholder="Nome da pessoa" style={{ flex: 1, border: "none", background: "transparent", fontWeight: 600, fontSize: 15, outline: "none" }} />
              ) : (
                <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{u.nome}</div>
              )}
              <span style={{ color: C.cinzaClaro, fontSize: 12 }}>{(u.papel === "visitante" && u.expiraEm && Date.now() > u.expiraEm) ? "Visitante (expirado)" : papelLabel(u.papel)}</span>
              {souAdmin && u.id !== euId && <button onClick={() => remover(u)} title="Remover pessoa" style={{ color: C.vermelho, padding: 4 }}><Trash2 size={16} /></button>}
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
            {souAdmin && (<>
              <div className="flex items-center gap-2 mt-1.5" style={{ paddingLeft: 40 }}>
                <Home size={13} style={{ color: C.cinzaClaro }} />
                <div className="flex-1" style={{ fontSize: 13, color: C.cinza }}>Pode controlar a casa</div>
                <Toggle on={u.podeControle === true} onToggle={() => editar(u.id, "pode_controle", !(u.podeControle === true))} />
              </div>
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
    </div>
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
      body: { nome: "Visitante", email, senha, telefone: "", papel: "colaborador", setor: "" },
    });
    if (error || data?.error) { setErro(await erroDaFuncao(error, data)); setCriando(false); return; }
    const ate = new Date(Date.now() + d * 86400000);
    if (data?.id) {
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
];
const CTRL_TIPO_NOME = Object.fromEntries(CTRL_TIPOS.map((t) => [t.id, t.nome]));
const CTRL_EMOJI = { interruptor: "💡", persiana: "🪟", ar: "❄️", tv: "📺", irrigacao: "💧", fechadura: "🔒", sensor: "📊" };
const CTRL_LARGO = ["ar", "tv", "persiana", "irrigacao"]; // ocupam a linha inteira (têm mais botões)
const CTRL_COMPACTAVEL = ["ar", "persiana"]; // começam pequenos; tocar no quadro amplia; encolhem ao recarregar
// Botões de ação que dá para renomear, por tipo de aparelho. [chave, nome padrão].
const ROTULOS_POR_TIPO = {
  persiana: [["abrir", "Abrir"], ["parar", "Parar"], ["fechar", "Fechar"]],
};
const rotulo = (e, chave, padrao) => (e?.rotulos && e.rotulos[chave]) || padrao;

// Só guardamos/ouvimos estes domínios: evita a enxurrada de eventos de câmeras,
// sensores e switches de rede (isso causava lentidão / "lag" na tela).
const HA_SHOW = new Set(["light", "switch", "climate", "fan", "media_player", "cover", "lock", "input_boolean"]);
const ABERTOS_TTL = 8 * 3600000; // 8h sem uso: o Controle volta a mostrar só os pavimentos
const PROXY_FN = "controle-proxy"; // intermediário no servidor (supabase/functions/controle-proxy)
// Grupo de luz (entidade light que só junta outras) — não mostramos para não duplicar.
const ehGrupoLuz = (id, attrs) => id.split(".")[0] === "light" && Array.isArray(attrs?.entity_id);
// Domínios que aparecem para o gestor escolher (o resto é ruído).
const HA_ESCOLHIVEIS = ["light", "switch", "fan", "cover", "climate", "media_player", "lock", "input_boolean"];

// Sugere um tipo de controle a partir do identificador do aparelho (ex.: climate.sala).
function tipoSugerido(entityId) {
  const d = String(entityId).split(".")[0];
  if (d === "cover") return "persiana";
  if (d === "climate") return "ar";
  if (d === "media_player") return "tv";
  if (d === "lock") return "fechadura";
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

/* ---- Contagem "ligados/total" e "Desligar tudo" ---- */
// Só entra o que liga/desliga: persiana/portão, fechadura e sensor ficam de fora.
const ehDesligavel = (e) => !["persiana", "fechadura", "sensor"].includes(e.tipo);
const estaLigado = (e) => {
  if (!e.disponivel) return false;
  if (e.tipo === "ar") return e.state !== "off";
  if (e.tipo === "tv") return !["off", "idle", "standby"].includes(e.state);
  return e.state === "on";
};
const servicoDesligar = (e) => (e.tipo === "ar" ? ["climate", "turn_off"] : e.tipo === "tv" ? ["media_player", "turn_off"] : ["homeassistant", "turn_off"]);
const contarLigados = (itens) => { const d = itens.filter(ehDesligavel); return { on: d.filter(estaLigado).length, total: d.length }; };

// Cabeçalho de pavimento/cômodo: nome · [Desligar tudo] · ligados/total ⌄ (tocar abre/fecha).
// A coluna da direita tem largura fixa: o botão "Desligar tudo" fica na mesma linha vertical
// em todos os níveis, com qualquer quantidade de aparelhos.
function CabecalhoNivel({ nome, sub, grande, aberto, onAlternar, itens, onDesligarTudo }) {
  const { on, total } = contarLigados(itens);
  const aceso = on > 0;
  const toque = { background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: grande ? 52 : 44 };
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <button onClick={onAlternar} aria-expanded={aberto} className="flex-1 min-w-0 flex items-center text-left" style={{ ...toque, gap: grande ? 8 : 10 }}>
        {grande ? (
          // Pavimento: selo com ícone que "acende" quando há algo ligado lá dentro.
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: aceso ? alfa(C.ambar, 20) : alfa(C.cinzaClaro, 16), color: aceso ? C.ambar : C.cinzaClaro,
            boxShadow: aceso ? `0 0 0 1px ${alfa(C.ambar, 32)}, 0 6px 18px -6px ${alfa(C.ambar, 70)}` : "none", transition: "background .25s, color .25s, box-shadow .25s" }}>
            <Layers size={16} strokeWidth={2.1} />
          </span>
        ) : (
          // Cômodo: pontinho aceso ao lado do nome.
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: aceso ? C.ambar : alfa(C.cinzaClaro, 50),
            boxShadow: aceso ? `0 0 0 3px ${alfa(C.ambar, 22)}, 0 0 10px ${alfa(C.ambar, 80)}` : "none", transition: "background .25s, box-shadow .25s" }} />
        )}
        <span className="min-w-0 flex flex-col">
          <span className="truncate" style={{ fontWeight: grande ? 800 : 650, fontSize: grande ? 16.5 : 15, color: C.terra, letterSpacing: grande ? "-0.01em" : 0, lineHeight: 1.2 }}>{nome}</span>
          {sub && (
            <span className="truncate" style={{ fontSize: 12, color: C.cinza, marginTop: 2 }}>
              {aceso ? <b style={{ color: C.ambarTexto, fontWeight: 700 }}>{on} {on === 1 ? "ligado" : "ligados"}</b> : sub}
            </span>
          )}
        </span>
      </button>
      {total > 0 && (
        <button onClick={() => onDesligarTudo(itens)} disabled={!aceso} aria-label={`Desligar tudo em ${nome}`}
          className="flex items-center" style={{ flexShrink: 0, gap: 4, height: 30, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
            border: `1px solid ${aceso ? alfa(C.vermelho, 35) : C.linha}`, background: aceso ? C.vermelhoClaro : "transparent", color: aceso ? C.vermelho : C.cinzaClaro,
            cursor: aceso ? "pointer" : "default", transition: "background .2s, color .2s, border-color .2s" }}>
          <Power size={12} strokeWidth={2.4} /> Desligar tudo
        </button>
      )}
      <button onClick={onAlternar} aria-label={aberto ? "Fechar" : "Abrir"} className="flex items-center justify-end" style={{ ...toque, flexShrink: 0, width: 54, gap: 4 }}>
        {total > 0 && (
          <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            <b style={{ color: aceso ? C.ambarTexto : C.cinza, fontWeight: 800 }}>{on}</b><span style={{ color: C.cinzaClaro, fontWeight: 600 }}>/{total}</span>
          </span>
        )}
        <ChevronDown size={18} style={{ color: C.cinza, flexShrink: 0, transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />
      </button>
    </div>
  );
}

// Aparência de cada aparelho: ícone do tipo e a cor quando está "ativo"
// (ligado, aberto, destrancado...). Desligado = ícone apagado.
function visualEquip(e) {
  const dom = String(e.id).split(".")[0];
  const alvo = ((e.nome || "") + " " + e.id).toLowerCase();
  if (e.tipo === "persiana") {
    const inv = ehInvertido(e);
    const aberto = e.disponivel && ((inv ? e.state === "closed" : e.state === "open") || ["opening", "closing"].includes(e.state));
    const portao = /port[aã]o|gate/.test(alvo);
    return { Icon: portao ? (aberto ? DoorOpen : DoorClosed) : Blinds, ativo: aberto, cor: C.ambar };
  }
  if (e.tipo === "ar") return { Icon: Snowflake, ativo: estaLigado(e), cor: C.lago };
  if (e.tipo === "tv") return { Icon: Tv, ativo: estaLigado(e), cor: C.lago };
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
      <PillToggle on={on} cor={C.ambar} disabled={ind} onClick={cardClicavel ? undefined : () => enviar("homeassistant", "toggle", e.id)} />
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
        <PillToggle on={ligado} cor={LAGO} disabled={ind} onClick={() => enviar("climate", ligado ? "turn_off" : "turn_on", e.id)} />
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
function CtrlTv({ e, enviar }) {
  const ind = !e.disponivel;
  const ligado = !["off", "idle", "standby"].includes(e.state) && !ind;
  const mudo = e.attributes?.is_volume_muted === true;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-sm" style={{ color: ind ? C.cinzaClaro : (ligado ? LAGO : C.cinza), fontWeight: 600 }}>{ind ? "Indisponível" : (ligado ? "Ligada" : "Desligada")}</div>
        <PillToggle on={ligado} cor={LAGO} disabled={ind} onClick={() => enviar("media_player", ligado ? "turn_off" : "turn_on", e.id)} />
      </div>
      {ligado && (
        <div className="flex gap-2">
          <BotaoAcao label="Vol −" cor={C.cinza} onClick={() => enviar("media_player", "volume_down", e.id)} />
          <BotaoAcao label="Vol +" cor={C.pasto} onClick={() => enviar("media_player", "volume_up", e.id)} />
          <BotaoAcao label={mudo ? "Som" : "Mudo"} cor={C.ambar} onClick={() => enviar("media_player", "volume_mute", e.id, { is_volume_muted: !mudo })} />
          <BotaoAcao label="Play/Pausa" cor={LAGO} onClick={() => enviar("media_player", "media_play_pause", e.id)} />
        </div>
      )}
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
function CtrlFechadura({ e, enviar }) {
  const ind = !e.disponivel; const trancado = e.state === "locked";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 text-sm" style={{ color: ind ? C.cinzaClaro : (trancado ? C.pasto : C.ambar), fontWeight: 700 }}>{ind ? "Indisponível" : (trancado ? "Trancado" : "Destrancado")}</div>
      <BotaoAcao icon={Lock} label={trancado ? "Destrancar" : "Trancar"} cor={trancado ? C.ambar : C.pasto} disabled={ind} onClick={() => enviar("lock", trancado ? "unlock" : "lock", e.id)} />
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
  if (e.tipo === "tv") return <CtrlTv e={e} enviar={enviar} />;
  if (e.tipo === "irrigacao") return <CtrlIrrigacao e={e} enviar={enviar} />;
  if (e.tipo === "fechadura") return <CtrlFechadura e={e} enviar={enviar} />;
  if (e.tipo === "sensor") return <CtrlSensor e={e} />;
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
      <span style={{ marginLeft: "auto" }}><PillToggle pequeno on={ligado} cor={C.lago} disabled={ind} onClick={(ev) => { ev.stopPropagation(); enviar("climate", ligado ? "turn_off" : "turn_on", e.id); }} /></span>
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
function EquipCard({ e, enviar, expandido, onExpandir, editando }) {
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
      style={{ background: ativo ? `color-mix(in srgb, ${v.cor} 10%, ${C.card})` : C.bg, border: `1px solid ${ativo ? alfa(v.cor, 38) : "transparent"}`,
        borderRadius: 16, height: "100%", padding: 12, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10,
        cursor: cardClick ? "pointer" : "default", transition: "background .25s, border-color .25s" }}>
      <div className="flex items-center" onClick={!editando && compactavel && expandido ? (ev) => { ev.stopPropagation(); onExpandir(); } : undefined} style={{ gap: 10, cursor: compactavel && !editando ? "pointer" : "default" }}>
        <IconeEquip v={v} disponivel={e.disponivel} />
        <div className="flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 650, color: C.terra, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{e.nome}</div>
        {e.tipo === "persiana" && !compacto && (() => { const st = estadoPersiana(e); return <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: st.cor }}>{st.texto}</span>; })()}
        {compactavel && !grande && !editando && <ChevronDown size={16} style={{ color: C.cinzaClaro, flexShrink: 0, transform: expandido ? "none" : "rotate(-90deg)", transition: "transform .22s cubic-bezier(.25,1,.5,1)" }} />}
      </div>
      {compacto
        ? (e.tipo === "ar" ? <CtrlArCompacto e={e} enviar={enviar} /> : <CtrlPersianaCompacto e={e} enviar={enviar} />)
        : <EquipControle e={e} enviar={enviar} cardClicavel={e.tipo === "interruptor" && !!cardClick} />}
    </div>
  );
}

/* ---- Modo GERENCIAR (só gestor) ---- */
function SeletorAparelho({ ents, areas, usados, onEscolher, onFechar }) {
  const [busca, setBusca] = useState("");
  const lista = Object.entries(ents)
    .map(([id, v]) => ({ id, dom: id.split(".")[0], nome: v.attributes?.friendly_name || id, area: (areas && areas[id]) || "" }))
    .filter((x) => HA_ESCOLHIVEIS.includes(x.dom) && !usados.has(x.id))
    .filter((x) => (x.nome + " " + x.id + " " + x.area).toLowerCase().includes(busca.toLowerCase()))
    // Ordena por área (ambiente do HA) e depois por nome, para facilitar achar.
    .sort((a, b) => (a.area || "~").localeCompare(b.area || "~") || a.nome.localeCompare(b.nome))
    .slice(0, 80);
  return (
    <div style={{ border: `1px dashed ${LAGO}66`, borderRadius: 12, background: C.lagoClaro, padding: 10, marginTop: 8 }}>
      <div className="flex items-center gap-2 mb-2">
        <Search size={16} style={{ color: C.cinza }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome ou ambiente…" style={{ ...inpControle, background: C.card }} autoFocus />
        <button onClick={onFechar} style={{ background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: 8 }}><X size={16} /></button>
      </div>
      {Object.keys(ents).length === 0 && <div style={{ color: C.cinza, fontSize: 13 }} className="py-2 text-center">Conecte-se ao Home Assistant (↻ no topo) para listar os aparelhos.</div>}
      {lista.length === 0 && Object.keys(ents).length > 0 && <div style={{ color: C.cinza, fontSize: 13 }} className="py-2 text-center">Nenhum aparelho novo encontrado.</div>}
      {areas === null && Object.keys(ents).length > 0 && <div style={{ color: C.cinzaClaro, fontSize: 11.5 }} className="pb-2 text-center">Carregando os ambientes do Home Assistant…</div>}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {lista.map((x) => (
          <button key={x.id} onClick={() => onEscolher(x.id)} style={{ width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.linha}`, borderRadius: 10, padding: "9px 11px", marginBottom: 6, cursor: "pointer" }}>
            <div className="flex items-center gap-2">
              <Plus size={15} style={{ color: C.pasto, flexShrink: 0 }} />
              <div className="min-w-0" style={{ flex: 1 }}>
                <div className="flex items-center gap-2">
                  <span className="truncate" style={{ fontWeight: 600, fontSize: 14, color: C.terra, flex: 1 }}>{x.nome}</span>
                  {x.area && <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, background: C.lagoClaro, color: LAGO_ESC, border: `1px solid ${LAGO}33`, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}><MapPin size={11} />{x.area}</span>}
                </div>
                <div className="truncate" style={{ fontSize: 11, color: C.cinzaClaro }}>{x.id} · sugerido: {CTRL_TIPO_NOME[tipoSugerido(x.id)]}</div>
              </div>
            </div>
          </button>
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
          ? <SeletorAparelho ents={ents} areas={areas} usados={usados} onEscolher={(entityId) => { onAddEquip(amb.id, entityId); }} onFechar={() => setAbrindoSel(false)} />
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
function GradeEquip({ itens, enviar, expandidos, toggleExpand, podeArrastar, onReordenar, editando, setEditando, onTamanho }) {
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

  const byId = Object.fromEntries(itens.map((e) => [e.dbId, e]));
  const ordenados = ordem.map((id) => byId[id]).filter(Boolean);
  const largoDe = (e) => e.tamanho === "g" || (CTRL_LARGO.includes(e.tipo) && (!CTRL_COMPACTAVEL.includes(e.tipo) || expandidos.has(e.dbId)));

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
    if (!podeArrastar) return;
    longPressed.current = false;
    press.current = { id, pid: e.pointerId, el: e.currentTarget, x: e.clientX, y: e.clientY };
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(pegar, ESPERA_MS);
  }
  function aoMover(e) {
    if (arrastando == null) {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TOL) { clearTimeout(pressTimer.current); press.current = null; }
      return;
    }
    arrastou.current = true; setPos({ x: e.clientX, y: e.clientY }); reordenar(e.clientX, e.clientY);
  }
  function aoSoltar() {
    clearTimeout(pressTimer.current); press.current = null;
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
              onContextMenu={(ev) => { ev.preventDefault(); pegar(); }}
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

function ControleApp({ eu, onVoltar, onSair, onEquipe, onSobre }) {
  const [status, setStatus] = useState("carregando"); // carregando | ok | erro
  const [erro, setErro] = useState("");
  // Cards ampliados (ar/persiana). Começa vazio → ao abrir/recarregar o app, todos encolhidos.
  const [expandidos, setExpandidos] = useState(() => new Set());
  const toggleExpand = (id) => setExpandidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [editando, setEditando] = useState(false);
  const [ents, setEnts] = useState({});
  const [areas, setAreas] = useState(null); // entity_id -> nome da área no Home Assistant
  const [tentativa, setTentativa] = useState(0);
  const [aviso, setAviso] = useState(null);
  const [pavimentos, setPavimentos] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [modo, setModo] = useState("usar"); // usar | gerenciar
  const [menuAberto, setMenuAberto] = useState(false);
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
  const idRef = useRef(1);
  // Família (administrador com controle) fala direto com o Home Assistant: rápido e ao vivo.
  // Os demais (colaborador, criança, visitante) passam pelo intermediário "controle-proxy",
  // que guarda o token no servidor e só libera os aparelhos cadastrados.
  const [usarProxy, setUsarProxy] = useState(() => !(eu?.papel === "admin" && (eu?.podeControle || eu?.podeGerirControle)));
  const proxyRefresh = useRef(null);
  const souGestor = eu?.podeGerirControle === true;
  const pavAberto = (id) => abertos.pavs.includes(id);
  // Fechar o pavimento fecha também o cômodo aberto dentro dele.
  const alternarPav = (id, comodoIds) => setAbertos((a) => a.pavs.includes(id)
    ? { pavs: a.pavs.filter((x) => x !== id), amb: comodoIds.includes(a.amb) ? null : a.amb }
    : { ...a, pavs: [...a.pavs, id] });
  // Abrir um cômodo fecha o anterior.
  const alternarAmb = (id) => setAbertos((a) => ({ ...a, amb: a.amb === id ? null : id }));

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
        (data?.estados || []).forEach((s) => { const dom = s.entity_id.split(".")[0]; if (HA_SHOW.has(dom) && !ehGrupoLuz(s.entity_id, s.attributes)) map[s.entity_id] = { state: s.state, attributes: s.attributes || {} }; });
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
          const tipo = pend[m.id]; delete pend[m.id];
          if (m.success === false) {
            if (tipo === "states") { setErro("Falha ao ler estados: " + (m.error?.message || "")); setStatus("erro"); }
            else if (ativo && !["areas", "devices", "entities"].includes(tipo)) setAviso({ erro: true, texto: "Não consegui executar: " + (m.error?.message || "erro do Home Assistant") });
            return;
          }
          if (tipo === "states") {
            const map = {};
            (m.result || []).forEach((s) => { const dom = s.entity_id.split(".")[0]; if (HA_SHOW.has(dom) && !ehGrupoLuz(s.entity_id, s.attributes)) map[s.entity_id] = { state: s.state, attributes: s.attributes || {} }; });
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
          if (d?.entity_id && HA_SHOW.has(dom) && d.new_state && !ehGrupoLuz(d.entity_id, d.new_state.attributes)) setEnts((p) => ({ ...p, [d.entity_id]: { state: d.new_state.state, attributes: d.new_state.attributes || {} } }));
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

  // ---- Desligar tudo de um pavimento/cômodo: um aparelho por vez, 600 ms entre cada ----
  const desligarTudo = async (itens, nivel) => {
    const alvo = itens.filter((e) => ehDesligavel(e) && estaLigado(e));
    if (!alvo.length) return;
    const ok = await Dialog.confirm({ titulo: "Desligar tudo", mensagem: `Tem certeza que quer desligar tudo em ${nivel}? (${alvo.length} ${alvo.length === 1 ? "aparelho ligado" : "aparelhos ligados"})`, okLabel: "Desligar tudo", perigo: true });
    if (!ok) return;
    for (let i = 0; i < alvo.length; i++) {
      const [dom, serv] = servicoDesligar(alvo[i]);
      enviar(dom, serv, alvo[i].id);
      if (i < alvo.length - 1) await new Promise((r) => setTimeout(r, 600));
    }
  };

  // ---- Envia um comando ao Home Assistant ----
  const enviar = (domain, service, entityId, serviceData) => {
    if (usarProxy) {
      setAviso({ texto: "Comando enviado…" });
      supabase.functions.invoke(PROXY_FN, { body: { acao: "servico", domain, service, entity_id: entityId, data: serviceData || {} } }).then(async ({ error }) => {
        if (error) { let msg = ""; try { msg = (await error.context.json())?.error || ""; } catch { /* sem corpo */ } setAviso({ erro: true, texto: "Não consegui executar: " + (msg || error.message) }); return; }
        setTimeout(() => proxyRefresh.current?.(), 400);  // mostra o novo estado logo
        setTimeout(() => proxyRefresh.current?.(), 1800); // e de novo (persiana e ar demoram)
      });
      setTimeout(() => setAviso((a) => (a && !a.erro ? null : a)), 2000);
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) { setAviso({ erro: true, texto: "A conexão com o Home Assistant caiu. Toque no ↻ (atualizar) no topo e tente de novo." }); return; }
    ws.send(JSON.stringify({ id: idRef.current++, type: "call_service", domain, service, target: { entity_id: entityId }, service_data: serviceData || {} }));
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
    onAddEquip: (ambienteId, entityId) => salvar(supabase.from("controle_equipamentos").insert({ ambiente_id: ambienteId, entity_id: entityId, tipo: tipoSugerido(entityId), ordem: equipamentos.filter((q) => q.ambiente_id === ambienteId).length }), "Aparelho adicionado"),
    onTipoEquip: (id, tipo) => salvar(supabase.from("controle_equipamentos").update({ tipo }).eq("id", id)),
    onNomeEquip: (id, nome) => salvar(supabase.from("controle_equipamentos").update({ nome: nome || null }).eq("id", id)),
    onDelEquip: (id) => salvar(supabase.from("controle_equipamentos").delete().eq("id", id)),
    onReordenar: async (ids) => {
      try { await Promise.all(ids.map((id, i) => supabase.from("controle_equipamentos").update({ ordem: i }).eq("id", id))); }
      catch { setAviso({ erro: true, texto: "Não consegui salvar a nova ordem." }); }
      await carregarConfig();
    },
    onTamanho: (id, tam) => salvar(supabase.from("controle_equipamentos").update({ tamanho: tam === "g" ? "g" : "p" }).eq("id", id)),
    onRotulo: (id, chave, valor) => {
      const q = equipamentos.find((x) => x.id === id);
      const rot = { ...(q?.rotulos || {}) };
      if (valor && valor.trim()) rot[chave] = valor.trim(); else delete rot[chave];
      return salvar(supabase.from("controle_equipamentos").update({ rotulos: rot }).eq("id", id));
    },
  };

  // ---- Monta a lista para o modo "usar" (pavimento -> cômodo -> aparelhos) ----
  const mkEquip = (row) => {
    const live = ents[row.entity_id];
    const state = live?.state;
    return {
      dbId: row.id, id: row.entity_id, tipo: row.tipo,
      nome: row.nome || live?.attributes?.friendly_name || row.entity_id,
      state, attributes: live?.attributes || {}, rotulos: row.rotulos || {}, tamanho: row.tamanho === "g" ? "g" : "p",
      disponivel: state != null && !["unavailable", "unknown", "none", ""].includes(state),
    };
  };
  const semPav = { id: "__sem__", nome: "Outros", ordem: 99999 };
  const listaPav = [...pavimentos, semPav].map((p) => ({
    id: p.id, nome: p.nome, ordem: p.ordem,
    // Visitante só vê os cômodos liberados para ele (o banco e o intermediário também barram).
    comodos: ambientes.filter((a) => (a.pavimento_id || "__sem__") === p.id && (eu?.papel !== "visitante" || a.visitante !== false)).sort((a, b) => a.ordem - b.ordem).map((a) => ({
      id: a.id, nome: a.nome,
      itens: equipamentos.filter((q) => q.ambiente_id === a.id).sort((x, y) => x.ordem - y.ordem).map(mkEquip),
    })).filter((c) => c.itens.length > 0),
  })).filter((p) => p.comodos.length > 0).sort((a, b) => a.ordem - b.ordem);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: C.terra, overflowX: "hidden", width: "100%" }}>
      <div className="mx-auto" style={{ maxWidth: 460, width: "100%", boxSizing: "border-box", minHeight: "100vh", paddingBottom: 30 }}>
        <style>{"@keyframes ah-jig{0%{transform:rotate(-0.7deg)}50%{transform:rotate(0.7deg)}100%{transform:rotate(-0.7deg)}}.ah-jiggle{animation:ah-jig .28s infinite ease-in-out}"}</style>
        <DialogHost />
        <InstalarPrompt />
        {/* Mesmo verde do cabeçalho do app de tarefas, em versão compacta. */}
        <header style={{ background: C.cabecalho, color: "#fff", padding: "10px 12px", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
          <div className="flex items-center gap-2">
            {onVoltar && <button onClick={onVoltar} title="Voltar ao app de tarefas" style={{ background: "#ffffff22", borderRadius: 10, padding: 7, display: "flex" }}><ChevronLeft size={18} /></button>}
            <div style={{ background: "#ffffff22", borderRadius: 10, padding: 6, display: "flex" }}><Home size={18} /></div>
            <div className="flex-1 min-w-0"><div className="font-bold leading-tight truncate" style={{ fontSize: 16 }}>Controle da Casa</div><div style={{ color: "#ffffffcc", fontSize: 11.5 }} className="leading-tight truncate">{modo === "gerenciar" ? "Organizando ambientes" : "Rancho Abdalla"}</div></div>
            {/* Configurando: o "Pronto" fica à vista para voltar; o resto mora no menu ⋮. */}
            {modo === "gerenciar" && <button onClick={() => setModo("usar")} title="Terminar de configurar" style={{ background: "#ffffff33", borderRadius: 10, padding: "7px 11px", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700 }}><Check size={16} /> Pronto</button>}
            {/* O menu ⋮ só aparece para quem tem a chave "Menu ⋮ do Controle" ligada na Equipe. */}
            {eu?.podeMenuControle && (
              <MenuPontinhos aberto={menuAberto} setAberto={setMenuAberto} itens={[
                // Mesmos itens do ⋮ das tarefas (com "Tarefas" no lugar de "Controle da casa") + Configuração.
                ...(souGestor && modo === "usar" ? [{ key: "config", icon: Wrench, cor: C.pasto, txt: "Configuração", on: () => setModo("gerenciar") }] : []),
                ...(!estaInstalado() ? [{ key: "inst", icon: ArrowDownToLine, cor: C.pasto, txt: "Instalar app", on: () => _installOpen.fn && _installOpen.fn() }] : []),
                ...(onEquipe ? [{ key: "equipe", icon: Users, cor: C.pasto, txt: "Equipe", on: onEquipe }] : []),
                { key: "tema", icon: tema === "dark" ? Sun : Moon, cor: C.ambar, txt: tema === "dark" ? "Modo claro" : "Modo noturno", on: () => { const n = tema === "dark" ? "light" : "dark"; aplicarTema(n); setTema(n); } },
                ...(onVoltar ? [{ key: "tarefas", icon: ListTodo, cor: C.lago, txt: "Tarefas", on: onVoltar }] : []),
                ...(onSobre ? [{ key: "sobre", icon: Info, cor: C.lago, txt: "Sobre a propriedade", on: onSobre }] : []),
                ...(onSair ? [{ key: "sair", icon: LogOut, cor: C.vermelho, txt: "Sair", on: async () => { if (await Dialog.confirm({ titulo: "Sair", mensagem: "Deseja sair desta conta?", okLabel: "Sair" })) onSair(); } }] : []),
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
            <GerenciarView pavimentos={pavimentos} ambientes={ambientes} equipamentos={equipamentos} ents={ents} areas={areas} cbs={cbs} />
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
            const acesoP = contarLigados(pav.comodos.flatMap((c) => c.itens)).on > 0;
            return (
            <React.Fragment key={pav.id}>
            {naMao && <div style={{ height: arrPav.h, marginBottom: 10, borderRadius: 22, border: `2px dashed ${C.cinzaClaro}`, background: alfa(C.cinzaClaro, 8) }} />}
            <section ref={(el) => { pavRefs.current[pav.id] = el; }}
              // Caixa do pavimento: fecha toda a área do nível (título + cômodos) com borda e um fundo
              // um tom diferente da página. Com algo ligado, a borda fica âmbar.
              style={{ marginBottom: 10, padding: 6, borderRadius: 22, boxSizing: "border-box",
                border: `1px solid ${acesoP ? alfa(C.ambar, 35) : C.linha}`,
                background: `color-mix(in srgb, ${C.card} 55%, ${C.bg})`, transition: "border-color .25s",
                ...(naMao ? { position: "fixed", left: arrPav.left, top: arrPav.y - arrPav.offY, width: arrPav.w, zIndex: 60, margin: 0,
                  boxShadow: "0 22px 44px -16px rgba(0,0,0,.5)", transform: "scale(1.02)" } : {}) }}>
              {/* Mesmo recuo à DIREITA do cabeçalho do cômodo (12 de respiro + 1 de borda): os "Desligar tudo" alinham.
                  Aqui o recuo conta a partir da borda interna da caixa do pavimento. */}
              <div style={{ padding: "0 13px 0 3px", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: arrPav ? "none" : "auto" }}
                onPointerDown={(ev) => aoPressionarPav(ev, pav.id)} onPointerMove={aoMoverPav} onPointerUp={aoSoltarPav} onPointerCancel={aoSoltarPav}
                onContextMenu={(ev) => { if (souGestor && pav.id !== "__sem__") { ev.preventDefault(); pegarPav(); } }}
                onClickCapture={(ev) => { if (pavLongo.current) { ev.stopPropagation(); ev.preventDefault(); } }}>
                <CabecalhoNivel nome={pav.nome} grande aberto={abertoP} onAlternar={() => alternarPav(pav.id, pav.comodos.map((c) => c.id))}
                  itens={pav.comodos.flatMap((c) => c.itens)} onDesligarTudo={(itens) => desligarTudo(itens, pav.nome)}
                  sub={`${pav.comodos.length} ${pav.comodos.length === 1 ? "cômodo" : "cômodos"}`} />
              </div>
              {abertoP && (
                <div className="flex flex-col" style={{ gap: 8, marginTop: 4 }}>
                  {pav.comodos.map((c) => {
                    const abertoC = abertos.amb === c.id;
                    const acesoC = contarLigados(c.itens).on > 0; // algo ligado: a caixa ganha um tom âmbar
                    return (
                      <div key={c.id} style={{ border: `1px solid ${acesoC ? alfa(C.ambar, 40) : abertoC ? alfa(C.cinzaClaro, 45) : C.linha}`, borderRadius: 18,
                        background: acesoC ? `color-mix(in srgb, ${C.ambar} 6%, ${C.card})` : C.card, padding: "6px 12px",
                        boxShadow: abertoC ? "0 10px 28px -18px rgba(0,0,0,.45)" : "none", transition: "box-shadow .2s, border-color .2s, background .25s" }}>
                        <CabecalhoNivel nome={c.nome} aberto={abertoC} onAlternar={() => alternarAmb(c.id)}
                          itens={c.itens} onDesligarTudo={(itens) => desligarTudo(itens, c.nome)} />
                        {abertoC && (
                          <div style={{ borderTop: `1px solid ${C.linha}`, margin: "6px -12px 0", padding: "12px 12px 6px" }}>
                            <GradeEquip itens={c.itens} enviar={enviar} expandidos={expandidos} toggleExpand={toggleExpand} podeArrastar={souGestor} onReordenar={cbs.onReordenar} editando={editando} setEditando={setEditando} onTamanho={cbs.onTamanho} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            </React.Fragment>
            );
          })}

          {aviso && <div style={{ background: aviso.erro ? C.vermelhoClaro : C.pastoClaro, color: aviso.erro ? C.vermelho : C.pastoEsc, borderRadius: 12, fontSize: 13.5 }} className="p-3 mb-3">{aviso.texto}</div>}
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
