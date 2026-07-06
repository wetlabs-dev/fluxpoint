# Aquarium photo gallery

Fluxpoint treats aquarium photos as moderated records attached to a tank, timeline event, inventory item, health condition, or species reference.

## Uploads

- Aquarium pages expose uploads from the overview preview and the Photos workspace.
- The uploader supports multiple JPEG, PNG, or WebP files at once.
- Optional metadata includes caption, description, photographer, capture date, tags, attached item/event, and visible species.
- Uploads create a photo timeline event by default unless the keeper turns that off.
- New uploads enter moderation before they appear in galleries or public views.

## Gallery and lightbox

The Photos workspace shows a responsive gallery with sort and filter controls for date, moderation state, cover photo, timeline/event photos, Eddy-generated images, keeper uploads, and species links.

Approved photos can be opened in a keyboard-friendly lightbox. The viewer supports Escape to close, arrow-key navigation, original-file download, and a metadata panel with species, tags, attachment context, capture date, upload date, photographer, and file details.

## Covers

Any approved, visible aquarium photo can become the tank cover. If the cover photo is hidden or deleted, Fluxpoint automatically falls back to the newest approved visible aquarium photo when one exists; otherwise the aquarium returns to its generated cover treatment.

Eddy-generated cover images are stored as media assets with `AI_GENERATED` source metadata and thumbnails so they appear in the same gallery after moderation/approval.

## Public aquarium gallery

Public aquarium settings include gallery controls:

- show or hide the photo gallery
- hide photo metadata
- hide upload dates

Public galleries only show approved, visible, non-private photos.

## Storage behavior

Fluxpoint keeps the existing upload architecture. Original images remain under `public/uploads/aquariums/{aquariumId}`. New image uploads also generate a smaller WebP thumbnail for gallery and public page display.
