const WHISPER_API = 'https://api.whisper-api.com';

export interface WhisperTaskResponse {
  task_id: string;
  status: string;
  result: string | null;
  language?: string;
  format?: string;
  error?: string;
}

export interface WhisperSubmitOptions {
  language?: string;
  format?: string;
  modelSize?: string;
  /** Initial prompt — improves scripture names and theological terms */
  prompt?: string;
}

export async function submitWhisperTranscription(
  apiKey: string,
  file: File | Blob,
  fileName: string,
  options: WhisperSubmitOptions = {},
): Promise<WhisperTaskResponse> {
  const body = new FormData();
  body.append('file', file, fileName);
  body.append('language', options.language ?? 'en');
  body.append('format', options.format ?? 'text');
  body.append('model_size', options.modelSize ?? 'large-v2');
  if (options.prompt?.trim()) {
    body.append('initial_prompt', options.prompt.trim());
    body.append('prompt', options.prompt.trim());
  }

  const res = await fetch(`${WHISPER_API}/transcribe`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body,
  });

  const data = (await res.json()) as WhisperTaskResponse & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || data.error || `Whisper upload failed (${res.status})`);
  }
  if (!data.task_id) {
    throw new Error('Whisper did not return a task id');
  }
  return data;
}

export async function fetchWhisperTaskStatus(
  apiKey: string,
  taskId: string,
): Promise<WhisperTaskResponse> {
  const res = await fetch(`${WHISPER_API}/status/${encodeURIComponent(taskId)}`, {
    headers: { 'X-API-Key': apiKey },
  });

  const data = (await res.json()) as WhisperTaskResponse & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || data.error || `Whisper status failed (${res.status})`);
  }
  return data;
}

const WHISPER_POLL_MS = 4000;
const WHISPER_MAX_WAIT_MS = 20 * 60 * 1000;

/** Poll Whisper until transcript is ready or timeout (server-side). */
export async function waitForWhisperTranscript(
  apiKey: string,
  taskId: string,
): Promise<string> {
  const deadline = Date.now() + WHISPER_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, WHISPER_POLL_MS));
    const data = await fetchWhisperTaskStatus(apiKey, taskId);
    const status = (data.status || '').toLowerCase();

    if (status === 'failed' || data.error) {
      throw new Error(data.error || 'Whisper transcription failed');
    }

    if ((status === 'done' || status === 'success' || status === 'completed') && data.result?.trim()) {
      return data.result.trim();
    }
  }

  throw new Error('Whisper transcription timed out for this chunk');
}
