import React from 'react';
import { motion } from 'motion/react';
import { FileText, Sparkles, RotateCcw } from 'lucide-react';

interface TranscriptReviewModalProps {
  transcript: string;
  onConfirm: () => void;
  onReRecord: () => void;
  isLoading?: boolean;
}

export const TranscriptReviewModal: React.FC<TranscriptReviewModalProps> = ({
  transcript,
  onConfirm,
  onReRecord,
  isLoading,
}) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-indigo-950/85 backdrop-blur-xl">
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-3xl sacred-card p-8 md:p-12 max-h-[90vh] flex flex-col"
    >
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
          <FileText className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-black text-indigo-950">Review Transcript</h2>
          <p className="text-sm text-indigo-900/50 font-serif italic">
            Your recording was transcribed. Confirm before we build your study guide.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-8 p-6 bg-indigo-50/40 rounded-2xl border border-indigo-50 min-h-[200px] max-h-[50vh]">
        <p className="text-indigo-950 font-serif text-lg leading-relaxed whitespace-pre-wrap">{transcript}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
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
