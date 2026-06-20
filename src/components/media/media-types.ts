export type MediaAssetView = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  altText: string | null;
  moderationStatus: "PENDING" | "APPROVED" | "FLAGGED" | "REJECTED" | "ERROR";
  hiddenAt: Date | null;
  createdAt: Date;
  item?: { name: string; itemType: string } | null;
  aquariumEvent?: { title: string; eventDate: Date } | null;
};
