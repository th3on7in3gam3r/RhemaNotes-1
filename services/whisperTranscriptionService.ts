import { authFetch } from './apiAuth';
import {
  WHISPER_POLL_INTERVAL_MS,
  WHISPER_MAX_WAIT_MS,
} from '../constants/ai';

export type TranscriptionProgressCallback = (status: string) => void;

export class WhisperUnavailableError extends Error {
  constructor(message = 'Whisper transcription is not configured on the server') {
    super(message);
    this.name = 'WhisperUnavailableError';
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Processing cancelled', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Processing cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Processing cancelled', 'AbortError');
}

/** Upload audio to Worker → Whisper API; poll until transcript is ready. */
export async function transcribeWithWhisper(
  file: File,
  onProgress?: TranscriptionProgressCallback,
  signal?: AbortSignal,
): Promise<string> {
  assertNotAborted(signal);
  onProgress?.('Uploading audio to Whisper (best for long sermons)…');

  const form = new FormData();
  form.append('file', file, file.name);

  const startRes = await authFetch('/api/transcribe', {
    method: 'POST',
    body: form,
    signal,
  });

  if (startRes.status === 503) {
    throw new WhisperUnavailableError();
  }

  if (!startRes.ok) {
    let message = `Transcription upload failed (${startRes.status})`;
    try {
      const body = (await startRes.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const { taskId } = (await startRes.json()) as { taskId: string };
  if (!taskId) throw new Error('No transcription task id returned');

  const deadline = Date.now() + WHISPER_MAX_WAIT_MS;
  let polls = 0;

  while (Date.now() < deadline) {
    assertNotAborted(signal);
    await sleep(WHISPER_POLL_INTERVAL_MS, signal);
    polls += 1;

    onProgress?.(
      polls < 3
        ? 'Whisper is processing your audio…'
        : 'Whisper is still transcribing — long sermons can take several minutes. Keep this tab open.',
    );

    const statusRes = await authFetch(`/api/transcribe/status/${encodeURIComponent(taskId)}`, {
      signal,
    });

    if (!statusRes.ok) {
      let message = `Transcription status failed (${statusRes.status})`;
      try {
        const body = (await statusRes.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const data = (await statusRes.json()) as {
      status: string;
      transcript: string | null;
      error?: string;
    };

    if (data.status === 'failed' || data.error) {
      throw new Error(data.error || 'Whisper transcription failed');
    }

    if (data.status === 'completed' && data.transcript?.trim()) {
      return data.transcript.trim();
    }
  }

  throw new Error(
    'Whisper transcription timed out. Your audio may still be processing — try Upload → Paste Text if you have a transcript from Voice Memos.',
  );
}

/** Check if the production worker has Whisper configured. */
export async function isWhisperAvailable(): Promise<boolean> {
  try {
    const res = await authFetch('/api/transcribe/available');
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}
