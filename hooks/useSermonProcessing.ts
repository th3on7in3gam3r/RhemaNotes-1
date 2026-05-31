import { useState, useCallback } from 'react';
import {
  beginProcessing,
  cancelProcessing,
  processSermonTranscript,
  processSermonFile,
  transcribeSermonAudio,
  estimateTranscriptionMinutes,
  estimateChunksFromFile,
} from '../services/geminiService';
import { saveSermonToHistory } from '../services/storageService';
import { savePendingTranscript, clearPendingTranscript } from '../services/transcriptCache';
import { ensureAuthToken } from '../services/apiAuth';
import type { UserTier } from '../constants/features';
import type { SermonSourceType } from '../types/source';
import type { SermonHistoryItem, SermonSummaryOutput, UserNote } from '../types';

export interface PendingTranscriptReview {
  transcript: string;
  file?: File;
  liveNotes?: UserNote[];
  sourceType: SermonSourceType;
}

interface UseSermonProcessingOptions {
  userId: string;
  includeReflection: boolean;
  onSaved: (item: SermonHistoryItem, summary: SermonSummaryOutput) => void;
  maxAudioMinutes?: number;
  tier?: UserTier;
  isSignedIn?: boolean;
}

function estimateRecordingMinutes(file: File): number {
  return file.size / 4000 / 60;
}

