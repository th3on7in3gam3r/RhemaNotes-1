import type { D1Database } from '@cloudflare/workers-types';
import { stitchTranscripts } from '../lib/transcriptStitcher';
import { WHISPER_SERMON_PROMPT } from '../lib/transcriptionConstants';
import type { TranscriptJobStatus } from '../lib/transcriptionConstants';
import { submitWhisperTranscription, waitForWhisperTranscript } from './whisperTranscribe';
import { cleanupSermonTranscript } from './transcriptCleanup';

export interface TranscriptionJobEnv {
  DB: D1Database;
  WHISPER_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export interface TranscriptionJobRow {
  id: string;
  user_id: string;
  sermon_id: string | null;
  file_name: string;
  status: TranscriptJobStatus;
  total_chunks: number;
  completed_chunks: number;
  chunk_transcripts_json: string | null;
  raw_transcript: string | null;
  cleaned_transcript: string | null;
  sermon_title: string | null;
  bible_reference: string | null;
  formatted_transcript: string | null;
  error: string | null;
}

export interface JobPublicStatus {
  jobId: string;
  status: TranscriptJobStatus;
  totalChunks: number;
  completedChunks: number;
  progressPercent: number;
  phase: 'pending' | 'transcribing' | 'stitching' | 'cleanup' | 'complete' | 'failed';
  transcript?: string;
  formattedTranscript?: string;
  sermonTitle?: string | null;
  bibleReference?: string | null;
  error?: string;
}

const whisperCors = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: whisperCors });
}

function parseChunkTranscripts(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => (typeof v === 'string' ? v : ''));
  } catch {
    return [];
  }
}

export async function getTranscriptionJob(
  db: D1Database,
  jobId: string,
  userId: string,
): Promise<TranscriptionJobRow | null> {
  const row = await db
    .prepare('SELECT * FROM transcription_jobs WHERE id = ? AND user_id = ?')
    .bind(jobId, userId)
    .first<TranscriptionJobRow>();
  return row ?? null;
}

export function jobToPublicStatus(job: TranscriptionJobRow): JobPublicStatus {
  let phase: JobPublicStatus['phase'] = 'pending';
  if (job.status === 'failed') phase = 'failed';
  else if (job.status === 'complete') phase = 'complete';
  else if (job.completed_chunks < job.total_chunks) phase = 'transcribing';
  else if (!job.cleaned_transcript) phase = job.raw_transcript ? 'cleanup' : 'stitching';

  const progressPercent =
    job.status === 'complete'
      ? 100
      : job.total_chunks > 0
        ? Math.round((job.completed_chunks / job.total_chunks) * 85)
        : 0;

  return {
    jobId: job.id,
    status: job.status,
    totalChunks: job.total_chunks,
    completedChunks: job.completed_chunks,
    progressPercent,
    phase,
    transcript: job.cleaned_transcript || job.raw_transcript || undefined,
    formattedTranscript: job.formatted_transcript || undefined,
    sermonTitle: job.sermon_title,
    bibleReference: job.bible_reference,
    error: job.error || undefined,
  };
}

