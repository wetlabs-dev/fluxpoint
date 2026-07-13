import { wetlabsLinks } from "@/lib/wetlabs-links";

export type WetlabsProjectStatus = "active" | "experimental" | "archived" | "coming-soon";

export type WetlabsProject = {
  id: string;
  name: string;
  href: string;
  external?: boolean;
  category: string;
  description: string;
  status?: WetlabsProjectStatus;
  logo?: string;
  accent: string;
};

export const wetlabsProjects: WetlabsProject[] = [
  {
    id: "fluxpoint",
    name: "Fluxpoint",
    href: wetlabsLinks.fluxpoint,
    category: "Aquarium care and living systems",
    description:
      "A calm workspace for aquarium records, care, equipment, water, and the context that accumulates over time.",
    status: "active",
    logo: "/brand/fluxpoint-logo-256.png",
    accent: "#2f7f88"
  },
  {
    id: "axildb",
    name: "AxilDB",
    href: wetlabsLinks.axildb,
    external: true,
    category: "Botanical collections and propagation",
    description:
      "Structured records for botanical accessions, propagation, provenance, and the histories living collections accumulate.",
    status: "active",
    accent: "#657f58"
  }
];
