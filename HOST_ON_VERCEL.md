# Host Saumya Secure Vault on Vercel

## Option A: Vercel Dashboard

1. Push this folder to a GitHub repository.
2. Open https://vercel.com/new.
3. Import the repository.
4. Keep Framework Preset as `Next.js`.
5. Add a Neon Postgres database from Vercel Marketplace.
6. Make sure `DATABASE_URL` exists in Project Settings -> Environment Variables for Production, Preview, and Development.
7. Deploy.
8. Open Project Settings -> Domains and add:
   - `saumyas.dev`
   - `www.saumyas.dev`
9. At your domain registrar, set the DNS records Vercel shows.

## Option B: Vercel CLI

Install Node.js LTS first, then run these commands inside this folder:

```bash
npm install
npm run build
npx vercel login
npx vercel link
npx vercel deploy --prod
```

After deploy:

```bash
npx vercel domains add saumyas.dev
npx vercel domains add www.saumyas.dev
```

Then set DNS at your registrar using the exact values Vercel shows.

## DNS Notes

Vercel currently documents the apex A record as:

```text
Type: A
Name: @
Value: 76.76.21.21
```

For `www`, use the CNAME shown by Vercel in the Domains screen.

## Database

This app needs:

```env
DATABASE_URL="postgres://..."
```

The app creates its own tables on first login/register. You do not need to manually run SQL unless you prefer to use `db/schema.sql`.
