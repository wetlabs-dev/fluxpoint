import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

async function main() {
  const schema = await read("../prisma/schema.prisma");
  assert(schema.includes("enum AccountRequestStatus"), "Account request status enum must exist.");
  assert(schema.includes("model AccountRequest"), "Account request model must exist.");
  assert(schema.includes("reviewedBy"), "Account requests must track reviewing admin.");
  assert(schema.includes("invitationId"), "Account requests must link invitation setup tokens.");
  assert(schema.includes("ipAddress"), "Account requests must record IP for rate limiting.");

  const migration = await read("../prisma/migrations/20260702143000_account_requests/migration.sql");
  assert(migration.includes("AccountRequest_pending_email_unique"), "Migration must enforce one pending request per lowercase email.");
  assert(migration.includes("LOWER(\"email\")"), "Pending-request uniqueness must normalize email case.");

  const actions = await read("../src/domains/account-requests/actions.ts");
  assert(actions.includes("emailDailyLimit"), "Account request actions must include per-email rate limiting.");
  assert(actions.includes("ipDailyLimit"), "Account request actions must include per-IP rate limiting.");
  assert(actions.includes("notifyServerAdmins"), "Server admins must be notified of new requests.");
  assert(actions.includes("approveAccountRequest"), "Admin approval action must exist.");
  assert(actions.includes("rejectAccountRequest"), "Admin rejection action must exist.");
  assert(!actions.includes("temporaryPassword"), "Approval flow must not generate or expose plaintext temporary passwords.");

  const requestPage = await read("../src/app/request-account/page.tsx");
  assert(requestPage.includes("Fluxpoint access is approved by the server administrator"), "Request page must communicate approval-only access.");
  assert(requestPage.includes("Private collection names are not listed publicly"), "Request page must not list private collections.");

  const loginPage = await read("../src/app/login/page.tsx");
  assert(loginPage.includes("/request-account"), "Login page must link to account requests.");

  const invitePage = await read("../src/app/invite/[token]/page.tsx");
  assert(invitePage.includes("Finish setup and accept invitation"), "Invitation page must support first-time password setup.");

  const serverPage = await read("../src/app/(app)/server-maintenance/page.tsx");
  assert(serverPage.includes("/server-maintenance/account-requests"), "Server Maintenance must link account requests.");

  console.log("Account request approval checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
