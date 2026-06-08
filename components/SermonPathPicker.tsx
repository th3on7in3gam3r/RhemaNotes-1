import React from 'react';
import { FileText, Mic, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

interface SermonPathPickerProps {
  onPasteTranscript: () => void;
  onRecordInApp: () => void;
  onLongSermonGuide: () => void;
  whisperAvailable?: boolean;
}

export const SermonPathPicker: React.FC<SermonPathPickerProps> = ({
  onPasteTranscript,
  onRecordInApp,
  onLongSermonGuide,
  whisperAvailable,
}) => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
    <button
      type="button"
      onClick={onPasteTranscript}
      className="group text-left sacred-card sacred-card-hover p-8 md:p-10 border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white relative overflow-hidden"
    >
      <div className="absolute top-4 right-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
        Recommended · 45+ min
      </div>
      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
        <FileText className="w-7 h-7 text-emerald-700" />
      </div>
      <h3 className="text-2xl font-serif font-black text-indigo-950 mb-3">I have a transcript</h3>
      <p className="text-indigo-900/60 font-serif leading-relaxed mb-6">
        Record on Voice Memos or your phone&apos;s recorder, copy the text, and paste it here.
        Best for full Sunday services over an hour.
      </p>
      <span className="inline-flex items-center text-sm font-black text-emerald-700 uppercase tracking-wider">
        Paste Text <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </span>
    </button>

    <button
      type="button"
      onClick={onRecordInApp}
      className="group text-left sacred-card sacred-card-hover p-8 md:p-10 border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white relative"
    >
      <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
        {whisperAvailable ? (
          <>
            <ShieldCheck className="w-3 h-3" /> Whisper
          </>
        ) : (
          <>
            <AlertTriangle className="w-3 h-3" /> Browser
          </>
        )}
      </div>
      <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
        <Mic className="w-7 h-7 text-indigo-700" />
      </div>
      <h3 className="text-2xl font-serif font-black text-indigo-950 mb-3">Record in RhemaNotes</h3>
      <p className="text-indigo-900/60 font-serif leading-relaxed mb-4">
        Record → transcribe{whisperAvailable ? ' (Whisper)' : ''} → edit text → study guide.
        Great for shorter sermons; long recordings may fail on some phones.
      </p>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onLongSermonGuide();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onLongSermonGuide();
          }
        }}
        className="block text-xs font-bold text-amber-700 underline underline-offset-2 mb-4 hover:text-amber-900 cursor-pointer"
      >
        Long sermon? See Voice Memos guide
      </span>
      <span className="inline-flex items-center text-sm font-black text-indigo-700 uppercase tracking-wider">
        Start Recording <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </span>
    </button>
  </div>
);
