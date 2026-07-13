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
    href: "/fluxpoint",
    category: "Aquarium management / living systems",
    description:
      "A calm operating workspace for aquariums, bringing records, care, equipment, water, and long-term context into one place.",
    status: "active",
    logo: "/brand/fluxpoint-logo-256.png",
    accent: "#2f7f88"
  },
  {
    id: "axildb",
    name: "AxilDB",
    href: "https://www.axildb.com",
    external: true,
    category: "Botanical accession and propagation records",
    description:
      "Structured records for botanical accessions, propagation, provenance, and the histories that living collections accumulate.",
    status: "active",
    accent: "#657f58"
  }
];
