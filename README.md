# Burger House Craft — sistema de pedidos online

Next.js 14 (site + painel) + Supabase (banco PostgreSQL, login do dono, imagens, avisos em tempo real). Hospedagem sugerida: Vercel.
Tudo tem plano gratuito para começar.

## O que o sistema faz
- **Cliente** (`/`): cardápio por categoria, modal de adicionais com preço ao vivo, carrinho, entrega/retirada, agendamento, PIX com botão de copiar e WhatsApp com mensagem pronta (`/pedido/NÚMERO`).
- **Dono** (`/admin`): produtos, categorias, adicionais (ordem, ativar/desativar, mín./máx.), pedidos com 7 status e aviso de pedido novo em tempo real, configurações (PIX, WhatsApp, taxas, horário, logo etc.).
- **Segurança**: o preço de todo pedido é recalculado e validado **no banco** (função `create_order`); clientes não conseguem alterar valores nem acessar o painel (regras RLS); só o dono logado escreve dados e vê pedidos.

## Passo a passo

### 1. Criar o banco (Supabase)
1. Crie uma conta em https://supabase.com e clique em **New project** (guarde a senha do banco).
2. Menu **SQL Editor → New query**, cole TODO o conteúdo de `supabase/schema.sql` e clique em **Run**. (Rode uma única vez; ele cria tabelas, regras de segurança, imagens e o cardápio inicial.)
3. Menu **Authentication → Users → Add user → Create new user**: informe o e-mail e a senha do dono (marque *Auto Confirm User*). Esse será o login do `/admin`.
4. **Authentication → Sign In / Providers → Email**: **desligue "Allow new users to sign up"** (impede que estranhos criem conta de administrador). **Importante.**
5. **Project Settings → API**: copie **Project URL** e a chave **anon public**.

### 2. Rodar no seu computador (opcional, para testar)
```
npm install
cp .env.example .env.local     # cole a URL e a chave anon
npm run dev                    # http://localhost:3000
```

### 3. Publicar (Vercel)
1. Suba esta pasta para um repositório no GitHub.
2. Em https://vercel.com → **Add New → Project** → importe o repositório.
3. Em **Environment Variables** adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e clique em **Deploy**.
4. Você recebe o link público (`https://seu-projeto.vercel.app`); o painel fica em `/admin`.
5. Domínio próprio: Vercel → **Settings → Domains** e siga as instruções de DNS.

### 4. Primeiro acesso
Entre em `/admin` → **Configurações** e preencha WhatsApp, chave PIX, endereço, horário, taxa e logo. Depois ajuste produtos, preços e fotos.

## Observações
- Projetos gratuitos do Supabase pausam após ~1 semana sem uso; o plano pago evita isso.
- O pagamento PIX é manual: o cliente paga e envia o comprovante; o dono muda o status para "Pagamento confirmado".
- Para mais de um administrador, crie mais usuários em Authentication → Users (todos têm acesso total).
