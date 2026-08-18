import localforage from 'localforage';

const LAST_RECORDING_KEY = 'rhemanotes_last_recording';

export interface SavedRecording {
  blob: Blob;
  fileName: string;
  savedAt: number;
  durationEstimateSec?: number;
}

export async function saveLastRecording(data: SavedRecording): Promise<void> {
  await localforage.setItem(LAST_RECORDING_KEY, data);
}

export async function getLastRecording(): Promise<SavedRecording | null> {
  return (await localforage.getItem<SavedRecording>(LAST_RECORDING_KEY)) ?? null;
}

export async function clearLastRecording(): Promise<void> {
  await localforage.removeItem(LAST_RECORDING_KEY);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
