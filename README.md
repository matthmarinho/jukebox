# Malungo Jukebox

Sistema de jukebox da **Barbearia Malungo** (Next.js + Tailwind CSS + Postgres no Neon + Vercel).

## Variáveis de Ambiente

Configure no `.env.local` (ambiente local) e em **Settings → Environment Variables** na Vercel:

```env
DATABASE_URL=postgresql://usuario:senha@ep-xxxx.neon.tech/neondb?sslmode=require
ADMIN_PASSWORD=sua-senha-de-admin
SESSION_SECRET=uma-chave-secreta-longa-e-aleatoria
```

## Banco de Dados (Neon)

Para criar/atualizar as tabelas no banco Neon, rode localmente:

```bash
npm run db:migrate
```

## Subindo na Vercel

1. Suba o repositório para o GitHub / GitLab / Bitbucket:
   ```bash
   git add .
   git commit -m "feat: malungo jukebox"
   git push
   ```
2. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório.
3. Em **Environment Variables**, adicione:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
4. Clique em **Deploy**.

## Rotas do Sistema

- `/` — Página dos clientes (escolha de até 4 músicas por lote, filtro A–Z por álbum ou artista e visualização da fila).
- `/admin` — Painel administrativo protegido por senha (busca e adição de álbuns do YouTube Music, remoção e controle da fila).
- `/player` — Player da barbearia protegido por senha (reproduz a fila automaticamente e entra em modo aleatório após 5 minutos sem pedidos de clientes).
