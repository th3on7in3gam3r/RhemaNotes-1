const WHISPER_API = 'https://api.whisper-api.com';

export interface WhisperTaskResponse {
  task_id: string;
  status: string;
  result: string | null;
  language?: string;
  format?: string;
  error?: string;
}

export async function submitWhisperTranscription(
  apiKey: string,
  file: File | Blob,
  fileName: string,
): Promise<WhisperTaskResponse> {
  const body = new FormData();
  body.append('file', file, fileName);
  body.append('language', 'en');
  body.append('format', 'text');
  body.append('model_size', 'large-v2');

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
