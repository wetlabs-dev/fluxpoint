import assert from "node:assert/strict";
import { prisma } from "../src/lib/db/prisma";
import { getUserCollection } from "../src/lib/auth/session";
import { canViewCollection } from "../src/domains/auth/permissions";

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "multi@remediation.invalid" }, include: { collectionMemberships: { include: { collection: true }, orderBy: { collection: { createdAt: "asc" } } } } });
  assert.ok(user.collectionMemberships.length >= 2, "Fixture user must have two memberships.");
  const [first, second] = user.collectionMemberships.map((membership) => membership.collection);
  await prisma.user.update({ where: { id: user.id }, data: { activeCollectionId: second.id } });
  assert.equal((await getUserCollection(user.id)).id, second.id, "Persisted collection selection was not used.");
  const other = await prisma.user.findUniqueOrThrow({ where: { email: "viewer@remediation.invalid" } });
  const otherSelectionBefore = other.activeCollectionId;
  assert.equal(await canViewCollection(other.id, second.id), false, "Unauthorized user could view a collection without membership.");
  await prisma.collectionMembership.delete({ where: { collectionId_userId: { collectionId: second.id, userId: user.id } } });
  assert.equal((await getUserCollection(user.id)).id, first.id, "Removed membership did not trigger safe fallback.");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).activeCollectionId, first.id, "Fallback was not persisted.");
  await prisma.collectionMembership.create({ data: { collectionId: second.id, userId: user.id, role: "VIEWER" } });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).activeCollectionId, otherSelectionBefore, "Switching one user changed another user's selection.");
  console.log("Collection switching persistence, authorization, fallback, and isolation checks passed.");
}
main().finally(() => prisma.$disconnect());
