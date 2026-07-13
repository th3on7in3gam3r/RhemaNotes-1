import { authFetch } from './apiAuth';
import {
  chunkAudioForLongFormTranscription,
  shouldUseLongFormTranscription,
} from './audioChunker';

export type LongFormProgressCallback = (status: string) => void;

export interface LongFormJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  totalChunks: number;
  completedChunks: number;
  progressPercent: number;
  phase: string;
  transcript?: string;
  formattedTranscript?: string;
  sermonTitle?: string | null;
  bibleReference?: string | null;
  error?: string;
}

const JOB_POLL_MS = 3000;
const JOB_MAX_WAIT_MS = 60 * 60 * 1000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Processing cancelled', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Processing cancelled', 'AbortError'));
    }, { once: true });
  });
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Processing cancelled', 'AbortError');
}

async function pollJobUntilComplete(
  jobId: string,
  onProgress?: LongFormProgressCallback,
  signal?: AbortSignal,
): Promise<LongFormJobStatus> {
  const deadline = Date.now() + JOB_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    assertNotAborted(signal);
    await sleep(JOB_POLL_MS, signal);

    const res = await authFetch(`/api/transcribe/jobs/${encodeURIComponent(jobId)}`, { signal });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Job status failed (${res.status})`);
    }

    const status = (await res.json()) as LongFormJobStatus;

    if (status.phase === 'cleanup') {
      onProgress?.('Cleaning up transcript and detecting title & scripture…');
    } else if (status.totalChunks > 1) {
      onProgress?.(
        `Transcribing part ${Math.min(status.completedChunks + 1, status.totalChunks)} of ${status.totalChunks} (~10 min each)…`,
      );
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Long-form transcription failed');
    }

    if (status.status === 'complete' && status.transcript?.trim()) {
      onProgress?.('Transcription complete.');
      return status;
    }
  }

  throw new Error(
    'Long-form transcription timed out. Your job may still be processing — check back in a few minutes or paste a transcript from Voice Memos.',
  );
}

/**
 * Chunked long-form sermon transcription:
 * 1. Split audio into ~10 min segments (15s overlap) in the browser
 * 2. Upload each chunk to the worker (Whisper per chunk)
 * 3. Worker stitches, cleans up, and stores job status in D1
 */
export async function transcribeLongFormSermon(
  file: File,
  onProgress?: LongFormProgressCallback,
  signal?: AbortSignal,
): Promise<string> {
  assertNotAborted(signal);

  const chunks = await chunkAudioForLongFormTranscription(file, onProgress, signal);
  assertNotAborted(signal);

  onProgress?.('Starting background transcription job…');
  const createRes = await authFetch('/api/transcribe/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, totalChunks: chunks.length }),
    signal,
  });

  if (!createRes.ok) {
    const body = (await createRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Failed to create transcription job (${createRes.status})`);
  }

  const { jobId } = (await createRes.json()) as { jobId: string };
  if (!jobId) throw new Error('No job id returned');

  for (const chunk of chunks) {
    assertNotAborted(signal);
    onProgress?.(
      chunks.length > 1
        ? `Uploading & transcribing part ${chunk.index + 1} of ${chunks.length}…`
        : 'Uploading audio for transcription…',
    );

    const form = new FormData();
    form.append('file', chunk.blob, chunk.fileName);

    const chunkRes = await authFetch(
      `/api/transcribe/jobs/${encodeURIComponent(jobId)}/chunks/${chunk.index}`,
      { method: 'POST', body: form, signal },
    );

    if (!chunkRes.ok) {
      const body = (await chunkRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Chunk ${chunk.index + 1} failed (${chunkRes.status})`);
    }

    const chunkStatus = (await chunkRes.json()) as LongFormJobStatus;
    if (chunkStatus.status === 'complete' && chunkStatus.transcript?.trim()) {
      return chunkStatus.transcript.trim();
    }
  }

  const final = await pollJobUntilComplete(jobId, onProgress, signal);
  return final.transcript?.trim() || '';
}

export { shouldUseLongFormTranscription };
