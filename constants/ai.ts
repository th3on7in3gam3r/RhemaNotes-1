/** Central Gemini / AI configuration */
export const GEMINI_MODEL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
  'gemini-2.5-flash';

/** 4 minutes per chunk — balances speed vs. reliability for Gemini audio */
export const AUDIO_CHUNK_SECONDS = 240;

/** Target sample rate for all audio sent to Gemini (mono) */
export const AUDIO_TARGET_SAMPLE_RATE = 8000;

/** Soft warning in live recorder UI (45+ min sermons) */
export const LONG_RECORDING_WARN_SECONDS = 45 * 60;

/** Pause between chunk API calls to avoid rate limits (ms) */
export const TRANSCRIPTION_CHUNK_DELAY_MS = 2500;

/** Max characters of transcript sent to study-guide prompt (full text still saved locally) */
export const MAX_TRANSCRIPT_CHARS_FOR_STUDY_GUIDE = 90_000;

/** Max request body for Gemini proxy (bytes) */
export const GEMINI_PROXY_MAX_BODY_BYTES = 25 * 1024 * 1024;

/** Per-chunk transcription output cap */
export const TRANSCRIPTION_MAX_OUTPUT_TOKENS = 8192;
