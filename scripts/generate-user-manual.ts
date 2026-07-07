import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { manualSections, type ManualScreenshot } from "../src/lib/user-manual";

const repoRoot = process.cwd();
const outputs = [
  join(repoRoot, "docs", "USER_MANUAL.md"),
  join(repoRoot, "public", "manual", "USER_MANUAL.md")
];

function anchor(id: string) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function screenshotsForSection(section: { title: string; route?: string; screenshot?: string; screenshots?: ManualScreenshot[] }) {
  if (section.screenshots?.length) return section.screenshots;
  if (section.route && section.screenshot) return [{ filename: section.screenshot, route: section.route, caption: `${section.title} screenshot` }];
  return [];
}

export function renderManualMarkdown() {
  const lines: string[] = [
    "# Fluxpoint User Manual",
    "",
    "Generated from `src/lib/user-manual.ts`. Edit the typed source and run `npm run docs:manual` to refresh this file.",
    "",
    "## Contents",
    "",
    ...manualSections.map((section) => `- [${section.title}](#${anchor(section.id)})${section.route ? ` — \`${section.route}\`` : ""}`),
    ""
  ];

  for (const section of manualSections) {
    lines.push(`## ${section.title}`, "");
    if (section.route) lines.push(`Route: \`${section.route}\``, "");
    const screenshots = screenshotsForSection(section);
    if (screenshots.length) {
      lines.push("### Screenshots", "");
      for (const screenshot of screenshots) {
        const caption = screenshot.caption ?? `${section.title} screenshot`;
        lines.push(`![${caption}](/manual/screenshots/${screenshot.filename})`, "", `_${caption}_`, "", `Route/context: \`${screenshot.route}\``, "");
      }
    }
    lines.push("### Purpose", "", section.purpose, "", "### How to", "");
    for (const step of section.howTo) lines.push(`- ${step}`);
    lines.push("");
    if (section.notes?.length) {
      lines.push("### Notes", "");
      for (const note of section.notes) lines.push(`- ${note}`);
      lines.push("");
    }
    if (section.warnings?.length) {
      lines.push("### Warnings", "");
      for (const warning of section.warnings) lines.push(`- ${warning}`);
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function writeManualOutputs() {
  const markdown = renderManualMarkdown();
  for (const output of outputs) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, markdown);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeManualOutputs();
  for (const output of outputs) console.log(`Wrote ${output}`);
}
