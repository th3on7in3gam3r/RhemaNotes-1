import localforage from 'localforage';

const PENDING_TRANSCRIPT_KEY = 'rhemanotes_pending_transcript';

export interface PendingTranscript {
  transcript: string;
  fileName?: string;
  savedAt: number;
}

export async function savePendingTranscript(data: PendingTranscript): Promise<void> {
  await localforage.setItem(PENDING_TRANSCRIPT_KEY, data);
}

export async function getPendingTranscript(): Promise<PendingTranscript | null> {
  return (await localforage.getItem<PendingTranscript>(PENDING_TRANSCRIPT_KEY)) ?? null;
}

export async function clearPendingTranscript(): Promise<void> {
  await localforage.removeItem(PENDING_TRANSCRIPT_KEY);
}
