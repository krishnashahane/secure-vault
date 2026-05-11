import { VaultClient } from "@/components/vault-client";
import { LandingPage } from "@/components/landing-page";
import { getCurrentUser } from "@/lib/auth";
import { listFiles } from "@/lib/files";
import { MAX_FILE_BYTES, VAULT_CAPACITY_BYTES } from "@/lib/limits";

export const dynamic = "force-dynamic";

export default async function Home() {
  const isConfigured = Boolean(process.env.DATABASE_URL);
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID);

  let user = null;
  let files: Awaited<ReturnType<typeof listFiles>> = [];

  if (isConfigured) {
    try {
      user = await getCurrentUser();
      if (user) {
        files = await listFiles(user.id);
      }
    } catch {
      user = null;
      files = [];
    }
  }

  if (user) {
    return (
      <main className="app-shell">
        <VaultClient
          initialFiles={files}
          maxFileBytes={MAX_FILE_BYTES}
          vaultCapacityBytes={VAULT_CAPACITY_BYTES}
          userEmail={user.email}
          userAvatarUrl={user.avatarUrl}
        />
      </main>
    );
  }

  return <LandingPage isConfigured={isConfigured} hasGoogle={hasGoogle} />;
}
