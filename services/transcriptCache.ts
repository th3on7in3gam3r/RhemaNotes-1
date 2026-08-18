import localforage from 'localforage';

const PENDING_TRANSCRIPT_KEY = 'rhemanotes_pending_transcript';
const PARTIAL_TRANSCRIPT_KEY = 'rhemanotes_partial_transcript';

export interface PendingTranscript {
  transcript: string;
  fileName?: string;
  savedAt: number;
}

export interface PartialTranscriptProgress {
  transcript: string;
  completedChunks: number;
  totalChunks: number;
  fileName?: string;
  savedAt: number;
}

export async function savePendingTranscript(data: PendingTranscript): Promise<void> {
  await localforage.setItem(PENDING_TRANSCRIPT_KEY, data);
  await clearPartialTranscript();
}

export async function getPendingTranscript(): Promise<PendingTranscript | null> {
  return (await localforage.getItem<PendingTranscript>(PENDING_TRANSCRIPT_KEY)) ?? null;
}

export async function clearPendingTranscript(): Promise<void> {
  await localforage.removeItem(PENDING_TRANSCRIPT_KEY);
}

/** Save progress after each transcription chunk (survives tab refresh / partial failure) */
export async function savePartialTranscript(data: PartialTranscriptProgress): Promise<void> {
  await localforage.setItem(PARTIAL_TRANSCRIPT_KEY, data);
}

export async function getPartialTranscript(): Promise<PartialTranscriptProgress | null> {
  return (await localforage.getItem<PartialTranscriptProgress>(PARTIAL_TRANSCRIPT_KEY)) ?? null;
}

export async function clearPartialTranscript(): Promise<void> {
  await localforage.removeItem(PARTIAL_TRANSCRIPT_KEY);
}
