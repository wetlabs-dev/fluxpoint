import { readFileSync } from "fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const schema = readFileSync("prisma/schema.prisma", "utf8");
for (const status of ["CENSORED", "NO_AQUARIUM_CONTENT", "UNCERTAIN_AQUARIUM_CONTENT", "MODERATION_FAILED", "REMOVED"]) {
  assert(schema.includes(status), `MediaModerationStatus must include ${status}.`);
}
assert(schema.includes("model ImageModerationReview"), "ImageModerationReview model must exist.");
assert(schema.includes("moderationResultJson"), "MediaAsset must persist safety moderation JSON.");
assert(schema.includes("aquariumAnalysisJson"), "MediaAsset must persist aquarium relevance JSON.");
assert(schema.includes("moderationFailureCount"), "MediaAsset must track moderation failure count.");

const service = readFileSync("src/domains/media/media-service.ts", "utf8");
assert(service.includes("runSafetyModeration"), "Media service must run safety moderation.");
assert(service.includes("runAquariumContentCheck"), "Media service must run aquarium content review.");
assert(service.includes("NO_AQUARIUM_CONTENT"), "Media service must support no-aquarium review status.");
assert(service.includes("UNCERTAIN_AQUARIUM_CONTENT"), "Media service must support uncertain-aquarium review status.");
assert(service.includes("ImageModerationReview"), "Media service/audit path should reference image moderation reviews.");

const mediaRoute = readFileSync("src/app/api/media/file/[...path]/route.ts", "utf8");
assert(mediaRoute.includes("nsfwFlagged"), "Protected media route must block nsfwFlagged media.");
assert(mediaRoute.includes("isUnsafeMediaStatus"), "Protected media route must block unsafe media statuses.");

const actions = readFileSync("src/domains/media/moderation-actions.ts", "utf8");
assert(actions.includes("keepAquariumPhotoFromReview"), "Uploader aquarium false-negative action must exist.");
assert(actions.includes("overrideSafetyReview"), "Server-admin safety false-positive action must exist.");
assert(actions.includes("disableUploader"), "Server-admin safety review must support disabling uploaders.");

const accountPage = readFileSync("src/app/(app)/account/page.tsx", "utf8");
assert(accountPage.includes("Photo moderation reviews"), "Account page must show uploader image reviews.");

const serverPage = readFileSync("src/app/(app)/server-maintenance/page.tsx", "utf8");
assert(serverPage.includes("Image Moderation Reviews"), "Server Maintenance must show admin image reviews.");

console.log("Image moderation architecture checks passed.");