export function useSermonProcessing({
  userId,
  includeReflection,
  onSaved,
  maxAudioMinutes = 180,
  tier = 'free',
  isSignedIn = false,
}: UseSermonProcessingOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | undefined>();
  const [pendingReview, setPendingReview] = useState<PendingTranscriptReview | null>(null);

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    const isOffline =
      !navigator.onLine ||
      message.includes('Failed to fetch') ||
      message.includes('network') ||
      message.includes('disconnected');

    if (isOffline) {
      setError(
        'Your internet connection was disconnected or timed out. Long sermons need a stable connection for 15–20 minutes.',
      );
      return;
    }

    if (
      isSignedIn &&
      (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED'))
    ) {
      setError(
        'Google AI quota was exceeded for this app (this is separate from your Harvest Church plan). ' +
          'Wait 1–2 minutes and try again. If it keeps failing, the site admin may need to enable billing in Google AI Studio.',
      );
      return;
    }

    if (message.includes('Rate limit') && isSignedIn && (tier === 'church' || tier === 'pro')) {
      setError(
        'Too many AI requests in a short window. Refresh the page, wait one minute, and try again. ' +
          'If this persists, sign out and sign back in.',
      );
      return;
    }

    setError(message);
  }, [isSignedIn, tier]);

  const saveResult = useCallback(
    async (
      result: SermonSummaryOutput,
      sourceType: SermonSourceType,
      liveNotes?: UserNote[],
      file?: File,
    ) => {
      if (liveNotes?.length) {
        result.user_notes = [...(result.user_notes || []), ...liveNotes];
      }
      if (file) result.audio_blob = file;
      const savedItem = await saveSermonToHistory(result, userId, sourceType);
      await clearPendingTranscript();
      onSaved(savedItem, result);
    },
    [userId, onSaved],
  );

  const runStudyGuide = useCallback(
    async (transcript: string, sourceType: SermonSourceType, liveNotes?: UserNote[], file?: File) => {
      const controller = beginProcessing();
      setIsLoading(true);
      setError(null);
      setProcessingStatus('Step 2 of 2: Creating your study guide…');
      try {
        const result = await processSermonTranscript(
          transcript,
          includeReflection,
          controller.signal,
        );
        await saveResult(result, sourceType, liveNotes, file);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
        setProcessingStatus(undefined);
      }
    },
    [includeReflection, saveResult, handleError],
  );

  /** Paste text or YouTube transcript — straight to study guide */
  const processText = useCallback(
    async (
      transcript: string,
      sourceType: SermonSourceType = 'text',
      liveNotes?: UserNote[],
      meta?: { title?: string },
    ) => {
      const controller = beginProcessing();
      setIsLoading(true);
      setError(null);
      setProcessingStatus('Step 2 of 2: Creating your study guide…');
      try {
        const result = await processSermonTranscript(
          transcript,
          includeReflection,
          controller.signal,
        );
        if (meta?.title && (!result.title || result.title === 'Sermon Summary')) {
          result.title = meta.title;
        } else if (!result.title && sourceType === 'youtube') {
          result.title = 'YouTube Sermon Study';
        }
        await saveResult(result, sourceType, liveNotes);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
        setProcessingStatus(undefined);
      }
    },
    [includeReflection, saveResult, handleError],
  );

  /** Audio file / live recording — transcribe, then review */
  const processAudioFile = useCallback(
    async (file: File, sourceType: SermonSourceType, liveNotes?: UserNote[]) => {
      const estMin = estimateRecordingMinutes(file);
      if (Number.isFinite(maxAudioMinutes) && maxAudioMinutes < Infinity && estMin > maxAudioMinutes) {
        const planName = tier === 'church' ? 'The Harvest' : tier === 'pro' ? 'The Vine' : 'The Seed';
        setError(
          `This recording is about ${Math.round(estMin)} minutes. ${planName} allows up to ${maxAudioMinutes} minutes per recording.` +
            (tier === 'free'
              ? ' Upgrade to The Vine (120 min) or The Harvest (180 min), or open Profile → "Already paid? Refresh plan" if you subscribed already.'
              : ''),
        );
        return;
      }

      if (isSignedIn) {
        const hasToken = await ensureAuthToken();
        if (!hasToken) {
          setError(
            'Your sign-in session could not be verified for AI processing. Refresh the page, sign in again, then retry.',
          );
          return;
        }
      }

      const controller = beginProcessing();
      setIsLoading(true);
      setError(null);
      setPendingReview(null);
      try {
        const chunks = estimateChunksFromFile(file);
        const tierLabel = tier === 'church' ? 'Harvest Church' : tier === 'pro' ? 'Vine' : '';
        const durationHint =
          chunks > 1
            ? `Step 1 of 2: Transcribing ${chunks} parts (~${estimateTranscriptionMinutes(chunks)} min)${tierLabel ? ` · ${tierLabel}` : ''}. Keep this tab open on Wi‑Fi.`
            : 'Step 1 of 2: Turning your recording into text…';
        setProcessingStatus(durationHint);
        const transcript = await transcribeSermonAudio(
          file,
          (status) => setProcessingStatus(status),
          controller.signal,
        );
        await savePendingTranscript({ transcript, fileName: file.name, savedAt: Date.now() });
        setProcessingStatus(undefined);
        setPendingReview({ transcript, file, liveNotes, sourceType });
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
        setProcessingStatus(undefined);
      }
    },
    [handleError, maxAudioMinutes, tier, isSignedIn],
  );

  /** Upload path: optional single-shot without review */
  const processFileDirect = useCallback(
    async (file: File, sourceType: SermonSourceType = 'upload') => {
      const controller = beginProcessing();
      setIsLoading(true);
      setError(null);
      try {
        const result = await processSermonFile(
          file,
          includeReflection,
          (status) => setProcessingStatus(status),
          controller.signal,
        );
        result.audio_blob = file;
        await saveResult(result, sourceType);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
        setProcessingStatus(undefined);
      }
    },
    [includeReflection, saveResult, handleError],
  );

  const confirmTranscriptReview = useCallback(async () => {
    if (!pendingReview) return;
    const { transcript, file, liveNotes, sourceType } = pendingReview;
    setPendingReview(null);
    await runStudyGuide(transcript, sourceType, liveNotes, file);
  }, [pendingReview, runStudyGuide]);

  const dismissTranscriptReview = useCallback(() => {
    setPendingReview(null);
    void clearPendingTranscript();
  }, []);

  const cancelActiveProcessing = useCallback(() => {
    cancelProcessing();
    setIsLoading(false);
    setProcessingStatus(undefined);
    setPendingReview(null);
    setError('Processing was cancelled.');
  }, []);

  return {
    isLoading,
    error,
    setError,
    processingStatus,
    pendingReview,
    processText,
    processAudioFile,
    processFileDirect,
    confirmTranscriptReview,
    dismissTranscriptReview,
    cancelActiveProcessing,
  };
}
