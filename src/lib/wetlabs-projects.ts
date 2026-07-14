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
      "Built because aquarium care is easier when water tests, livestock, equipment, notes, and small changes live in one readable history.",
    status: "active",
    logo: "/wetlabs/projects/fluxpoint-app-icon.png",
    accent: "#2f7f88"
  },
  {
    id: "axildb",
    name: "AxilDB",
    href: wetlabsLinks.axildb,
    external: true,
    category: "Botanical collections and propagation",
    description:
      "Built to help plant collections remember where each accession came from, how it was propagated, and what changed across seasons.",
    status: "active",
    logo: "/wetlabs/projects/axildb-app-icon.png",
    accent: "#657f58"
  }
];
