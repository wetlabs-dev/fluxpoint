import { prisma } from "../src/lib/db/prisma";
async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { serverRole: "SERVER_ADMIN", disabledAt: null } });
  const request = await prisma.backupRequest.create({ data: { requestedById: admin.id, notes: "Disposable post-audit remediation rehearsal" } });
  console.log(request.id);
}
main().finally(() => prisma.$disconnect());
