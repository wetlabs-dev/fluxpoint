import { isServerAdmin as isServerAdminById, requireServerAdmin as requireServerAdminUser } from "@/domains/auth/permissions";
import { assertServerAdminTwoFactorReady } from "@/lib/auth/session";

export async function isServerAdmin(user: { id: string; email: string }) {
  return isServerAdminById(user.id);
}

export async function requireServerAdmin(user: { id: string; email: string; serverRole?: string; twoFactorVerifiedAt?: Date | null }) {
  if (!(await isServerAdmin(user))) throw new Error("Server administrator access is required.");
  await assertServerAdminTwoFactorReady({ id: user.id, serverRole: "SERVER_ADMIN", twoFactorVerifiedAt: user.twoFactorVerifiedAt });
  return user;
}

export { requireServerAdminUser };
