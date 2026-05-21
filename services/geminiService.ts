import { GoogleGenAI, Type } from "@google/genai";
import { MASTER_SERMON_PROCESSING_PROMPT } from '../constants';
import { GEMINI_MODEL, AUDIO_CHUNK_SECONDS } from '../constants/ai';
import { SermonSummaryOutput } from '../types';
import { authFetch } from './apiAuth';

export type GeminiProgressCallback = (status: string) => void;

export interface ProcessAudioOptions {
  includeReflection: boolean;
  onProgress?: GeminiProgressCallback;
  signal?: AbortSignal;
  /** Skip transcription (e.g. user already reviewed transcript) */
  transcript?: string;
}

let activeAbort: AbortController | null = null;

export function beginProcessing(): AbortController {
  activeAbort?.abort();
  activeAbort = new AbortController();
  return activeAbort;
}

export function cancelProcessing(): void {
  activeAbort?.abort();
  activeAbort = null;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Processing cancelled', 'AbortError');
}

const ai = new GoogleGenAI({
  apiKey: 'proxy',
  httpOptions: {
    baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    // @ts-expect-error — SDK HttpOptions omits custom fetch; routes Gemini via authFetch + proxy
    fetch: (input: RequestInfo | URL, init?: RequestInit) => authFetch(input, init),
  },
});

// ── JSON Schema for Sermon Processing ──────────────────────────────────────────

const SERMON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    main_topic: { type: Type.STRING },
    clean_transcript: { type: Type.STRING },
    scriptures: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          reference: { type: Type.STRING },
          plain_meaning: { type: Type.STRING },
          speaker_usage: { type: Type.STRING },
        },
        required: ["reference"]
      }
    },
    key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
    quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    applications: { type: Type.ARRAY, items: { type: Type.STRING } },
    open_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    actionable_insights: { type: Type.ARRAY, items: { type: Type.STRING } },
    reflection: {
      type: Type.OBJECT,
      properties: {
        takeaway: { type: Type.STRING },
        reflection_text: { type: Type.STRING },
        prayer: { type: Type.STRING },
      }
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
        },
        required: ["question", "options", "correctIndex"]
      }
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
        },
        required: ["front", "back"]
      }
    },
    mind_map: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        type: { type: Type.STRING },
        children: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING },
              children: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    type: { type: Type.STRING }
                  },
                  required: ["id", "label", "type"]
                }
              }
            },
            required: ["id", "label", "type"]
          }
        }
      },
      required: ["id", "label", "type"]
    }
  },
  required: [
    "title",
    "main_topic",
    "clean_transcript",
    "scriptures",
    "key_points",
    "quotes",
    "applications",
    "open_questions",
    "actionable_insights",
    "quiz",
    "flashcards",
    "mind_map"
  ]
};

const TRANSCRIPTION_PROMPT = `You are a precise sermon transcription assistant. Listen to the attached audio recording and transcribe everything the speaker says.

Rules:
- Output ONLY the transcript as plain text (no JSON, no markdown headings, no commentary).
- Remove filler words (um, uh, repeated stutters) but preserve the speaker's meaning and order.
- Use paragraph breaks for natural pauses or topic shifts.
- Write scripture references exactly as spoken (e.g. "John 3:16").
- If a segment is unintelligible, write [inaudible] for that part only.
- Do not summarize or shorten — transcribe the full spoken message.`;

// ── Public API ────────────────────────────────────────────────────────────────

export async function processSermonTranscript(
  transcript: string,
  includeReflection: boolean,
  signal?: AbortSignal,
): Promise<SermonSummaryOutput> {
  assertNotAborted(signal);
  return callGemini(
    [{ text: MASTER_SERMON_PROCESSING_PROMPT(transcript, includeReflection) }],
    includeReflection,
    signal,
  );
}

