/** ~10-minute segments for Whisper (avoids truncated JSON on long files). */
export const LONG_FORM_CHUNK_SECONDS = 600;

/** Overlap between consecutive chunks for seam stitching. */
export const LONG_FORM_OVERLAP_SECONDS = 15;

/** Mono sample rate for Whisper chunks (16 kHz is standard for speech). */
export const LONG_FORM_SAMPLE_RATE = 16_000;

/** Use chunked long-form path when estimated duration exceeds this. */
export const LONG_FORM_MIN_DURATION_SEC = 15 * 60;

/** Words compared at chunk boundaries when stitching. */
export const STITCH_WORD_WINDOW = 40;

/** Split cleanup pass when stitched transcript exceeds this word count. */
export const CLEANUP_SPLIT_WORD_THRESHOLD = 8_000;

/** Whisper initial prompt — improves scripture book names and theological terms. */
export const WHISPER_SERMON_PROMPT =
  'Church sermon. May include Bible references, book names like Genesis, Romans, Philippians, quoted scripture, and theological terms.';

export type TranscriptJobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export const TRANSCRIPT_STATUS_VALUES = ['pending', 'processing', 'complete', 'failed'] as const;
