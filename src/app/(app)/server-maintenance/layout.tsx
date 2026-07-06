import { notFound } from "next/navigation";
import { isServerAdmin } from "@/domains/auth/permissions";
import { assertServerAdminTwoFactorReady, requireUser } from "@/lib/auth/session";

export default async function ServerMaintenanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!(await isServerAdmin(user.id))) notFound();
  await assertServerAdminTwoFactorReady({ id: user.id, serverRole: "SERVER_ADMIN", twoFactorVerifiedAt: user.twoFactorVerifiedAt });
  return children;
}
