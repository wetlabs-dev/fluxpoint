# Removed legacy server actions — July 2026

Repository-wide symbol/import/form/route/script/document searches found no callers for these wrappers. Active replacements remain.

| Removed symbol | Old path | Replacement |
|---|---|---|
| `processWorkflowNotificationsNow` | `src/domains/workflows/actions.ts` | reminders worker → `processDueWorkflowNotifications` |
| `saveSpeciesHusbandryOverrideFieldAction` | `src/domains/management/actions.ts` | `saveSpeciesHusbandryOverrideAction` |
| `createReading` | `src/domains/management/actions.ts` | `createReadingsBatch` |
| `generateQrCode` | `src/domains/management/actions.ts` | label service and `/api/qr/**` |
| `generateAiCoverImage` | `src/domains/aquariums/actions.ts` | Eddy API → durable AI queue |

Known callers were none. To restore a non-cover wrapper, use `git show 8f9594d^:<path>` as historical guidance, restore required imports, and add a current contract check. Do not restore synchronous cover generation because it bypasses queue safety.
