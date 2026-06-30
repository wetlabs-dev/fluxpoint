# Breeding Projects

Breeding Projects are Fluxpoint's breeding journal and project manager. They record observed breeding work, unexpected reproduction, community-tank offspring, and plant or coral propagation. The module deliberately does not calculate inheritance, genetic odds, or inferred parentage.

## Core concepts

- **Projects** represent breeding efforts. Types are Managed, Opportunistic, Community, and Propagation.
- **Parents** can be known, unknown, candidate, or community contributors. Community projects never require a specific parent.
- **Cohorts** represent groups of offspring or propagated material such as Spawn A, Batch 1, seedlings, runners, or frags.
- **Observations** are chronological records of what actually happened: spawn, eggs, hatch, birth, growth, milestone, trait, measurement, loss, transfer, photo, or note.
- **Traits** are observed characteristics only. Species definitions have an optional collection-local trait library, and projects record trait expressions with confidence and notes.
- **Measurements** record optional metric series such as average length, height, leaf count, or coral diameter. The project page renders a simple trend graph for the active metric.
- **Goals** are freeform project intentions such as preserving locality, increasing coloration, or maintaining compact growth.
- **Summaries** are editable project recaps. The v1 Eddy summary draft is generated deterministically from saved Fluxpoint records so keepers can edit before saving.

## Integrations

Breeding projects link to aquariums, species definitions, inventory parents, conditions, timeline events, media assets, care tasks, workflow runs, labels through inventory graduation, and audit logs.

When an observation is added to an aquarium-linked project, Fluxpoint writes a breeding timeline event for that aquarium and species. Breeding care tasks are normal Care Queue tasks with a project back-reference. A project can attach an existing workflow template; the generated workflow run remains visible in the project workspace.

When a cohort is established, the keeper can graduate it into Inventory. Graduation creates an `AquariumItem` with `originBreedingProjectId` and `originBreedingCohortId`, updates the cohort stage to `GRADUATED`, writes an aquarium timeline event when a tank is known, and records an audit event. Inventory detail pages show the originating project and cohort.

Photos are linked from existing moderated media. Upload photos through aquarium, inventory, condition, or timeline surfaces, then attach them to the breeding project.

## Permissions and audit

Viewer access is read-only. Aquarist-level roles can create and edit project records, observations, cohorts, goals, traits, measurements, care tasks, workflow links, and summaries. Collection Owners can delete projects and finalize completion. Audit logs cover project creation, observations, cohort updates, goals, trait observations, measurements, photo links, workflow attachment, graduation, completion, summary saves, and deletion.

## Reports

The Breeding Reports page shows active projects, completed projects, projects by species, projects by year, average graduated cohort size, trait frequency, and success history based on cohorts graduated into Inventory.
