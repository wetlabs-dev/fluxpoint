# Fluxpoint documentation and User Guide screenshots

Fluxpoint’s in-app User Guide and static Markdown manual are generated from `src/lib/user-manual.ts`.

## Adding or changing manual sections

1. Edit `manualSections` in `src/lib/user-manual.ts`.
2. Give each section a stable `id`, `title`, optional `route`, purpose text, usage steps, and optional notes/warnings.
3. Add focused `screenshots` entries only when a visual makes the section easier to understand.
4. Run `npm run docs:manual` to refresh `docs/USER_MANUAL.md` and `public/manual/USER_MANUAL.md`.

## Screenshot targets

Prefer selector-based screenshots over full-page screenshots. Add a stable target to the UI region:

```tsx
<section data-docs-target="aquarium-card-grid">...</section>
```

Then reference it from the manual source:

```ts
{
  filename: "aquariums-card-grid.png",
  route: "/aquariums",
  selector: '[data-docs-target="aquarium-card-grid"]',
  caption: "Aquarium cards focused on tank identity and at-a-glance stats."
}
```

Use `crop` only when a stable selector is not practical. Avoid broad screenshots that include an entire long page.

## Screenshot generation

Generate screenshots with:

```bash
npm run docs:screenshots
```

On the production Docker host, prefer:

```bash
docker compose --profile docs run --rm docs
```

The screenshot runner supports `FLUXPOINT_DOCS_EMAIL`, `FLUXPOINT_DOCS_PASSWORD`, `FLUXPOINT_DOCS_TOTP_SECRET`, `FLUXPOINT_DOCS_TOTP_CODE`, `FLUXPOINT_DOCS_SKIP_LOGIN`, and `FLUXPOINT_DOCS_BASE_URL`.

## Size guidelines

Keep screenshots focused and scannable:

- Prefer one UI card, form, chart, or workspace region.
- Keep screenshot height under about 1400 px.
- Use captions to explain why the UI region matters.
- Do not reuse the same broad screenshot for multiple sections.
- Do not make normal app builds depend on live screenshot generation.

The screenshot script prints warnings for unusually tall, narrow, large, or duplicate screenshots. Treat warnings as a prompt to tighten the selector or crop.
