import { z } from "zod";

// --- HSK Level (new HSK 3.0 standard, levels 1-9) ---

export type HSKLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// --- Scenarios ---

export type ScenarioId =
  | "restaurant"
  | "train_station"
  | "making_friends"
  | "shopping"
  | "hotel"
  | "directions";

export const SCENARIO_IDS: ScenarioId[] = [
  "restaurant",
  "train_station",
  "making_friends",
  "shopping",
  "hotel",
  "directions",
];

// --- LLM Response Schema (Zod-validated on every turn) ---

export const practiceResponseSchema = z.object({
  hanzi: z.string().min(1),
  pinyin: z.string().min(1),
  english: z.string().min(1),
  isObjectiveMet: z.boolean(),
  feedback: z.string().optional(),
  generatedObjective: z.string().optional(),
  vocabHints: z.array(z.object({
    english: z.string(),
    chinese: z.string(),
    pinyin: z.string(),
  })).optional(),
});

export type PracticeResponse = z.infer<typeof practiceResponseSchema>;

// --- Chat Message ---

export interface PracticeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parsed?: PracticeResponse;
}

// --- Session Setup ---

export interface PracticeSession {
  hskLevel: HSKLevel;
  scenarioId: ScenarioId;
  characterName: string;
}

// --- Chinese Name Generator ---

const SURNAMES = [
  "王", "李", "张", "刘", "陈", "杨", "黄", "周", "吴", "赵", "林", "孙",
];

const GIVEN_NAMES = [
  "明", "华", "丽", "伟", "芳", "军", "秀英", "强",
  "敏", "静", "磊", "洋", "艳", "勇", "娟", "涛",
];

export function generateChineseName(): string {
  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
  return surname + given;
}