export async function createTranscriptionJob(
  env: TranscriptionJobEnv,
  userId: string,
  fileName: string,
  totalChunks: number,
): Promise<string> {
  const jobId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO transcription_jobs (id, user_id, file_name, status, total_chunks, completed_chunks, chunk_transcripts_json)
     VALUES (?, ?, ?, 'pending', ?, 0, ?)`,
  )
    .bind(jobId, userId, fileName, totalChunks, JSON.stringify(new Array(totalChunks).fill('')))
    .run();
  return jobId;
}

async function updateJobStatus(
  db: D1Database,
  jobId: string,
  status: TranscriptJobStatus,
  extra?: Partial<TranscriptionJobRow>,
): Promise<void> {
  const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const values: unknown[] = [status];

  if (extra?.completed_chunks !== undefined) {
    fields.push('completed_chunks = ?');
    values.push(extra.completed_chunks);
  }
  if (extra?.chunk_transcripts_json !== undefined) {
    fields.push('chunk_transcripts_json = ?');
    values.push(extra.chunk_transcripts_json);
  }
  if (extra?.raw_transcript !== undefined) {
    fields.push('raw_transcript = ?');
    values.push(extra.raw_transcript);
  }
  if (extra?.cleaned_transcript !== undefined) {
    fields.push('cleaned_transcript = ?');
    values.push(extra.cleaned_transcript);
  }
  if (extra?.sermon_title !== undefined) {
    fields.push('sermon_title = ?');
    values.push(extra.sermon_title);
  }
  if (extra?.bible_reference !== undefined) {
    fields.push('bible_reference = ?');
    values.push(extra.bible_reference);
  }
  if (extra?.formatted_transcript !== undefined) {
    fields.push('formatted_transcript = ?');
    values.push(extra.formatted_transcript);
  }
  if (extra?.error !== undefined) {
    fields.push('error = ?');
    values.push(extra.error);
  }

  values.push(jobId);
  await db
    .prepare(`UPDATE transcription_jobs SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function processTranscriptionChunk(
  env: TranscriptionJobEnv,
  jobId: string,
  userId: string,
  chunkIndex: number,
  fileBlob: Blob,
  fileName: string,
): Promise<TranscriptionJobRow> {
  if (!env.WHISPER_API_KEY) throw new Error('Whisper not configured');

  const job = await getTranscriptionJob(env.DB, jobId, userId);
  if (!job) throw new Error('Transcription job not found');
  if (job.status === 'complete') return job;
  if (chunkIndex < 0 || chunkIndex >= job.total_chunks) {
    throw new Error(`Invalid chunk index ${chunkIndex}`);
  }

  await updateJobStatus(env.DB, jobId, 'processing');

  const submit = await submitWhisperTranscription(
    env.WHISPER_API_KEY,
    fileBlob,
    fileName,
    { prompt: WHISPER_SERMON_PROMPT },
  );
  const chunkText = await waitForWhisperTranscript(env.WHISPER_API_KEY, submit.task_id);

  const transcripts = parseChunkTranscripts(job.chunk_transcripts_json);
  while (transcripts.length < job.total_chunks) transcripts.push('');
  transcripts[chunkIndex] = chunkText;

  const completedChunks = transcripts.filter((t) => t.trim().length > 0).length;

  await updateJobStatus(env.DB, jobId, 'processing', {
    completed_chunks: completedChunks,
    chunk_transcripts_json: JSON.stringify(transcripts),
  });

  const updated = await getTranscriptionJob(env.DB, jobId, userId);
  if (!updated) throw new Error('Job disappeared after chunk upload');

  return updated;
}

export async function finalizeTranscriptionJob(
  env: TranscriptionJobEnv,
  jobId: string,
  userId: string,
): Promise<void> {
  const job = await getTranscriptionJob(env.DB, jobId, userId);
  if (!job) throw new Error('Transcription job not found');
  if (job.status === 'complete') return;

  const transcripts = parseChunkTranscripts(job.chunk_transcripts_json);
  if (transcripts.some((t) => !t.trim())) {
    throw new Error('Not all chunks have been transcribed yet');
  }

  try {
    const raw = stitchTranscripts(transcripts);
    await updateJobStatus(env.DB, jobId, 'processing', { raw_transcript: raw });

    if (!env.GEMINI_API_KEY) {
      await updateJobStatus(env.DB, jobId, 'complete', {
        cleaned_transcript: raw,
        formatted_transcript: `# Sermon Transcript\n**Scripture: Not detected**\n---\n${raw}`,
      });
      return;
    }

    const cleaned = await cleanupSermonTranscript(env.GEMINI_API_KEY, raw);
    await updateJobStatus(env.DB, jobId, 'complete', {
      cleaned_transcript: cleaned.cleanedTranscript,
      sermon_title: cleaned.sermonTitle,
      bible_reference: cleaned.bibleReference,
      formatted_transcript: cleaned.formattedTranscript,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription finalize failed';
    await updateJobStatus(env.DB, jobId, 'failed', { error: message });
    throw err;
  }
}

export async function handleTranscriptionJobsRoute(
  request: Request,
  env: TranscriptionJobEnv,
  userId: string,
  path: string,
  ctx: ExecutionContext,
): Promise<Response> {
  const method = request.method;

  if (path === '/api/transcribe/jobs' && method === 'POST') {
    const body = (await request.json()) as { fileName?: string; totalChunks?: number };
    const fileName = body.fileName?.trim() || 'sermon.webm';
    const totalChunks = Number(body.totalChunks);
    if (!Number.isFinite(totalChunks) || totalChunks < 1 || totalChunks > 30) {
      return jsonResponse({ error: 'totalChunks must be between 1 and 30' }, 400);
    }
    const jobId = await createTranscriptionJob(env, userId, fileName, totalChunks);
    return jsonResponse({ jobId, status: 'pending', totalChunks });
  }

  const chunkMatch = path.match(/^\/api\/transcribe\/jobs\/([^/]+)\/chunks\/(\d+)$/);
  if (chunkMatch && method === 'POST') {
    const jobId = chunkMatch[1];
    const chunkIndex = parseInt(chunkMatch[2], 10);

    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Expected multipart file upload' }, 400);
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (!fileEntry || typeof fileEntry === 'string') {
      return jsonResponse({ error: 'Missing audio chunk file' }, 400);
    }

    const fileBlob = fileEntry as Blob;
    const fileName = (fileEntry as File).name || `chunk-${chunkIndex}.wav`;
    if (fileBlob.size > 25 * 1024 * 1024) {
      return jsonResponse({ error: 'Chunk too large (max 25 MB)' }, 413);
    }

    try {
      const job = await processTranscriptionChunk(
        env,
        jobId,
        userId,
        chunkIndex,
        fileBlob,
        fileName,
      );

      if (
        job.completed_chunks >= job.total_chunks &&
        job.status !== 'complete' &&
        job.status !== 'failed'
      ) {
        ctx.waitUntil(
          finalizeTranscriptionJob(env, jobId, userId).catch((err) => {
            console.error('finalizeTranscriptionJob failed:', err);
          }),
        );
      }

      return jsonResponse(jobToPublicStatus(job));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chunk transcription failed';
      await updateJobStatus(env.DB, jobId, 'failed', { error: message }).catch(() => {});
      return jsonResponse({ error: message }, 502);
    }
  }

  const jobMatch = path.match(/^\/api\/transcribe\/jobs\/([^/]+)$/);
  if (jobMatch && method === 'GET') {
    const job = await getTranscriptionJob(env.DB, jobMatch[1], userId);
    if (!job) return jsonResponse({ error: 'Job not found' }, 404);

    if (
      job.completed_chunks >= job.total_chunks &&
      job.status === 'processing' &&
      !job.cleaned_transcript
    ) {
      ctx.waitUntil(
        finalizeTranscriptionJob(env, jobMatch[1], userId).catch((err) => {
          console.error('finalize on poll failed:', err);
        }),
      );
    }

    return jsonResponse(jobToPublicStatus(job));
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
