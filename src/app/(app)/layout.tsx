import { AppShell } from "@/components/layout/app-shell";
import { getAccessibleCollections, getUserCollection, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isServerAdmin } from "@/domains/server/server-admin";
import { MaintenanceScreen } from "@/components/server/MaintenanceScreen";
import { FormFeedback } from "@/components/forms/FormFeedback";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [maintenance, admin, activeCollection, collections] = await Promise.all([
    prisma.maintenanceMode.findUnique({ where: { id: "global" } }),
    isServerAdmin(user),
    getUserCollection(user.id),
    getAccessibleCollections(user.id)
  ]);
  if (maintenance?.enabled && !admin) return <MaintenanceScreen message={maintenance.message} expectedReturnAt={maintenance.expectedReturnAt} />;
  return <AppShell user={user} isServerAdmin={admin} activeCollectionId={activeCollection.id} collections={collections}><FormFeedback />{children}</AppShell>;
}
