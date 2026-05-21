import React, { useState } from 'react';
import { Video as Youtube, Loader2 } from 'lucide-react';

interface YouTubeProcessorProps {
  onProcessUrl: (url: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export const YouTubeProcessor: React.FC<YouTubeProcessorProps> = ({
  onProcessUrl,
  onCancel,
  isLoading,
}) => {
  const [url, setUrl] = useState('');

  const handle = () => {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      alert('Please enter a valid YouTube link.');
      return;
    }
    onProcessUrl(url);
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-2xl sacred-card p-12 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
          <Youtube className="w-10 h-10 text-rose-500" />
        </div>

        <h2 className="text-4xl font-serif font-black text-indigo-950 mb-3 tracking-tight">YouTube Sermon</h2>
        <p className="text-indigo-900/40 font-serif text-lg mb-10 italic">
          Paste the link to a sermon that has moved you. We will source the transcript and reveal its deeper truths.
        </p>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handle()}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={isLoading}
          className="w-full p-6 mb-4 bg-white border-2 border-indigo-50 rounded-3xl text-indigo-950 font-serif text-lg placeholder:text-indigo-100 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-200 disabled:opacity-50 transition-all"
        />

        <p className="text-xs text-indigo-900/30 font-bold mb-10 uppercase tracking-widest">
          Supports most videos with active captions
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            type="button"
            onClick={handle}
            disabled={isLoading || !url.trim()}
            className="btn-sacred-primary flex-1 py-4 bg-rose-600 hover:bg-rose-700 shadow-rose-200"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Process YouTube Sermon'}
          </button>
          <button type="button" onClick={onCancel} className="btn-sacred-ghost flex-1 py-4">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
