import React, { useEffect, useState } from 'react';
import { FileText, RotateCcw } from 'lucide-react';
import { getPartialTranscript, clearPartialTranscript } from '../services/transcriptCache';

interface PendingPartialTranscriptBannerProps {
  onResume: (transcript: string, fileName?: string) => void;
}

export const PendingPartialTranscriptBanner: React.FC<PendingPartialTranscriptBannerProps> = ({
  onResume,
}) => {
  const [partial, setPartial] = useState<Awaited<ReturnType<typeof getPartialTranscript>>>(null);

  useEffect(() => {
    void getPartialTranscript().then(setPartial);
  }, []);

  if (!partial?.transcript?.trim()) return null;

  return (
    <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-black text-amber-950">Interrupted transcription</p>
          <p className="text-xs text-amber-900/70 mt-1">
            Parts {partial.completedChunks} of {partial.totalChunks} finished
            {partial.fileName ? ` (${partial.fileName})` : ''}. You can review partial text or discard and retry.
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onResume(partial.transcript, partial.fileName);
            setPartial(null);
          }}
          className="px-4 py-2 bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-amber-700"
        >
          Review partial
        </button>
        <button
          type="button"
          onClick={() => void clearPartialTranscript().then(() => setPartial(null))}
          className="px-4 py-2 bg-white border border-amber-200 text-amber-900 text-xs font-black uppercase tracking-wider rounded-xl"
        >
          Discard
        </button>
      </div>
    </div>
  );
};
