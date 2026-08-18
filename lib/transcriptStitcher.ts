import { STITCH_WORD_WINDOW } from './transcriptionConstants';

function normalizeWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Merge two consecutive chunk transcripts by detecting overlapping text
 * at the seam (last ~40 words vs first ~40 words).
 */
export function mergeOverlappingTranscripts(previous: string, next: string): string {
  const prevWords = normalizeWords(previous);
  const nextWords = normalizeWords(next);
  if (prevWords.length === 0) return next.trim();
  if (nextWords.length === 0) return previous.trim();

  const prevTail = prevWords.slice(-STITCH_WORD_WINDOW);
  const nextHead = nextWords.slice(0, STITCH_WORD_WINDOW);
  const maxLen = Math.min(prevTail.length, nextHead.length);

  let bestOverlap = 0;
  for (let len = maxLen; len >= 3; len--) {
    const suffix = prevTail.slice(-len).join(' ').toLowerCase();
    const prefix = nextHead.slice(0, len).join(' ').toLowerCase();
    if (suffix === prefix) {
      bestOverlap = len;
      break;
    }
  }

  if (bestOverlap > 0) {
    return `${previous.trim()} ${nextWords.slice(bestOverlap).join(' ')}`.trim();
  }

  return `${previous.trim()} ${next.trim()}`.trim();
}

/** Stitch ordered chunk transcripts into one raw transcript. */
export function stitchTranscripts(chunks: string[]): string {
  if (chunks.length === 0) return '';
  let result = chunks[0]?.trim() ?? '';
  for (let i = 1; i < chunks.length; i++) {
    result = mergeOverlappingTranscripts(result, chunks[i] ?? '');
  }
  return result.trim();
}
