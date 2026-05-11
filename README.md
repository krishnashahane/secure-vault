# Saumya Secure Vault

A Vercel-ready encrypted file vault with email/password login and a Neon Postgres database.

## Security Model

- Files are encrypted in the browser with AES-GCM before upload.
- The encryption passphrase is never sent to the server.
- The database stores encrypted ciphertext, salts, IVs, and file metadata.
- Login passwords are stored as PBKDF2-SHA256 hashes.
- Sessions use random tokens; only SHA-256 token hashes are stored in the database.

This first version stores encrypted files directly in Postgres to stay simple and free-tier friendly. Keep uploads small. For large production files, move the ciphertext to Vercel Blob and keep only metadata in Postgres.

## Vercel Setup

1. Create a Vercel project from this repository.
2. Add a free Neon Postgres database from Vercel Marketplace.
3. Set `DATABASE_URL` in the project environment variables.
4. Deploy. The app auto-creates the needed tables on first use.
5. Add `saumyas.dev` in Vercel project domains.

For DNS, use the exact records Vercel shows in the Domains screen. Vercel currently documents apex domains with an A record of `76.76.21.21`; for `www`, use the CNAME value Vercel shows for the project.

See `HOST_ON_VERCEL.md` for the full hosting checklist.

## Local Development

Create `.env.local`:

```env
DATABASE_URL="postgres://user:password@host/db?sslmode=require"
```

Then run:

```bash
npm install
npm run dev
```
