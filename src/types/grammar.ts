export interface GrammarChunk {
  chunk: string;
  pinyin: string;
  role: string;
  meaning: string;
}

export interface GrammarAnalysis {
  sentence: string;
  translation: string;
  pattern: string;
  chunks: GrammarChunk[];
  note: string;
  isCorrect: boolean;
  correction?: string;
  correctionPinyin?: string;
  feedback?: string;
}
