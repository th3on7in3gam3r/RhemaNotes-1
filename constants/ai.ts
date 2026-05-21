/** Central Gemini / AI configuration */
export const GEMINI_MODEL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
  'gemini-2.5-flash';

/** ~10 minutes per transcription chunk (long sermons) */
export const AUDIO_CHUNK_SECONDS = 600;

/** Soft warning in live recorder UI */
export const LONG_RECORDING_WARN_SECONDS = 60 * 60;

/** Max request body for Gemini proxy (bytes) */
export const GEMINI_PROXY_MAX_BODY_BYTES = 25 * 1024 * 1024;
