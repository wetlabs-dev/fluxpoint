import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
