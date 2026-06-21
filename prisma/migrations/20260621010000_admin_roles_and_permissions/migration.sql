CREATE TYPE "ServerRole" AS ENUM ('STANDARD_USER', 'SERVER_ADMIN');
ALTER TABLE "User" ADD COLUMN "serverRole" "ServerRole" NOT NULL DEFAULT 'STANDARD_USER';
UPDATE "User" SET "serverRole" = 'SERVER_ADMIN' WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);

ALTER TYPE "CollectionRole" RENAME VALUE 'OWNER' TO 'COLLECTION_OWNER';
ALTER TYPE "CollectionRole" RENAME VALUE 'ADMIN' TO 'AQUARIST';
ALTER TYPE "CollectionRole" RENAME VALUE 'EDITOR' TO 'FISHKEEPER';

INSERT INTO "CollectionMembership" ("id", "collectionId", "userId", "role", "createdAt", "updatedAt")
SELECT 'owner-role-' || "id", "id", "ownerId", 'COLLECTION_OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Collection"
ON CONFLICT ("collectionId", "userId") DO UPDATE SET "role" = 'COLLECTION_OWNER', "updatedAt" = CURRENT_TIMESTAMP;