export async function transcribeSermonAudio(
  file: File,
  onProgress?: GeminiProgressCallback,
  signal?: AbortSignal,
): Promise<string> {
  assertNotAborted(signal);
  const chunks = await prepareTranscriptionChunks(file, onProgress, signal);
  const parts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    assertNotAborted(signal);
    if (chunks.length > 1) {
      onProgress?.(`Transcribing part ${i + 1} of ${chunks.length}…`);
    } else {
      onProgress?.('Transcribing your sermon recording…');
    }

    const chunkPrompt =
      chunks.length > 1
        ? `${TRANSCRIPTION_PROMPT}\n\nThis is part ${i + 1} of ${chunks.length} of one continuous sermon. Transcribe only this segment.`
        : TRANSCRIPTION_PROMPT;

    const base64Data = await fileToBase64(chunks[i].blob);
    const text = await withGeminiRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{
            role: 'user',
            parts: [
              { text: chunkPrompt },
              { inlineData: { data: base64Data, mimeType: chunks[i].mimeType } },
            ],
          }],
          config: { maxOutputTokens: 8192 },
        });
        const transcript = response.text?.trim();
        if (!transcript) throw new Error('Empty transcription segment');
        return transcript;
      },
      signal,
    );
    parts.push(text);
  }

  return parts.join('\n\n');
}

export async function processSermonFile(
  file: File,
  includeReflection: boolean,
  onProgress?: GeminiProgressCallback,
  signal?: AbortSignal,
  existingTranscript?: string,
): Promise<SermonSummaryOutput> {
  const transcript =
    existingTranscript?.trim() ||
    (await transcribeSermonAudio(file, onProgress, signal));

  assertNotAborted(signal);
  onProgress?.('Creating your study guide…');
  const result = await processSermonTranscript(transcript, includeReflection, signal);
  if (!result.clean_transcript?.trim()) {
    result.clean_transcript = transcript;
  }
  return result;
}

// ── Retry / errors ────────────────────────────────────────────────────────────

function parseRetryDelayMs(message: string): number | null {
  const match = message.match(/retry in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  return null;
}

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

async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    assertNotAborted(signal);
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const msg = (error as { message?: string })?.message ?? String(error);
      const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
      if (!isQuota || attempt === maxAttempts - 1) throw formatGeminiError(error, 'AI request failed');
      const delay = parseRetryDelayMs(msg) ?? 15_000 * (attempt + 1);
      await sleep(Math.min(delay, 60_000), signal);
    }
  }
  throw formatGeminiError(lastError, 'AI request failed');
}

function formatGeminiError(error: unknown, prefix: string): Error {
  const msg = (error as { message?: string })?.message ?? String(error);
  if (msg.includes('AbortError') || msg.includes('cancelled')) {
    return new Error('Processing was cancelled.');
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return new Error(
      'Gemini API quota exceeded. Wait a minute and try again, or enable billing in Google AI Studio.',
    );
  }
  return new Error(`${prefix}: ${msg}`);
}

// ── Audio chunking ────────────────────────────────────────────────────────────

interface AudioChunk {
  blob: Blob;
  mimeType: string;
}

async function prepareTranscriptionChunks(
  file: File,
  onProgress?: GeminiProgressCallback,
  signal?: AbortSignal,
): Promise<AudioChunk[]> {
  assertNotAborted(signal);

  try {
    const audioBuffer = await decodeAudioFile(file);
    const duration = audioBuffer.duration;

    if (duration <= AUDIO_CHUNK_SECONDS) {
      const { blob, mimeType } = await prepareAudioForGemini(file, onProgress);
      return [{ blob, mimeType }];
    }

    onProgress?.('Splitting long recording for transcription…');
    const chunkCount = Math.ceil(duration / AUDIO_CHUNK_SECONDS);
    const chunks: AudioChunk[] = [];

    for (let i = 0; i < chunkCount; i++) {
      assertNotAborted(signal);
      const start = i * AUDIO_CHUNK_SECONDS;
      const end = Math.min((i + 1) * AUDIO_CHUNK_SECONDS, duration);
      const slice = sliceAudioBuffer(audioBuffer, start, end);
      chunks.push({ blob: audioBufferToWav(slice), mimeType: 'audio/wav' });
    }
    return chunks;
  } catch {
    const { blob, mimeType } = await prepareAudioForGemini(file, onProgress);
    return [{ blob, mimeType }];
  }
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio API not supported');
  const ctx = new AudioContextClass();
  try {
    const buffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(buffer.slice(0));
  } finally {
    if (ctx.state !== 'closed') await ctx.close().catch(() => {});
  }
}

function sliceAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.min(Math.floor(endSec * sampleRate), buffer.length);
  const length = endSample - startSample;
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const sliced = offline.createBuffer(1, length, sampleRate);
  sliced.getChannelData(0).set(buffer.getChannelData(0).subarray(startSample, endSample));
  return sliced;
}

async function prepareAudioForGemini(
  file: File,
  onProgress?: GeminiProgressCallback,
): Promise<{ blob: File | Blob; mimeType: string }> {
  let blob: File | Blob = file;
  let mimeType = file.type || 'audio/webm';

  if (file.type.startsWith('video/') || file.size > 8 * 1024 * 1024) {
    try {
      onProgress?.('Preparing audio for transcription…');
      blob = await extractAudioToWav(file);
      mimeType = 'audio/wav';
    } catch (err) {
      console.warn('Failed to optimize audio, using original file:', err);
    }
  }

  return { blob, mimeType };
}

async function callGemini(
  parts: { text: string }[],
  includeReflection: boolean,
  signal?: AbortSignal,
): Promise<SermonSummaryOutput> {
  return withGeminiRetry(async () => {
    assertNotAborted(signal);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: SERMON_SCHEMA,
        maxOutputTokens: 8192,
      },
    });

    const jsonString = response.text;
    if (!jsonString) throw new Error("No response or empty response from Gemini API.");

    const parsedData: SermonSummaryOutput = JSON.parse(jsonString);
    parsedData.actionable_insights = parsedData.actionable_insights || [];
    parsedData.user_notes = parsedData.user_notes || [];
    parsedData.personal_action_items = parsedData.personal_action_items || [];
    parsedData.quiz = parsedData.quiz || [];
    parsedData.flashcards = parsedData.flashcards || [];
    parsedData.mind_map = parsedData.mind_map || undefined;

    if (!includeReflection) parsedData.reflection = {};
    return parsedData;
  }, signal);
}

// ── Web Audio WAV helpers ─────────────────────────────────────────────────────

async function extractAudioToWav(file: File): Promise<Blob> {
  const buffer = await decodeAudioFile(file);
  return audioBufferToWav(buffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 8;

  let result: Float32Array;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  const bufferLength = result.length;
  const bufferArray = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(bufferArray);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength, true);
  floatTo8BitPCM(view, 44, result);

  return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo8BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    const val = Math.floor((s + 1) * 127.5);
    output.setUint8(offset, Math.max(0, Math.min(255, val)));
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export async function* streamSermonChat(
  history: { role: 'user' | 'assistant', content: string }[],
  message: string,
  transcript: string
): AsyncGenerator<string> {
  const contents = [
    {
      role: 'user',
      parts: [{ text: `You are a helpful sermon study assistant. Answer strictly using information from the provided transcript.

        Transcript:
        ${transcript}` }]
    },
    ...history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model' as const,
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const result = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents
  });

  for await (const chunk of result) {
    const text = chunk.text;
    if (text) yield text;
  }
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
}

export async function generateGuidedPrompts(
  topic: string,
  keyPoints: string[]
): Promise<string[]> {
  try {
    const prompt = `Based on the following sermon details, generate exactly three (3) highly personalized, introspective, and practical reflection prompts/questions that help a believer apply this sermon to their daily life, relationship with God, and actions this week.

    Sermon Topic: ${topic}
    Key Points:
    ${keyPoints.map(p => `- ${p}`).join('\n')}

    Format your response STRICTLY as a JSON array of three strings, like this:
    ["Prompt 1", "Prompt 2", "Prompt 3"]`;

    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" },
      })
    );

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.slice(0, 3).map(p => String(p));
    throw new Error("Invalid array format from AI");
  } catch (error) {
    console.error("Error generating guided prompts:", error);
    return [
      `How does the truth of "${topic || 'this sermon'}" challenge your current way of thinking?`,
      `What is one specific action you can take today to apply the key points of this message?`,
      `Spend a moment in prayer: ask the Holy Spirit to reveal any area of your heart that needs alignment with this scripture.`
    ];
  }
}
