# Media Uploads

Authenticated collection owners can upload JPEG, PNG, and WebP photos up to `MEDIA_UPLOAD_MAX_BYTES` (12 MB by default). HEIC is rejected until a safe server-side conversion path exists. Fluxpoint verifies the declared MIME type against file signatures, generates an opaque filename, and stores the file under `public/uploads/aquariums/{aquariumId}`. Docker mounts `public/uploads` into both the app and moderation worker.

Each upload creates a `MediaAsset` plus a pending `ModerationReview`. Assets may link to an aquarium, item/equipment record, species definition, or timeline event. A photo can also create a `PHOTO` timeline event. Captions and original filenames are metadata only; local filesystem paths are never exposed.

Approved, visible assets can be set as aquarium covers. Hiding clears a matching cover reference. Removing deletes the database record, related generic moderation rows, and the local file. All upload, attach, cover, moderation, hide, restore, and removal transitions create audit logs.

The first release lazy-loads constrained source images in grids. Thumbnail URLs are modeled but thumbnail generation is a documented follow-up.
