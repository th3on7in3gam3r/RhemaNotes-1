import React, { useState, useRef } from 'react';
import { FileAudio, FileText, FileVideo, Loader2, Upload } from 'lucide-react';

interface UploadSermonProps {
  onProcessTranscript: (t: string) => Promise<void>;
  onProcessFile: (f: File) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  initialMode?: 'text' | 'file';
}

export const UploadSermon: React.FC<UploadSermonProps> = ({
  onProcessTranscript,
  onProcessFile,
  onCancel,
  isLoading,
  initialMode = 'text',
}) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'text' | 'file'>(initialMode);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async () => {
    setBusy(true);
    try {
      if (mode === 'text') await onProcessTranscript(text);
      else if (file) await onProcessFile(file);
    } finally {
      setBusy(false);
    }
  };

  const disabled = isLoading || busy || (mode === 'text' ? !text.trim() : !file);

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-3xl sacred-card p-8 md:p-16">
        <h2 className="text-4xl font-serif font-black text-indigo-950 mb-8 tracking-tight">Upload Sermon</h2>

        <div className="flex bg-indigo-50/50 p-1.5 rounded-2xl mb-10 w-full max-w-xs border border-indigo-100">
          {(['text', 'file'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-black transition-all ${
                mode === m ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-900/40 hover:text-indigo-900'
              }`}
            >
              {m === 'text' ? <FileText className="w-4 h-4" /> : <FileAudio className="w-4 h-4" />}
              <span>{m === 'text' ? 'Paste Text' : 'Media File'}</span>
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <textarea
            className="w-full h-80 p-6 mb-8 bg-white border-2 border-indigo-50 rounded-3xl resize-none text-indigo-950 font-serif text-lg placeholder:text-indigo-200 leading-relaxed focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-200 transition-all"
            placeholder="Let the words flow here…"
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
                <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {file.type.startsWith('video') ? (
                    <FileVideo className="w-10 h-10 text-amber-700" />
                  ) : (
                    <FileAudio className="w-10 h-10 text-amber-700" />
                  )}
                </div>
                <p className="font-serif font-black text-xl text-indigo-950">{file.name}</p>
                <p className="text-sm text-indigo-900/40 mt-1 font-bold">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · Change file
                </p>
              </div>
            ) : (
              <div className="text-center px-8">
                <div className="w-20 h-20 bg-indigo-100/50 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform">
                  <Upload className="w-10 h-10 text-indigo-400" />
                </div>
                <p className="font-serif font-black text-xl text-indigo-950">Bring your sermon file</p>
                <p className="text-sm text-indigo-900/40 mt-1 font-bold">MP3, MP4, WAV, M4A or Video</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <button type="button" onClick={handle} disabled={disabled} className="btn-sacred-primary flex-1 py-4 text-lg">
            {busy || isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Begin Illumination'}
          </button>
          <button type="button" onClick={onCancel} className="btn-sacred-ghost flex-1 py-4 text-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
