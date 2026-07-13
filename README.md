# Abdalla Home — Rancho Abdalla

App mobile-first (Vite + React) para tarefas, agenda, compras e estoque do rancho,
com dados no **Supabase** (login, banco, tempo real e fotos).

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente `http://localhost:5173/`).

## 1) Preencher o `.env.local`

Copie os valores do seu projeto no painel do Supabase em
**Project Settings → API** e preencha o arquivo `.env.local`:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_KEY=<a chave "anon public">
```

> Use a chave **anon public** (nunca a `service_role`). Como o site é estático,
> essa chave fica visível no navegador — a segurança real vem do **RLS** e da
> Edge Function. O `.env.local` **não** vai para o Git.

## 2) Habilitar o Realtime (tempo real)

No Supabase, em **Database → Replication**, adicione as tabelas à publicação
`supabase_realtime`, ou rode no **SQL Editor**:

```sql
alter publication supabase_realtime add table
  tarefas, compra_itens, conclusoes, produtos, estoque, movimentacoes, perfis;
```

Sem isso o app funciona, mas os celulares só atualizam ao recarregar.

## 3) Bucket de fotos

Já existe o bucket público **`fotos`**. As imagens de tarefas e de conclusão são
redimensionadas e enviadas para lá; a URL pública é salva em
`tarefas.imagem_url` e `conclusoes.foto_url` / `tarefas.foto_conclusao_url`.

## 4) Edge Function para criar usuários (tela Equipe)

Criar um usuário no Auth exige a chave `service_role`, que **não pode** ficar no
app. Por isso o botão "Adicionar pessoa" chama a Edge Function
`supabase/functions/criar-usuario`, que roda no servidor, confere se quem chamou
é **admin ativo** e só então cria a conta + o perfil.

Para publicar (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase functions deploy criar-usuario
```

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
já existem no ambiente das Edge Functions — não precisa configurá-las.

## 5) Criar o primeiro administrador

Como só um admin cria outras pessoas, o primeiro precisa ser criado à mão:

1. **Authentication → Users → Add user**: crie com e-mail e senha (marque
   *Auto Confirm User*).
2. Copie o `id` (UUID) desse usuário e rode no **SQL Editor**:

   ```sql
   insert into perfis (id, nome, papel, telefone, ativo)
   values ('COLE-O-UUID-AQUI', 'Seu Nome', 'admin', '', true);
   ```

3. Entre no app com esse e-mail/senha. A partir daí, você adiciona o resto da
   equipe pela tela **Equipe**.

## Como testar o login

- Preencha o `.env.local` (passo 1) e rode `npm run dev`.
- Abra o app: aparece a tela de **login** (verde/terra).
- Entre com o e-mail/senha do administrador criado no passo 5.
- Se a conta tiver `ativo=false` (ou não tiver perfil), aparece a tela
  **"Acesso removido"**.

## Publicar no GitHub Pages

`vite.config.js` já usa `base: './'`. Gere a versão de produção com
`npm run build` (sai na pasta `dist/`) e publique essa pasta.
