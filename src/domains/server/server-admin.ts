import { isServerAdmin as isServerAdminById, requireServerAdmin as requireServerAdminUser } from "@/domains/auth/permissions";

export async function isServerAdmin(user: { id: string; email: string }) {
  return isServerAdminById(user.id);
}

export async function requireServerAdmin(user: { id: string; email: string }) {
  if (!(await isServerAdmin(user))) throw new Error("Server administrator access is required.");
  return user;
}

export { requireServerAdminUser };
