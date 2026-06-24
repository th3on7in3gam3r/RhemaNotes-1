export interface Scripture {
  reference: string;
  plain_meaning: string;
  speaker_usage: string;
}

export interface Reflection {
  takeaway?: string;
  reflection_text?: string;
  prayer?: string;
}

export interface UserNote {
  id: string;
  text: string;
  timestamp: number;
  timestamp_offset?: number; // Offset in seconds from start of recording
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main' | 'sub';
  children?: MindMapNode[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SermonSummaryOutput {
  title: string;
  main_topic: string;
  /** Optional preacher / pastor name supplied by the user */
  preacher_name?: string;
  /** Optional title or role (Pastor, Rev., Bishop, etc.) */
  speaker_title?: string;
  clean_transcript: string;
  scriptures: Scripture[];
  key_points: string[];
  quotes: string[];
  applications: string[];
  open_questions: string[];
  actionable_insights: string[];
  reflection?: Reflection;
  user_notes?: UserNote[];
  personal_action_items?: ActionItem[];
  highlights?: string[];
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];
  mind_map?: MindMapNode;
  chat_history?: ChatMessage[];
  audio_blob?: Blob;
}

export interface SavedScripture {
  id: string;           // unique save ID
  reference: string;    // e.g. "John 3:16"
  plain_meaning: string;
  speaker_usage: string;
  sermonId: string;
  sermonTitle: string;
  savedAt: number;      // timestamp
}

export interface SermonHistoryItem {
  id: string;
  timestamp: number;
  summary: SermonSummaryOutput;
  user_id?: string;
}

export interface TabProps {
  summary: SermonSummaryOutput;
}

// ── Bible Reader ──────────────────────────────────────────────────────────────

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface BibleHighlight {
  id: string;
  reference: string;       // e.g. "John 3:16"
  translation: string;     // e.g. "KJV"
  color: HighlightColor;
  createdAt: number;
}

export interface BibleAnnotation {
  id: string;
  reference: string;
  translation: string;
  text: string;
  createdAt: number;
}

export interface BibleVerseData {
  reference: string;
  text: string;
  translation: string;
}

export interface BibleTranslation {
  id: string;
  label: string;
  abbreviation: string;
}

export interface ParsedVerseRef {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  raw: string;
}