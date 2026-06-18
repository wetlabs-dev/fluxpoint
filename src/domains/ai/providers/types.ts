import type { CoverCardStyle } from "@/lib/design/cover-card";

export type TankAiInput = {
  name?: string | null;
  volumeGallons?: number | null;
  tankType?: string | null;
  stocking?: string[];
  plants?: string[];
  hardscape?: string[];
  substrate?: string | null;
  lighting?: string | null;
  latestParameters?: { parameter: string; value: number; unit: string }[];
  recentEvents?: { eventType: string; title: string; summary?: string | null }[];
  colorNotes?: string | null;
  vibeNotes?: string | null;
};

export type TankNameIdea = {
  name: string;
  rationale: string;
};

export type CareAdvice = {
  title: string;
  summary: string;
  checklist: string[];
};

export type TroubleshootingPrompt = {
  title: string;
  questions: string[];
};

export type AquariumStatusSummary = {
  title: string;
  summary: string;
  signals: string[];
};

export type AiProvider = {
  generateTankNames(input: TankAiInput): Promise<TankNameIdea[]>;
  generateCoverCardConcepts(input: TankAiInput): Promise<CoverCardStyle[]>;
  generateCareAdvice(input: TankAiInput): Promise<CareAdvice>;
  generateTroubleshootingQuestions(input: TankAiInput): Promise<TroubleshootingPrompt>;
  summarizeAquariumStatus(input: TankAiInput): Promise<AquariumStatusSummary>;
};
