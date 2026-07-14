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
      "Preserves the history of an aquarium so care, water, livestock, and equipment changes can reveal patterns over time.",
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
      "Preserves provenance and propagation history so plant collections can carry the stories and context they gather over time.",
    status: "active",
    logo: "/wetlabs/projects/axildb-app-icon.png",
    accent: "#657f58"
  }
];
