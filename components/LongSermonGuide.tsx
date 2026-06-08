import React from 'react';
import { motion } from 'motion/react';
import { X, Smartphone, FileText, CheckCircle2, Copy } from 'lucide-react';

interface LongSermonGuideProps {
  onClose: () => void;
  onPasteTranscript: () => void;
}

const steps = {
  ios: [
    'Open the Voice Memos app and record the full service.',
    'When finished, open the memo → tap ⋯ or the memo details.',
    'If you see a transcript, tap Copy; or use Live Transcription while recording (iOS 18+).',
    'In RhemaNotes: Upload → Paste Text → paste → Build Study Guide.',
  ],
  android: [
    'Open Google Recorder (or your phone\'s voice recorder with transcription).',
    'Record the sermon, then open the recording and copy the transcript text.',
    'In RhemaNotes: Upload → Paste Text → paste → Build Study Guide.',
  ],
};

export const LongSermonGuide: React.FC<LongSermonGuideProps> = ({ onClose, onPasteTranscript }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-indigo-950/90 backdrop-blur-md">
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl bg-white rounded-[32px] p-8 md:p-10 max-h-[92vh] overflow-y-auto shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Recommended for 45+ min
          </div>
          <h2 className="text-3xl font-serif font-black text-indigo-950">Long sermon? Use your phone&apos;s recorder</h2>
          <p className="text-indigo-900/60 font-serif italic mt-2">
            Voice Memos and many Android recorders handle hour-long audio better than a browser tab.
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-indigo-50 text-indigo-400">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-indigo-950">iPhone (Voice Memos)</h3>
          </div>
          <ol className="space-y-3 text-sm text-indigo-900/80 list-decimal list-inside font-medium leading-relaxed">
            {steps.ios.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-indigo-950">Android</h3>
          </div>
          <ol className="space-y-3 text-sm text-indigo-900/80 list-decimal list-inside font-medium leading-relaxed">
            {steps.android.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-950 mb-8">
        <strong className="font-black">In RhemaNotes instead?</strong> Live Recording uses Whisper when available,
        then lets you edit text before the study guide — reliable for shorter sermons;{' '}
        <strong>not guaranteed</strong> for very long recordings on every phone.
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => {
            onPasteTranscript();
            onClose();
          }}
          className="btn-sacred-primary flex-1 py-4 flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Paste my transcript
        </button>
        <button type="button" onClick={onClose} className="btn-sacred-ghost flex-1 py-4 flex items-center justify-center gap-2">
          <Copy className="w-5 h-5" />
          Got it
        </button>
      </div>
    </motion.div>
  </div>
);
