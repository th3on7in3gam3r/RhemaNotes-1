import {
  LONG_FORM_CHUNK_SECONDS,
  LONG_FORM_OVERLAP_SECONDS,
  LONG_FORM_SAMPLE_RATE,
  LONG_FORM_MIN_DURATION_SEC,
} from '../lib/transcriptionConstants';

export interface AudioChunkBlob {
  index: number;
  blob: Blob;
  fileName: string;
  startSec: number;
  endSec: number;
}

export type ChunkProgressCallback = (status: string) => void;

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Processing cancelled', 'AbortError');
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio API not supported');

  const ctx = new AudioContextClass();
  try {
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > 200 * 1024 * 1024) {
      throw new Error('Recording file too large for in-browser processing (max 200 MB)');
    }
    return await ctx.decodeAudioData(buffer.slice(0));
  } finally {
    if (ctx.state !== 'closed') await ctx.close().catch(() => {});
  }
}

async function resampleToMono(
  buffer: AudioBuffer,
  targetRate: number,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  assertNotAborted(signal);
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(targetRate * buffer.duration),
    targetRate,
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = bytesPerSample;
  const dataLength = channel.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < channel.length; i++) {
    const sample = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Split audio into ~10-minute WAV chunks with 15s overlap.
 * Uses Web Audio API (browser equivalent of ffmpeg segmenting).
 */
export async function chunkAudioForLongFormTranscription(
  file: File,
  onProgress?: ChunkProgressCallback,
  signal?: AbortSignal,
): Promise<AudioChunkBlob[]> {
  assertNotAborted(signal);
  onProgress?.('Loading audio for long-form transcription…');

  const decoded = await decodeAudioFile(file);
  assertNotAborted(signal);
  onProgress?.('Preparing 10-minute segments with overlap…');

  const mono = await resampleToMono(decoded, LONG_FORM_SAMPLE_RATE, signal);
  const channel = mono.getChannelData(0);
  const sampleRate = mono.sampleRate;
  const durationSec = mono.duration;
  const chunkSamples = LONG_FORM_CHUNK_SECONDS * sampleRate;
  const overlapSamples = LONG_FORM_OVERLAP_SECONDS * sampleRate;
  const stepSamples = Math.max(1, chunkSamples - overlapSamples);

  const chunks: AudioChunkBlob[] = [];
  let chunkIndex = 0;

  for (let startSample = 0; startSample < channel.length; startSample += stepSamples) {
    assertNotAborted(signal);
    const endSample = Math.min(startSample + chunkSamples, channel.length);
    const length = endSample - startSample;
    if (length <= 0) break;

    const slice = new AudioBuffer({ length, numberOfChannels: 1, sampleRate });
    slice.getChannelData(0).set(channel.subarray(startSample, endSample));

    const startSec = startSample / sampleRate;
    const endSec = endSample / sampleRate;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'sermon';

    chunks.push({
      index: chunkIndex,
      blob: audioBufferToWav(slice),
      fileName: `${baseName}-part-${chunkIndex + 1}.wav`,
      startSec,
      endSec,
    });

    chunkIndex += 1;
    if (endSample >= channel.length) break;
  }

  if (chunks.length === 0) {
    throw new Error('Recording appears empty. Please record again.');
  }

  if (chunks.length > 1) {
    onProgress?.(
      `Split ${Math.round(durationSec / 60)} min recording into ${chunks.length} parts (10 min each, 15s overlap)…`,
    );
  }

  return chunks;
}

export function estimateAudioDurationSec(file: File): number {
  return file.size / 4000;
}

export function estimateLongFormChunks(file: File): number {
  const durationSec = estimateAudioDurationSec(file);
  const stepSec = LONG_FORM_CHUNK_SECONDS - LONG_FORM_OVERLAP_SECONDS;
  return Math.max(1, Math.ceil(durationSec / stepSec));
}

export function shouldUseLongFormTranscription(file: File): boolean {
  return estimateAudioDurationSec(file) >= LONG_FORM_MIN_DURATION_SEC;
}
