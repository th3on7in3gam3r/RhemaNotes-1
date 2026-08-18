import {
  CLEANUP_SPLIT_WORD_THRESHOLD,
} from '../lib/transcriptionConstants';
import { formatSermonTranscript, type TranscriptMetadata } from '../lib/transcriptFormatter';

const GEMINI_MODEL = 'gemini-2.5-flash';

const CLEANUP_SYSTEM_PROMPT = `You are a sermon transcript editor. Your job is to lightly clean a raw speech-to-text transcript.

RULES:
- Preserve the pastor's exact wording and speaking style. Do NOT paraphrase or summarize.
- Only fix: filler words (um, uh), run-on sentences, punctuation, and misheard Bible references or proper names.
- Do NOT remove intentional repetition the speaker used for emphasis.
- Return valid JSON only with this shape:
{
  "cleaned_transcript": "string",
  "sermon_title": "string or null",
  "bible_reference": "Book Chapter:Verse format or null"
}`;

export interface CleanupResult extends TranscriptMetadata {}

function splitTranscriptForCleanup(text: string, maxWords: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return [text];

  const pieces: string[] = [];
  const overlap = 200;
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    pieces.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = end - overlap;
  }
  return pieces;
}

async function callGeminiCleanup(
  apiKey: string,
  transcript: string,
  extractMetadata: boolean,
): Promise<CleanupResult> {
  const userPrompt = extractMetadata
    ? `Clean this sermon transcript and detect sermon title and primary scripture reference if clearly stated.\n\n${transcript}`
    : `Clean this sermon transcript segment. Return sermon_title and bible_reference as null for this segment.\n\n${transcript}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${CLEANUP_SYSTEM_PROMPT}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini cleanup failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error('Gemini cleanup returned empty response');

  let parsed: {
    cleaned_transcript?: string;
    sermon_title?: string | null;
    bible_reference?: string | null;
  };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Gemini cleanup returned invalid JSON');
  }

  return {
    cleanedTranscript: parsed.cleaned_transcript?.trim() || transcript,
    sermonTitle: parsed.sermon_title ?? null,
    bibleReference: parsed.bible_reference ?? null,
  };
}

/**
 * Cleanup stitched transcript via Gemini (Claude-compatible prompt).
 * Splits into overlapping pieces when transcript exceeds 8,000 words.
 */
export async function cleanupSermonTranscript(
  apiKey: string,
  rawTranscript: string,
): Promise<CleanupResult & { formattedTranscript: string }> {
  const pieces = splitTranscriptForCleanup(rawTranscript, CLEANUP_SPLIT_WORD_THRESHOLD);

  const cleanedParts: string[] = [];
  let sermonTitle: string | null = null;
  let bibleReference: string | null = null;

  for (let i = 0; i < pieces.length; i++) {
    const isLast = i === pieces.length - 1;
    const extractMetadata = isLast;
    const result = await callGeminiCleanup(apiKey, pieces[i], extractMetadata);
    cleanedParts.push(result.cleanedTranscript);
    if (extractMetadata) {
      sermonTitle = result.sermonTitle;
      bibleReference = result.bibleReference;
    }
  }

  const cleanedTranscript = cleanedParts.join(' ').replace(/\s+/g, ' ').trim();
  const meta: TranscriptMetadata = {
    cleanedTranscript,
    sermonTitle,
    bibleReference,
  };

  return {
    ...meta,
    formattedTranscript: formatSermonTranscript(meta),
  };
}
