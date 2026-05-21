import { useState, useCallback } from 'react';
import {
  beginProcessing,
  cancelProcessing,
  processSermonTranscript,
  processSermonFile,
  transcribeSermonAudio,
} from '../services/geminiService';
import { saveSermonToHistory } from '../services/storageService';
import { savePendingTranscript, clearPendingTranscript } from '../services/transcriptCache';
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
}

export function useSermonProcessing({
  userId,
  includeReflection,
  onSaved,
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
    setError(
      isOffline
        ? 'Your internet connection was disconnected or timed out. Please verify your connection and try again.'
        : message,
    );
  }, []);

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
      setProcessingStatus('Creating your study guide…');
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
      setProcessingStatus('Creating your study guide…');
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
      const controller = beginProcessing();
      setIsLoading(true);
      setError(null);
      setPendingReview(null);
      try {
        setProcessingStatus('Transcribing your sermon recording…');
        const transcript = await transcribeSermonAudio(
          file,
          (status) => setProcessingStatus(status),
          controller.signal,
        );
        await savePendingTranscript({ transcript, fileName: file.name, savedAt: Date.now() });
        setPendingReview({ transcript, file, liveNotes, sourceType });
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
        setProcessingStatus(undefined);
      }
    },
    [handleError],
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
