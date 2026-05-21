import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cancelProcessing } from '../services/geminiService';

const PROCESSING_STEPS = [
  'Awakening the transcript…',
  'The Spirit is moving through the Word…',
  'Illuminating key truths…',
  'Gathering the scriptures…',
  'Preparing your spiritual study guide…',
];

interface ProcessingOverlayProps {
  processingStatus?: string;
  onCancel?: () => void;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  processingStatus,
  onCancel,
}) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % PROCESSING_STEPS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const handleCancel = () => {
    cancelProcessing();
    onCancel?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/90 backdrop-blur-xl">
      <div className="relative w-32 h-32 mb-12">
        <div className="absolute inset-0 rounded-full border-4 border-amber-200/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-amber-200/40 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center shadow-[0_0_50px_rgba(253,230,138,0.3)]">
            <BookOpen className="w-8 h-8 text-indigo-900" />
          </div>
        </div>
      </div>

      <h2 className="text-3xl font-serif font-black text-amber-50 mb-4 tracking-tight">Processing Sermon</h2>

      <div className="h-8 overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={processingStatus ?? step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-amber-200/70 text-lg font-serif italic"
          >
            {processingStatus ?? PROCESSING_STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-12 w-64 h-1.5 bg-indigo-900/50 rounded-full overflow-hidden border border-indigo-800">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-200 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${((step + 1) / PROCESSING_STEPS.length) * 100}%` }}
          transition={{ duration: 2.6, ease: 'linear' }}
        />
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={handleCancel}
          className="mt-10 px-6 py-3 rounded-2xl border border-amber-200/30 text-amber-100/80 text-sm font-bold hover:bg-indigo-900 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
};
