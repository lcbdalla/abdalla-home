# Abdalla Home — Contexto do projeto (para o Claude Code)

Este documento resume o estado atual do projeto para dar contexto.
O app "Abdalla Home" é uma ferramenta de gestão do Rancho Abdalla (propriedade
rural à beira de lago, em Tocantins/BR). O dono (Leonardo) NÃO é programador —
explique tudo em português simples, passo a passo, e confirme antes de ações
que mexam em configurações ou publiquem coisas.

## O que o app faz
- Tarefas para colaboradores: únicas ou recorrentes (diária; ou semanal em dias
  específicos com intervalo de N semanas), com responsável trocável, foto de
  referência opcional, horário com lembrete 15 min antes, conclusão com foto
  opcional. Colaborador só cria tarefa "uma vez"; admin cria recorrentes.
- Agenda do dia (cronograma por horário).
- Compras: lista de itens (vários produtos por compra); ao concluir, cada item
  dá entrada no estoque. Título opcional (padrão "Compras").
- Estoque por categoria (Supermercado, Bebidas, Combustível [Gasolina/Diesel/Gás],
  Material de manutenção). Entrada e Saída em lote (carrinho) + saída rápida por
  item. Histórico de movimentações.
- Catálogo de ~200 produtos pré-cadastrados, com autocomplete na hora de comprar.
- Equipe: admin e colaborador. Identidade real por login. "Remover acesso" =
  marcar ativo=false (tela "Acesso removido").

## Stack e hospedagem (JÁ CONFIGURADO)
- Frontend: Vite + React (JavaScript), pasta do projeto local em
  C:\Users\lcbda\OneDrive\Documentos\GitHub\abdalla-home
- Repositório GitHub: lcbdalla/abdalla-home (público), publicado via GitHub Pages
  com GitHub Actions. Endereço do app: https://lcbdalla.github.io/abdalla-home/
- Segredos no GitHub (Secrets do Actions): VITE_SUPABASE_URL e VITE_SUPABASE_KEY.
- Banco/Auth/Storage: Supabase. O .env.local (local) tem as duas variáveis
  VITE_SUPABASE_URL e VITE_SUPABASE_KEY (chave publishable/anon). Nunca usar a
  service_role no frontend.
- Cliente Supabase em src/supabaseClient.js. App principal em src/AbdallaHome.jsx.

## Banco Supabase (JÁ CRIADO, com RLS ligado)
Tabelas: perfis (id->auth.users, nome, papel 'admin'/'colaborador', telefone,
ativo), produtos (id, nome, categoria, subcategoria, unidade), estoque
(produto_id, quantidade), movimentacoes (id, produto_id, tipo 'entrada'/'saida',
qtd, origem, user_id, criado_em), tarefas (id, titulo, descricao, responsavel_id,
criado_por_id, tipo, freq, dias int[], intervalo_semanas, data, data_inicio,
hora_inicio, hora_fim, imagem_url, eh_compra, status, concluida_em,
foto_conclusao_url), compra_itens (id, tarefa_id, produto_id, quantidade),
conclusoes (id, tarefa_id, data, user_id, foto_url).
- RLS: só quem está logado E ativo=true acessa (funções is_ativo()/is_admin()).
- Bucket público de Storage chamado "fotos".
- Realtime ligado para as tabelas do app.
- Já existe 1 usuário admin (perfil papel='admin', ativo=true).

## O que já FUNCIONA
- Login por e-mail/senha (Supabase Auth), leitura/gravação no banco, tempo real,
  fotos no Storage, base de produtos, todas as telas. Testado localmente e no ar.

## Controle da Casa (Home Assistant) — como está montado
- Tela separada aberta por #controle (ControleApp em src/AbdallaHome.jsx). Conecta
  ao HA por WebSocket (endereço+token na tabela ha_config).
- Permissões em perfis: `pode_controle` (usar) e `pode_gerir_controle` (GESTOR:
  criar ambientes e vincular aparelhos — só o dono). RLS trava a escrita ao gestor.
- Estrutura em 2 níveis: `pavimentos` (andares) > `ambientes` (cômodos, com
  pavimento_id) > `controle_equipamentos` (ambiente_id, entity_id do HA,
  nome/apelido, tipo). Roteiro: supabase/sql/ha-ambientes.sql (já cria os
  pavimentos: 1º Pavimento, Térreo, Subsolo, Área Externa).
- Cada aparelho tem controle por TIPO: interruptor (liga/desliga), persiana
  (abrir/parar/fechar — serve p/ cortina, flap e portão), ar (climate: on/off,
  temp+/-, modo, vento), tv (media_player: on/off, volume, play/pausa), irrigacao
  (iniciar/parar), fechadura, sensor.
- Tela "usar": tema claro do rancho, agrupada por pavimento > cômodo (seções que
  abrem/fecham), cartões em 2 colunas (aparelhos com muitos botões ocupam a linha).
- Modo "Gerenciar" (ícone chave inglesa no topo) aparece só para o gestor: cria
  pavimentos, cômodos e vincula aparelhos do HA escolhendo o tipo.

## O que FALTA (próximos passos)
1. **Cadastro de equipe pelo app (PRIORIDADE):** ativar o botão "Adicionar
   pessoa" da aba Equipe. Isso depende de uma Edge Function do Supabase
   (supabase/functions/criar-usuario) que cria o usuário no Auth + o perfil, de
   forma segura (a criação de usuários não pode ser feita com a chave anon no
   navegador). Precisa: instalar o Supabase CLI, `supabase login`,
   `supabase link --project-ref <REF>`, `supabase functions deploy criar-usuario`,
   e o app chamar essa função. Guiar o dono (não-programador) em cada passo.
2. Notificações push reais no celular (app fechado), 15 min antes — via PWA/web
   push ou OneSignal. Fase posterior.
3. Transformar em PWA instalável (manifest + service worker) para "adicionar à
   tela de início" com ícone próprio.

## Como rodar/publicar
- Rodar local: `npm run dev` (abre em http://localhost:5173/).
- Publicar: commit na main -> GitHub Actions publica sozinho no GitHub Pages.

## Estilo visual (manter)
Paleta campo/lago: verde pasto (#2f7d4f), verde escuro (#1f5c39), areia/bege de
fundo (#f6f3ea), terra (#33302a), âmbar (#c8862a), lago (#2b7a8c). Mobile-first,
botões grandes, poucos passos — usuários leigos.
