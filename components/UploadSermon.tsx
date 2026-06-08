import React, { useState, useRef, useEffect } from 'react';
import { FileAudio, FileText, Loader2, Upload, Mic } from 'lucide-react';

type UploadMode = 'text' | 'file' | 'transcribe';

interface UploadSermonProps {
  onProcessTranscript: (t: string) => Promise<void>;
  onProcessFile: (f: File) => Promise<void>;
  onTranscribeFile: (f: File) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  initialMode?: UploadMode;
  initialText?: string;
  onInitialTextConsumed?: () => void;
}

export const UploadSermon: React.FC<UploadSermonProps> = ({
  onProcessTranscript,
  onProcessFile,
  onTranscribeFile,
  onCancel,
  isLoading,
  initialMode = 'text',
  initialText = '',
  onInitialTextConsumed,
}) => {
  const [text, setText] = useState(initialText);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<UploadMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
      setMode('text');
      onInitialTextConsumed?.();
    }
  }, [initialText, onInitialTextConsumed]);

  const handle = async () => {
    setBusy(true);
    try {
      if (mode === 'text') await onProcessTranscript(text);
      else if (mode === 'transcribe' && file) await onTranscribeFile(file);
      else if (mode === 'file' && file) await onProcessFile(file);
    } finally {
      setBusy(false);
    }
  };

  const disabled =
    isLoading ||
    busy ||
    (mode === 'text' ? !text.trim() : !file);

  const modeLabels: Record<UploadMode, { label: string; icon: typeof FileText }> = {
    text: { label: 'Paste Text', icon: FileText },
    transcribe: { label: 'Transcribe Audio', icon: Mic },
    file: { label: 'Full Process', icon: FileAudio },
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-3xl sacred-card p-8 md:p-16">
        <h2 className="text-4xl font-serif font-black text-indigo-950 mb-4 tracking-tight">Upload Sermon</h2>
        <p className="text-indigo-900/50 font-serif italic mb-8">
          {mode === 'text'
            ? 'Paste a transcript — best for hour-long sermons.'
            : mode === 'transcribe'
              ? 'Audio → editable text → study guide (two steps, safer for long recordings).'
              : 'Upload audio and run transcription + study guide in one flow.'}
        </p>

        <div className="flex flex-wrap bg-indigo-50/50 p-1.5 rounded-2xl mb-10 gap-1 border border-indigo-100">
          {(['text', 'transcribe', 'file'] as const).map((m) => {
            const Icon = modeLabels[m].icon;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 min-w-[100px] flex items-center justify-center space-x-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  mode === m ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-900/40 hover:text-indigo-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{modeLabels[m].label}</span>
              </button>
            );
          })}
        </div>

        {mode === 'text' ? (
          <textarea
            className="w-full h-80 p-6 mb-8 bg-white border-2 border-indigo-50 rounded-3xl resize-none text-indigo-950 font-serif text-lg placeholder:text-indigo-200 leading-relaxed focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-200 transition-all"
            placeholder="Paste your sermon transcript here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading || busy}
          />
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="w-full h-64 mb-8 rounded-3xl border-2 border-dashed border-indigo-100 flex flex-col items-center justify-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all group bg-indigo-50/20"
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="audio/*,video/*"
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
            />
            {file ? (
              <div className="text-center">
                <FileAudio className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                <p className="font-serif font-black text-indigo-950">{file.name}</p>
                <p className="text-sm text-indigo-900/40 mt-2">Tap to choose a different file</p>
              </div>
            ) : (
              <div className="text-center px-6">
                <Upload className="w-12 h-12 text-indigo-200 mx-auto mb-4 group-hover:text-amber-400 transition-colors" />
                <p className="font-serif font-black text-indigo-950">Choose audio or video</p>
                <p className="text-sm text-indigo-900/40 mt-2">Voice Memos, MP3, M4A, etc.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={handle}
            disabled={disabled}
            className="btn-sacred-primary flex-1 py-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {(isLoading || busy) && <Loader2 className="w-5 h-5 animate-spin" />}
            {mode === 'text'
              ? 'Build Study Guide'
              : mode === 'transcribe'
                ? 'Transcribe to Text'
                : 'Process Audio'}
          </button>
          <button type="button" onClick={onCancel} className="btn-sacred-ghost flex-1 py-4">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
