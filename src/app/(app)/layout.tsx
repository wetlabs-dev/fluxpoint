import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isServerAdmin } from "@/domains/server/server-admin";
import { MaintenanceScreen } from "@/components/server/MaintenanceScreen";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [maintenance, admin] = await Promise.all([
    prisma.maintenanceMode.findUnique({ where: { id: "global" } }),
    isServerAdmin(user)
  ]);
  if (maintenance?.enabled && !admin) return <MaintenanceScreen message={maintenance.message} expectedReturnAt={maintenance.expectedReturnAt} />;
  return <AppShell user={user}>{children}</AppShell>;
}
