import "server-only";

import { cookies } from "next/headers";

export const formFlashCookie = "fluxpoint-form-flash";

export async function setFormFlash(message: string, tone: "success" | "error" = "success") {
  const store = await cookies();
  store.set(formFlashCookie, encodeURIComponent(JSON.stringify({ message, tone, nonce: Date.now() })), {
    path: "/",
    maxAge: 60,
    sameSite: "lax"
  });
}
