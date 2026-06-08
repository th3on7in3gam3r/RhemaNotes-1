import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Sparkles, RotateCcw, Download, ClipboardCopy, Upload } from 'lucide-react';
import { downloadBlob } from '../services/recordingStore';

interface TranscriptReviewModalProps {
  transcript: string;
  onConfirm: (editedTranscript: string) => void;
  onReRecord: () => void;
  onSaveForLater?: (editedTranscript: string) => void;
  isLoading?: boolean;
  fileName?: string;
}

export const TranscriptReviewModal: React.FC<TranscriptReviewModalProps> = ({
  transcript,
  onConfirm,
  onReRecord,
  onSaveForLater,
  isLoading,
  fileName = 'sermon-transcript.txt',
}) => {
  const [edited, setEdited] = useState(transcript);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(edited);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadBlob(new Blob([edited], { type: 'text/plain;charset=utf-8' }), fileName.replace(/\.[^.]+$/, '') + '.txt');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-indigo-950/85 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl sacred-card p-6 md:p-10 max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-black text-indigo-950">Review &amp; Edit Transcript</h2>
            <p className="text-sm text-indigo-900/50 font-serif italic">
              Fix names or verses, then build your study guide — or save text for later.
            </p>
          </div>
        </div>

        <textarea
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          disabled={isLoading}
          className="flex-1 min-h-[200px] max-h-[45vh] mb-4 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-50 text-indigo-950 font-serif text-base leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-amber-200"
          spellCheck
        />

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={handleCopy}
            disabled={isLoading || !edited.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white border border-indigo-100 rounded-xl text-indigo-800"
          >
            <ClipboardCopy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy text'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading || !edited.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white border border-indigo-100 rounded-xl text-indigo-800"
          >
            <Download className="w-3.5 h-3.5" />
            Download .txt
          </button>
          {onSaveForLater && (
            <button
              type="button"
              onClick={() => onSaveForLater(edited)}
              disabled={isLoading || !edited.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white border border-indigo-100 rounded-xl text-indigo-800"
            >
              <Upload className="w-3.5 h-3.5" />
              Save for Upload later
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => onConfirm(edited)}
            disabled={isLoading || !edited.trim()}
            className="btn-sacred-primary flex-1 py-4 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {isLoading ? 'Building study guide…' : 'Build Study Guide'}
          </button>
          <button
            type="button"
            onClick={onReRecord}
            disabled={isLoading}
            className="btn-sacred-ghost flex-1 py-4 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Start Over
          </button>
        </div>
      </motion.div>
    </div>
  );
};
